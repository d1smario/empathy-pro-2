import { NextRequest, NextResponse } from "next/server";
import {
  formatNutritionConstraintsLine,
  nutritionConstraintsFromDbRow,
  type NutritionConstraintsDbRow,
} from "@empathy/domain-nutrition";
import {
  formatPhysiologicalProfileStrip,
  physiologicalProfileFromDbRow,
  type PhysiologicalProfileDbRow,
} from "@empathy/domain-physiology";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { mapAthleteProfileRow } from "@/lib/profile/map-athlete-profile-row";
import { formatAthleteProfileStrip } from "@/lib/profile/athlete-profile-strip";
import { resolveOperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import { buildOperationalDynamicsLines } from "@/lib/platform/operational-dynamics-lines";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { summarizeReadSpineCoverage } from "@/lib/platform/read-spine-coverage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const PROFILE_SELECT =
  "id, first_name, last_name, email, birth_date, sex, timezone, activity_level, height_cm, weight_kg, training_days_per_week, training_max_session_minutes, updated_at";

function sumLastNDaysByDate(
  rows: Array<{ date: string | null; value: number }>,
  endDateIso: string,
  days: number,
): number {
  const end = new Date(`${endDateIso}T00:00:00`);
  if (Number.isNaN(end.getTime())) return 0;
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return rows.reduce((acc, row) => {
    if (!row.date) return acc;
    if (row.date < startIso || row.date > endDateIso) return acc;
    return acc + row.value;
  }, 0);
}

function compliancePct(planned: number, executed: number): number {
  if (planned > 0) return (executed / planned) * 100;
  return executed > 0 ? 100 : 0;
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
 * Hub dashboard: sintesi atleta in una round-trip. Auth + client DB allineati a
 * `@/lib/auth/athlete-read-context` (come planned-window / nutrition module).
 */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    let from = (req.nextUrl.searchParams.get("from") ?? "").trim();
    let to = (req.nextUrl.searchParams.get("to") ?? "").trim();
    if (!from) from = addDays(todayIso, -7);
    if (!to) to = addDays(todayIso, 28);

    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);

    const [
      profRes,
      plannedCnt,
      executedCnt,
      executedLoads120,
      plannedLoads120,
      nutCRes,
      nutPlansCnt,
      physRes,
      healthPanelsTotal,
      healthLastPanel,
      healthByType,
      healthTimelineBounds,
      athleteMemory,
    ] = await Promise.all([
      db.from("athlete_profiles").select(PROFILE_SELECT).eq("id", athleteId).maybeSingle(),
      db
        .from("planned_workouts")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to),
      db
        .from("executed_workouts")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to),
      db
        .from("executed_workouts")
        .select("date, tss")
        .eq("athlete_id", athleteId)
        .gte("date", addDays(todayIso, -120))
        .lte("date", todayIso),
      db
        .from("planned_workouts")
        .select("date, tss_target")
        .eq("athlete_id", athleteId)
        .gte("date", addDays(todayIso, -120))
        .lte("date", todayIso),
      db.from("nutrition_constraints").select("*").eq("athlete_id", athleteId).maybeSingle(),
      db
        .from("nutrition_plans")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteId),
      db
        .from("physiological_profiles")
        .select(
          "id, athlete_id, ftp_watts, cp_watts, lt1_watts, lt1_heart_rate, lt2_watts, lt2_heart_rate, v_lamax, vo2max_ml_min_kg, economy, baseline_hrv_ms, valid_from, valid_to, updated_at",
        )
        .eq("athlete_id", athleteId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("biomarker_panels")
        .select("id", { count: "exact", head: true })
        .eq("athlete_id", athleteId),
      db
        .from("biomarker_panels")
        .select("type, sample_date, created_at")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("biomarker_panels")
        .select("type")
        .eq("athlete_id", athleteId)
        .order("sample_date", { ascending: false })
        .limit(400),
      db
        .from("biomarker_panels")
        .select("sample_date, created_at")
        .eq("athlete_id", athleteId)
        .order("sample_date", { ascending: true })
        .limit(400),
      resolveAthleteMemory(athleteId).catch(() => null),
    ]);

    const errMsg =
      profRes.error?.message ??
      plannedCnt.error?.message ??
      executedCnt.error?.message ??
      executedLoads120.error?.message ??
      plannedLoads120.error?.message ??
      nutCRes.error?.message ??
      nutPlansCnt.error?.message ??
      physRes.error?.message ??
      healthPanelsTotal.error?.message ??
      healthLastPanel.error?.message ??
      healthByType.error?.message ??
      healthTimelineBounds.error?.message ??
      null;
    if (errMsg) {
      return NextResponse.json({ ok: false as const, error: errMsg }, { status: 500, headers: NO_STORE });
    }

    const profileView = mapAthleteProfileRow(profRes.data);
    const profile = profileView ? { line: formatAthleteProfileStrip(profileView) } : null;

    const constraintsRow = nutCRes.data as NutritionConstraintsDbRow | null;
    const constraints = constraintsRow ? nutritionConstraintsFromDbRow(constraintsRow) : null;

    const physRow = physRes.data as PhysiologicalProfileDbRow | null;
    const phys = physRow ? physiologicalProfileFromDbRow(physRow) : null;

    const lastRow = healthLastPanel.data as { type?: string; sample_date?: string | null; created_at?: string | null } | null;
    const lastLabel =
      lastRow && typeof lastRow.type === "string" && lastRow.type.trim() !== ""
        ? lastRow.type.trim()
        : null;
    const lastSampleDate =
      (lastRow?.sample_date && typeof lastRow.sample_date === "string" ? lastRow.sample_date : null) ??
      (lastRow?.created_at && typeof lastRow.created_at === "string" ? lastRow.created_at.slice(0, 10) : null);

    const byTypeMap = new Map<string, number>();
    for (const row of (healthByType.data ?? []) as Array<{ type?: string | null }>) {
      const type = typeof row.type === "string" && row.type.trim() ? row.type.trim() : "unknown";
      byTypeMap.set(type, (byTypeMap.get(type) ?? 0) + 1);
    }
    const byType = Array.from(byTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

    const timelineRows = (healthTimelineBounds.data ?? []) as Array<{ sample_date?: string | null; created_at?: string | null }>;
    const dateRows = timelineRows
      .map((row) => {
        if (typeof row.sample_date === "string" && row.sample_date) return row.sample_date;
        if (typeof row.created_at === "string" && row.created_at.length >= 10) return row.created_at.slice(0, 10);
        return null;
      })
      .filter((d): d is string => Boolean(d))
      .sort();
    let timelineDays: number | null = null;
    if (dateRows.length >= 2) {
      const first = new Date(`${dateRows[0]}T00:00:00`);
      const last = new Date(`${dateRows[dateRows.length - 1]}T00:00:00`);
      if (!Number.isNaN(first.getTime()) && !Number.isNaN(last.getTime())) {
        timelineDays = Math.max(0, Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }

    const readSpineCoverage = summarizeReadSpineCoverage(athleteMemory);
    const executedRows = ((executedLoads120.data ?? []) as Array<{ date: string | null; tss: number | null }>).map((row) => ({
      date: row.date,
      value: Math.max(0, Number(row.tss ?? 0)),
    }));
    const plannedRows = ((plannedLoads120.data ?? []) as Array<{ date: string | null; tss_target: number | null }>).map((row) => ({
      date: row.date,
      value: Math.max(0, Number(row.tss_target ?? 0)),
    }));
    const planned7 = sumLastNDaysByDate(plannedRows, todayIso, 7);
    const executed7 = sumLastNDaysByDate(executedRows, todayIso, 7);
    const planned28 = sumLastNDaysByDate(plannedRows, todayIso, 28);
    const executed28 = sumLastNDaysByDate(executedRows, todayIso, 28);

    const includeOperationalSignals =
      (req.nextUrl.searchParams.get("includeOperationalSignals") ?? "").trim() === "1";

    let operationalSignals: Awaited<ReturnType<typeof resolveOperationalSignalsBundle>> | null = null;
    if (includeOperationalSignals && athleteMemory) {
      try {
        operationalSignals = await resolveOperationalSignalsBundle({ athleteId, athleteMemory });
      } catch {
        operationalSignals = null;
      }
    }

    const crossModuleDynamicsLines =
      operationalSignals != null
        ? buildOperationalDynamicsLines({
            adaptationGuidance: operationalSignals.adaptationGuidance,
            operationalContext: operationalSignals.operationalContext,
            nutritionPerformanceIntegration: operationalSignals.nutritionPerformanceIntegration,
            adaptationLoop: {
              status: operationalSignals.adaptationLoop.status,
              nextAction: operationalSignals.adaptationLoop.nextAction,
            },
          })
        : [];

    let expectedVsObtainedPreview: {
      date: string | null;
      status: string | null;
      loopClosureSummary: string | null;
      recentCoachTracesInHint: number;
    } | null = null;
    if (includeOperationalSignals) {
      const evRes = await db
        .from("training_expected_obtained_deltas")
        .select("date, status, adaptation_hint")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!evRes.error && evRes.data) {
        const row = evRes.data as { date?: string | null; status?: string | null; adaptation_hint?: unknown };
        const hint =
          row.adaptation_hint && typeof row.adaptation_hint === "object" && !Array.isArray(row.adaptation_hint)
            ? (row.adaptation_hint as Record<string, unknown>)
            : {};
        const loop =
          hint.loop_closure && typeof hint.loop_closure === "object" && !Array.isArray(hint.loop_closure)
            ? (hint.loop_closure as Record<string, unknown>)
            : {};
        const traces = hint.recent_coach_application_traces;
        const ds = typeof row.date === "string" ? row.date.slice(0, 10) : null;
        expectedVsObtainedPreview = {
          date: ds,
          status: typeof row.status === "string" ? row.status : null,
          loopClosureSummary: typeof loop.summary_it === "string" && loop.summary_it.trim() ? loop.summary_it.trim() : null,
          recentCoachTracesInHint: Array.isArray(traces) ? traces.length : 0,
        };
      }
    }

    const payload = {
      ok: true as const,
      athleteId,
      window: { from, to },
      profile,
      training: {
        plannedCount: plannedCnt.count ?? 0,
        executedCount: executedCnt.count ?? 0,
        analyzerAligned: {
          basis: "tss_rolling_windows",
          toDate: todayIso,
          fromDate: addDays(todayIso, -120),
          last7: {
            planned: planned7,
            executed: executed7,
            compliancePct: compliancePct(planned7, executed7),
          },
          last28: {
            planned: planned28,
            executed: executed28,
            compliancePct: compliancePct(planned28, executed28),
          },
        },
      },
      nutrition: {
        constraintsLine: constraints ? formatNutritionConstraintsLine(constraints) : null,
        plansCount: nutPlansCnt.count ?? 0,
      },
      physiology: phys ? { line: formatPhysiologicalProfileStrip(phys) } : null,
      health: {
        panelsCount: healthPanelsTotal.count ?? 0,
        lastPanelLabel: lastLabel,
        lastSampleDate,
        timelineDays,
        byType,
      },
      readSpineCoverage,
      operationalSignals,
      crossModuleDynamicsLines,
      expectedVsObtainedPreview,
    };

    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "athlete-hub failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
