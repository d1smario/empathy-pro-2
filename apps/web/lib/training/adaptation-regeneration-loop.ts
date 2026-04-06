import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { TwinState } from "@/lib/empathy/schemas/twin";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { computeDailyLoadSeries, type ExecutedWorkoutLoadRow } from "@/lib/training/analytics/load-series";

type PlannedWorkoutLoopRow = {
  date: string | null;
  tss_target: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number) {
  const base = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return dateIso;
  base.setDate(base.getDate() + days);
  return toDateOnly(base);
}

function summarizePlanWindow(
  compareSeries: Array<{
    planned: number;
    executed: number;
    internal: number;
  }>,
) {
  const planned = compareSeries.reduce((sum, day) => sum + day.planned, 0);
  const executed = compareSeries.reduce((sum, day) => sum + day.executed, 0);
  const internal = compareSeries.reduce((sum, day) => sum + day.internal, 0);
  const compliancePct = planned > 0 ? (executed / planned) * 100 : executed > 0 ? 100 : 0;
  return {
    planned: round(planned, 1),
    executed: round(executed, 1),
    internal: round(internal, 1),
    delta: round(executed - planned, 1),
    compliancePct: round(compliancePct, 1),
  };
}

function buildCompareSeries(
  from: string,
  to: string,
  plannedRows: PlannedWorkoutLoopRow[],
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
  const out: Array<{ planned: number; executed: number; internal: number }> = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateOnly(cursor);
    const executed = executedByDate.get(date);
    out.push({
      planned: plannedByDate.get(date) ?? 0,
      executed: executed?.external ?? 0,
      internal: executed?.internal ?? 0,
    });
  }
  return out;
}

export type AdaptationRegenerationLoop = {
  windowDays: number;
  expectedLoad7d: number;
  realLoad7d: number;
  internalLoad7d: number;
  executionCompliancePct: number;
  executionDeltaTss: number;
  divergenceScore: number;
  interventionScore: number;
  readinessScore: number;
  adaptationScore: number;
  status: "aligned" | "watch" | "regenerate";
  nextAction: "keep_course" | "retune_next_sessions" | "regenerate_microcycle";
  triggers: string[];
  guidance: string;
};

export async function resolveAdaptationRegenerationLoop(input: {
  athleteId: string;
  twinState: TwinState | null;
  recoverySummary: RecoverySummary | null;
  operationalContext: TrainingDayOperationalContext | null;
}): Promise<AdaptationRegenerationLoop> {
  const supabase = createServerSupabaseClient();
  const today = toDateOnly(new Date());
  const from = addDays(today, -6);
  const to = today;

  const [{ data: executedData, error: executedError }, { data: plannedData, error: plannedError }] = await Promise.all([
    supabase
      .from("executed_workouts")
      .select("date, tss, duration_minutes, trace_summary, lactate_mmoll, glucose_mmol, smo2")
      .eq("athlete_id", input.athleteId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true }),
    supabase
      .from("planned_workouts")
      .select("date, tss_target")
      .eq("athlete_id", input.athleteId)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: true }),
  ]);

  if (executedError?.message || plannedError?.message) {
    throw new Error(executedError?.message ?? plannedError?.message ?? "Adaptation loop resolution failed");
  }

  const series = computeDailyLoadSeries((executedData ?? []) as ExecutedWorkoutLoadRow[]);
  const compareSeries = buildCompareSeries(from, to, (plannedData ?? []) as PlannedWorkoutLoopRow[], series);
  const planLast7 = summarizePlanWindow(compareSeries);

  const divergenceScore = round(
    clamp(
      input.twinState?.divergenceScore ?? Math.abs(planLast7.delta) * 0.5,
      0,
      100,
    ),
    1,
  );
  const readinessScore = round(clamp(input.twinState?.readiness ?? 0, 0, 100), 1);
  const adaptationScore = round(clamp(input.twinState?.adaptationScore ?? 0, 0, 100), 1);
  const interventionScore = round(clamp(input.twinState?.interventionScore ?? 0, 0, 100), 1);

  const triggers = [
    planLast7.compliancePct < 85 ? "execution_gap" : null,
    Math.abs(planLast7.delta) >= 20 ? "planned_real_mismatch" : null,
    divergenceScore >= 18 ? "adaptation_divergence" : null,
    input.recoverySummary?.status === "poor" ? "recovery_poor" : null,
    input.operationalContext?.mode === "protective" ? "protective_mode" : null,
    ...(input.twinState?.likelyDrivers ?? []),
  ].filter((item, index, arr): item is string => Boolean(item) && arr.indexOf(item) === index);

  let status: AdaptationRegenerationLoop["status"] = "aligned";
  let nextAction: AdaptationRegenerationLoop["nextAction"] = "keep_course";
  if (
    input.operationalContext?.mode === "protective" ||
    input.recoverySummary?.status === "poor" ||
    divergenceScore >= 25 ||
    planLast7.compliancePct < 70
  ) {
    status = "regenerate";
    nextAction = "regenerate_microcycle";
  } else if (divergenceScore >= 12 || planLast7.compliancePct < 90 || readinessScore < 60) {
    status = "watch";
    nextAction = "retune_next_sessions";
  }

  const guidance =
    status === "regenerate"
      ? "Planned vs real e stato adattivo non sono coerenti: rigenera il microciclo prossimo usando twin, recovery e bioenergetica come vincoli primari."
      : status === "watch"
        ? "Loop adattivo in osservazione: ritocca le prossime sedute e riallinea densita', intensita' e recupero sul delta recente."
        : "Loop coerente: planned, real e adattamento restano abbastanza allineati per proseguire senza rigenerazione.";

  return {
    windowDays: 7,
    expectedLoad7d: planLast7.planned,
    realLoad7d: planLast7.executed,
    internalLoad7d: planLast7.internal,
    executionCompliancePct: planLast7.compliancePct,
    executionDeltaTss: planLast7.delta,
    divergenceScore,
    interventionScore,
    readinessScore,
    adaptationScore,
    status,
    nextAction,
    triggers,
    guidance,
  };
}
