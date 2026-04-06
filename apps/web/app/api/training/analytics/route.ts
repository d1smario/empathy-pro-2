import { NextRequest, NextResponse } from "next/server";
import { buildAdaptationGuidance } from "@/lib/adaptation/adaptation-guidance";
import {
  TrainingRouteAuthError,
  requireAuthenticatedTrainingUser,
} from "@/lib/auth/training-route-auth";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { computeDailyLoadSeries, type ExecutedWorkoutLoadRow } from "@/lib/training/analytics/load-series";
import { buildTrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { resolveAdaptationRegenerationLoop } from "@/lib/training/adaptation-regeneration-loop";
import { buildBioenergeticModulation } from "@/lib/training/bioenergetic-modulation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type PlannedWorkoutAnalyticsRow = {
  date: string | null;
  tss_target: number | null;
  duration_minutes: number | null;
  kcal_target: number | null;
  type: string | null;
};

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function summarizeWindow(series: ReturnType<typeof computeDailyLoadSeries>, windowSize: number) {
  const window = series.slice(-windowSize);
  const external = window.reduce((sum, day) => sum + day.external, 0);
  const internal = window.reduce((sum, day) => sum + day.internal, 0);
  const coupling = external > 0 ? internal / external : 0;
  return { external, internal, coupling };
}

function summarizePlanWindow(
  compareSeries: Array<{
    planned: number;
    executed: number;
    internal: number;
  }>,
  windowSize: number,
) {
  const window = compareSeries.slice(-windowSize);
  const planned = window.reduce((sum, day) => sum + day.planned, 0);
  const executed = window.reduce((sum, day) => sum + day.executed, 0);
  const internal = window.reduce((sum, day) => sum + day.internal, 0);
  const compliancePct = planned > 0 ? (executed / planned) * 100 : executed > 0 ? 100 : 0;
  const internalVsExecuted = executed > 0 ? internal / executed : 0;
  return {
    planned,
    executed,
    internal,
    delta: executed - planned,
    compliancePct,
    internalVsExecuted,
  };
}

function buildCompareSeries(
  from: string,
  to: string,
  plannedRows: PlannedWorkoutAnalyticsRow[],
  loadSeries: ReturnType<typeof computeDailyLoadSeries>,
) {
  const plannedByDate = new Map<string, number>();
  for (const row of plannedRows) {
    if (!row.date) continue;
    plannedByDate.set(row.date, (plannedByDate.get(row.date) ?? 0) + Math.max(0, Number(row.tss_target ?? 0)));
  }

  const executedByDate = new Map(loadSeries.map((day) => [day.date, day]));
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const out: Array<{
    date: string;
    planned: number;
    executed: number;
    internal: number;
    ctl: number;
    atl: number;
    tsb: number;
    iCtl: number;
    iAtl: number;
    iTsb: number;
    executionVsPlanPct: number;
  }> = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateOnly(cursor);
    const executed = executedByDate.get(date);
    const planned = plannedByDate.get(date) ?? 0;
    const executedExternal = executed?.external ?? 0;
    out.push({
      date,
      planned,
      executed: executedExternal,
      internal: executed?.internal ?? 0,
      ctl: executed?.ctl ?? 0,
      atl: executed?.atl ?? 0,
      tsb: executed?.tsb ?? 0,
      iCtl: executed?.iCtl ?? 0,
      iAtl: executed?.iAtl ?? 0,
      iTsb: executed?.iTsb ?? 0,
      executionVsPlanPct: planned > 0 ? (executedExternal / planned) * 100 : executedExternal > 0 ? 100 : 0,
    });
  }

  return out;
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const from = (req.nextUrl.searchParams.get("from") ?? "").trim();
    const to = (req.nextUrl.searchParams.get("to") ?? "").trim();
    if (!athleteId || !from || !to) {
      return NextResponse.json({ error: "Missing athleteId/from/to", rows: [] }, { status: 400, headers: NO_STORE });
    }
    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
    const allowed = await canAccessAthleteData(rlsClient, userId, athleteId, null);
    if (!allowed) {
      return NextResponse.json({ error: "forbidden", rows: [] }, { status: 403, headers: NO_STORE });
    }

    const supabase = createServerSupabaseClient();
    const [{ data: executedData, error: executedError }, { data: plannedData, error: plannedError }, athleteMemory] = await Promise.all([
      supabase
        .from("executed_workouts")
        .select("id, date, tss, duration_minutes, kcal, trace_summary, lactate_mmoll, glucose_mmol, smo2")
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
      supabase
        .from("planned_workouts")
        .select("date, tss_target, duration_minutes, kcal_target, type")
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
      resolveAthleteMemory(athleteId),
    ]);

    const error = executedError?.message ?? plannedError?.message ?? null;
    if (error) return NextResponse.json({ error, rows: [] }, { status: 500, headers: NO_STORE });
    const rows = (executedData ?? []) as Array<Record<string, unknown>>;
    const plannedRows = (plannedData ?? []) as PlannedWorkoutAnalyticsRow[];
    const series = computeDailyLoadSeries(rows as ExecutedWorkoutLoadRow[]);
    const compareSeries = buildCompareSeries(from, to, plannedRows, series);
    const latest = series.at(-1) ?? null;
    const twinState = athleteMemory.twin;
    const last7 = summarizeWindow(series, 7);
    const last28 = summarizeWindow(series, 28);
    const planLast7 = summarizePlanWindow(compareSeries, 7);
    const planLast28 = summarizePlanWindow(compareSeries, 28);
    let recoverySummary: Awaited<ReturnType<typeof resolveLatestRecoverySummary>> = null;
    try {
      recoverySummary = await resolveLatestRecoverySummary(athleteId);
    } catch {
      recoverySummary = null;
    }
    const adaptationGuidance = buildAdaptationGuidance({
      expectedAdaptation: twinState?.expectedAdaptation ?? twinState?.adaptationScore ?? 0,
      observedAdaptation: twinState?.realAdaptation ?? twinState?.adaptationScore ?? 0,
      likelyDrivers: twinState?.likelyDrivers ?? [],
    });
    const operationalContext = buildTrainingDayOperationalContext({
      recoveryStatus: recoverySummary?.status ?? "unknown",
      trafficLight: adaptationGuidance.trafficLight,
      keepProgramUnchanged: adaptationGuidance.keepProgramUnchanged,
      reductionMinPct: adaptationGuidance.reductionMinPct,
      reductionMaxPct: adaptationGuidance.reductionMaxPct,
    });
    const adaptationLoop = await resolveAdaptationRegenerationLoop({
      athleteId,
      twinState,
      recoverySummary,
      operationalContext,
    });
    const bioenergeticModulation =
      athleteMemory.physiology && twinState
        ? buildBioenergeticModulation({
            physiologyState: athleteMemory.physiology,
            twinState,
            recoverySummary,
          })
        : null;

    return NextResponse.json(
      {
        athleteId,
        from,
        to,
        rows,
        plannedRows,
        series,
        compareSeries,
        latest,
        windows: {
          last7,
          last28,
          couplingDelta: last7.coupling - last28.coupling,
        },
        planWindows: {
          last7: planLast7,
          last28: planLast28,
        },
        adaptationLoop,
        twinState,
        athleteMemory,
        recoverySummary,
        operationalContext,
        bioenergeticModulation,
        source: "analytics_v3_planned_real_internal_external",
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof TrainingRouteAuthError) {
      return NextResponse.json({ error: err.message, rows: [] }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Training analytics API error";
    return NextResponse.json({ error: message, rows: [] }, { status: 500, headers: NO_STORE });
  }
}
