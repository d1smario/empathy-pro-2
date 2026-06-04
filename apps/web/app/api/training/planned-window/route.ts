import { NextRequest, NextResponse } from "next/server";
import {
  executedWorkoutFromDbRow,
  plannedWorkoutFromDbRow,
  type ExecutedWorkoutDbRow,
  type PlannedWorkoutDbRow,
} from "@empathy/domain-training";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { summarizeReadSpineCoverage } from "@/lib/platform/read-spine-coverage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  firstWindowQueryError,
  executedWorkoutsWindowSelect,
  plannedWorkoutsWindowSelect,
  queryPlannedExecutedWindow,
} from "@/lib/training/planned-executed-window-query";
import { inferPlannedProvenance, summarizeProvenanceCounts } from "@/lib/training/planned-provenance";
import { buildWellnessWindowSummary, type WellnessByDateMap } from "@/lib/physiology/wellness-window-summary";
import { twinContextStripFromMemory } from "@/lib/twin/twin-context-strip-from-memory";
import { ServerTiming, serverTimingNow } from "@/lib/http/server-timing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const EMPTY = { planned: [] as const, executed: [] as const };

/**
 * Date distinte da mostrare in diag API: prima erano solo i primi `max` giorni in ordine cronologico,
 * quindi con molti allenamenti a inizio finestra sparivano del tutto maggio / la parte “recente”.
 * Qui: primi ⌈max/2⌉ + ultimi ⌊max/2⌋ giorni distinti (dedup), ordinati.
 */
