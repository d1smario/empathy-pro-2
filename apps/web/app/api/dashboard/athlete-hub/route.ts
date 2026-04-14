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
      nutCRes,
      nutPlansCnt,
      physRes,
      healthPanelsTotal,
      healthLastPanel,
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
        .select("type")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      resolveAthleteMemory(athleteId).catch(() => null),
    ]);

    const errMsg =
      profRes.error?.message ??
      plannedCnt.error?.message ??
      executedCnt.error?.message ??
      nutCRes.error?.message ??
      nutPlansCnt.error?.message ??
      physRes.error?.message ??
      healthPanelsTotal.error?.message ??
      healthLastPanel.error?.message ??
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

    const lastRow = healthLastPanel.data as { type?: string } | null;
    const lastLabel =
      lastRow && typeof lastRow.type === "string" && lastRow.type.trim() !== ""
        ? lastRow.type.trim()
        : null;

    const readSpineCoverage = summarizeReadSpineCoverage(athleteMemory);

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

    const payload = {
      ok: true as const,
      athleteId,
      window: { from, to },
      profile,
      training: {
        plannedCount: plannedCnt.count ?? 0,
        executedCount: executedCnt.count ?? 0,
      },
      nutrition: {
        constraintsLine: constraints ? formatNutritionConstraintsLine(constraints) : null,
        plansCount: nutPlansCnt.count ?? 0,
      },
      physiology: phys ? { line: formatPhysiologicalProfileStrip(phys) } : null,
      health: {
        panelsCount: healthPanelsTotal.count ?? 0,
        lastPanelLabel: lastLabel,
      },
      readSpineCoverage,
      operationalSignals,
      crossModuleDynamicsLines,
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