function executedDatesSampleForDiag(isoDayKeys: string[], max = 8): string[] {
  const uniq = Array.from(new Set(isoDayKeys.map((d) => d.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
  if (uniq.length <= max) return uniq;
  const headN = Math.ceil(max / 2);
  const tailN = max - headN;
  return Array.from(new Set([...uniq.slice(0, headN), ...uniq.slice(-tailN)])).sort();
}

/** Default: contesto atleta incluso. Valori che disattivano: `0`, `false`, `no`, `off`, `skip`. */
function wantsAthleteContextFromQuery(req: NextRequest): boolean {
  const raw = (req.nextUrl.searchParams.get("includeAthleteContext") ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off" || raw === "skip") return false;
  return true;
}

/** Default: wellness OFF (richiesto solo dalla pagina Calendar). Attiva con `1|true|yes|on`. */
function wantsWellnessFromQuery(req: NextRequest): boolean {
  const raw = (req.nextUrl.searchParams.get("includeWellness") ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Default: trace_summary incluso. Disattiva con `0|false|no|off|skip` (griglia calendario). */
function wantsTraceSummaryFromQuery(req: NextRequest): boolean {
  const raw = (req.nextUrl.searchParams.get("includeTraceSummary") ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off" || raw === "skip") return false;
  return true;
}

/** Default: `notes` inclusi. Disattiva con `0|false|no|off|skip` (griglia mese — payload leggero). */
function wantsPlannedNotesFromQuery(req: NextRequest): boolean {
  const raw = (req.nextUrl.searchParams.get("includePlannedNotes") ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off" || raw === "skip") return false;
  return true;
}

/** Default: entrambe le tabelle. Disattiva `includePlanned` o `includeExecuted` per fetch calendario a step. */
function wantsTableFromQuery(req: NextRequest, key: "includePlanned" | "includeExecuted"): boolean {
  const raw = (req.nextUrl.searchParams.get(key) ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off" || raw === "skip") return false;
  return true;
}

function addDays(isoDate: string, delta: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + delta);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Hub lettura calendario (verità operativa attività): `planned_workouts` + `executed_workouts`
 * nella finestra `from`…`to`. Il Builder scrive il pianificato via `POST /api/training/planned/insert`;
 * device/import/manual scrivono l’eseguito su `executed_workouts`. Le viste Calendario / Builder / scheda
 * giorno usano questo endpoint come sorgente unificata lato UI.
 *
 * Opzionale: `includeAthleteContext=0|false|no|off|skip` → niente `resolveAthleteMemory`; `readSpineCoverage` e `twinContextStrip` sono `null` (meno latenza).
 * Auth: cookie o `Authorization: Bearer` (parity V1); letture con service role se configurato.
 */
export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  const t0 = serverTimingNow();
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    let from = (req.nextUrl.searchParams.get("from") ?? "").trim();
    let to = (req.nextUrl.searchParams.get("to") ?? "").trim();

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (!from) from = addDays(todayIso, -7);
    if (!to) to = addDays(todayIso, 28);

    if (!athleteId) {
      return NextResponse.json(
        { ok: false as const, error: "missing_athleteId", ...EMPTY },
        { status: 400, headers: NO_STORE },
      );
    }

    const tAuth = serverTimingNow();
    const { db } = await requireAthleteReadContext(req, athleteId);
    timing.mark("auth", tAuth, "athlete read context");
    const includeAthleteContext = wantsAthleteContextFromQuery(req);
    const includeWellness = wantsWellnessFromQuery(req);
    const includeTraceSummary = wantsTraceSummaryFromQuery(req);
    const includePlannedNotes = wantsPlannedNotesFromQuery(req);
    const includePlanned = wantsTableFromQuery(req, "includePlanned");
    const includeExecuted = wantsTableFromQuery(req, "includeExecuted");
    const plannedSelect = plannedWorkoutsWindowSelect(includePlannedNotes);

    const windowPromise = (async () => {
      const tWindow = serverTimingNow();
      const result = await queryPlannedExecutedWindow(db, athleteId, from, to, undefined, {
        includeTraceSummary,
        includePlannedNotes,
        includePlanned,
        includeExecuted,
      });
      timing.mark("window", tWindow, "planned executed window");
      return result;
    })();
    const wellnessPromise = includeWellness
      ? buildWellnessWindowSummary({ db, athleteId, from, to }).catch(() => ({ wellnessByDate: {} as WellnessByDateMap, rowCount: 0 }))
      : Promise.resolve(null);

    let plannedRes: { data: unknown[] | null; error: { message: string } | null };
    let executedRes: { data: unknown[] | null; error: { message: string } | null };
    let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemorySlice>> | null = null;
    let wellnessByDate: WellnessByDateMap | undefined;
    let executedAdminFallbackUsed = false;
    let executedHiddenBySourcePreference = 0;

    if (includeAthleteContext) {
      const batch = await Promise.all([
        windowPromise,
        resolveAthleteMemorySlice(athleteId, { slice: "training" }).catch(() => null),
        wellnessPromise,
      ]);
      plannedRes = batch[0].planned;
      executedRes = batch[0].executed;
      executedHiddenBySourcePreference = batch[0].executedHiddenBySourcePreference ?? 0;
      athleteMemory = batch[1];
      wellnessByDate = batch[2]?.wellnessByDate;
    } else {
      const [windowRes, wellnessRes] = await Promise.all([windowPromise, wellnessPromise]);
      plannedRes = windowRes.planned;
      executedRes = windowRes.executed;
      executedHiddenBySourcePreference = windowRes.executedHiddenBySourcePreference ?? 0;
      wellnessByDate = wellnessRes?.wellnessByDate;
    }

    const errMsg = firstWindowQueryError(plannedRes, executedRes);
    if (errMsg) {
      return NextResponse.json(
        { ok: false as const, error: errMsg, ...EMPTY },
        { status: 500, headers: NO_STORE },
      );
    }

    /**
     * Fallback robustezza eseguito: query admin (service role) **solo quando l'RLS torna vuoto**,
     * in parità col fallback planned più sotto. Evita una seconda scansione completa di
     * `executed_workouts` ad ogni load quando l'RLS ha già restituito le righe (perf calendario).
     */
    const executedSelect = executedWorkoutsWindowSelect(includeTraceSummary);
    const rlsExecutedCount = executedRes.data?.length ?? 0;
    if (includeExecuted && rlsExecutedCount === 0) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        const forcedExecuted = await admin
          .from("executed_workouts")
          .select(executedSelect)
          .eq("athlete_id", athleteId)
          .gte("date", from)
          .lte("date", to)
          .order("date", { ascending: true })
          .range(0, 4999);
        if (!forcedExecuted.error && (forcedExecuted.data?.length ?? 0) > 0) {
          executedRes = { data: forcedExecuted.data as unknown[], error: null };
          executedAdminFallbackUsed = true;
        }
      }
    }

    let plannedAdminFallbackUsed = false;
    if (includePlanned && (plannedRes.data?.length ?? 0) === 0) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        const forcedPlanned = await admin
          .from("planned_workouts")
          .select(plannedSelect)
          .eq("athlete_id", athleteId)
          .gte("date", from)
          .lte("date", to)
          .order("date", { ascending: true });
        if (!forcedPlanned.error && (forcedPlanned.data?.length ?? 0) > 0) {
          plannedRes = { data: forcedPlanned.data as unknown[], error: null };
          plannedAdminFallbackUsed = true;
        }
      }
    }

    const planned = ((plannedRes.data ?? []) as PlannedWorkoutDbRow[]).map((row) => {
      const p = plannedWorkoutFromDbRow(row);
      return { ...p, provenance: inferPlannedProvenance(row) };
    });
    const plannedProvenanceSummary = summarizeProvenanceCounts(planned);
    const executed = ((executedRes.data ?? []) as ExecutedWorkoutDbRow[]).map(executedWorkoutFromDbRow);
    const executedSampleDates = executedDatesSampleForDiag(
      executed.map((row) => String(row.date ?? "").slice(0, 10)),
      8,
    );
    const readSpineCoverage = includeAthleteContext ? summarizeReadSpineCoverage(athleteMemory) : null;
    const twinContextStrip = includeAthleteContext ? twinContextStripFromMemory(athleteMemory?.twin ?? null) : null;
    const physiologyState = includeAthleteContext ? (athleteMemory?.physiology ?? null) : null;

    timing.mark("total", t0, "planned-window");
    const res = NextResponse.json(
      {
        ok: true as const,
        from,
        to,
        athleteId,
        planned,
        plannedProvenanceSummary,
        executed,
        executedSampleDates,
        readSpineCoverage,
        twinContextStrip,
        physiologyState,
        executedAdminFallbackUsed,
        executedHiddenBySourcePreference,
        ...(includeWellness ? { wellnessByDate: wellnessByDate ?? {} } : {}),
      },
      { headers: NO_STORE },
    );
    timing.applyTo(res.headers);
    return res;
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json(
        { ok: false as const, error: err.message, ...EMPTY },
        { status: err.status, headers: NO_STORE },
      );
    }
    const message = err instanceof Error ? err.message : "planned-window failed";
    return NextResponse.json(
      { ok: false as const, error: message, ...EMPTY },
      { status: 500, headers: NO_STORE },
    );
  }
}
