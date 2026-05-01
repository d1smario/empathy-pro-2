import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";
import { computeDailyLoadSeries, type ExecutedWorkoutLoadRow } from "@/lib/training/analytics/load-series";

type DbClient = SupabaseClient;

type PlannedRow = {
  id: string;
  date: string | null;
  type: string | null;
  duration_minutes: number | null;
  tss_target: number | null;
  kcal_target: number | null;
  kj_target: number | null;
};

type ExecutedRow = ExecutedWorkoutLoadRow & {
  id: string;
  planned_workout_id?: string | null;
  kcal?: number | null;
  kj?: number | null;
};

export type ExpectedObtainedStatus = "aligned" | "watch" | "adapt" | "recover";

export type ExpectedObtainedDelta = {
  athleteId: string;
  date: string;
  plannedWorkoutIds: string[];
  executedWorkoutIds: string[];
  expectedLoad: Record<string, unknown>;
  obtainedLoad: Record<string, unknown>;
  internalResponse: Record<string, unknown>;
  delta: Record<string, unknown>;
  readiness: Record<string, unknown>;
  adaptationHint: Record<string, unknown>;
  status: ExpectedObtainedStatus;
};

export type { PriorDaySnapshot } from "@/lib/training/expected-vs-obtained-loop-closure";
export { attachLoopClosureHints, buildLoopClosureHint } from "@/lib/training/expected-vs-obtained-loop-closure";

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const base = new Date(`${dateIso}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return toDateOnly(base);
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumBy<T>(rows: T[], pick: (row: T) => number | null | undefined): number {
  return rows.reduce((sum, row) => sum + Math.max(0, pick(row) ?? 0), 0);
}

function buildReadiness(deviceRows: Array<Record<string, unknown>>, targetDate: string) {
  const signals = deviceRows.map(extractSignalFromDeviceExportRow);
  const recent = signals.filter((signal) => {
    if (!signal.sourceDate) return true;
    return String(signal.sourceDate).slice(0, 10) <= targetDate;
  }).slice(-7);
  const hrvMs = average(recent.map((signal) => signal.hrvMs).filter((value): value is number => value != null));
  const restingHrBpm = average(recent.map((signal) => signal.restingHrBpm).filter((value): value is number => value != null));
  const sleepScore = average(recent.map((signal) => signal.sleepScore).filter((value): value is number => value != null));
  const readinessScore = average(
    recent.map((signal) => signal.readinessScore ?? signal.recoveryScore).filter((value): value is number => value != null),
  );
  const strainScore = average(recent.map((signal) => signal.strainScore).filter((value): value is number => value != null));
  const scoreInputs = [
    readinessScore,
    sleepScore,
    hrvMs != null ? clamp((hrvMs / 70) * 100, 0, 100) : null,
    restingHrBpm != null ? clamp(100 - Math.max(0, restingHrBpm - 45) * 2.2, 0, 100) : null,
    strainScore != null ? clamp(100 - strainScore, 0, 100) : null,
  ].filter((value): value is number => value != null);
  return {
    score: scoreInputs.length ? round(average(scoreInputs) ?? 50, 1) : 50,
    hrv_ms: hrvMs != null ? round(hrvMs, 1) : null,
    resting_hr_bpm: restingHrBpm != null ? round(restingHrBpm, 1) : null,
    sleep_score: sleepScore != null ? round(sleepScore, 1) : null,
    readiness_score: readinessScore != null ? round(readinessScore, 1) : null,
    strain_score: strainScore != null ? round(strainScore, 1) : null,
    source_days: recent.length,
  };
}

function adaptationFromDelta(input: {
  plannedTss: number;
  executedTss: number;
  internalLoad: number;
  plannedKcal: number;
  executedKcal: number;
  readinessScore: number;
  sessionTypes: string[];
}): { status: ExpectedObtainedStatus; hint: Record<string, unknown>; delta: Record<string, unknown> } {
  const tssDelta = round(input.executedTss - input.plannedTss, 1);
  const executionPct = input.plannedTss > 0 ? round((input.executedTss / input.plannedTss) * 100, 1) : input.executedTss > 0 ? 100 : 0;
  const internalExternalRatio = input.executedTss > 0 ? round(input.internalLoad / input.executedTss, 2) : input.internalLoad > 0 ? 1.5 : 0;
  const kcalDelta = round(input.executedKcal - input.plannedKcal, 1);
  const mismatchScore = clamp(
    Math.abs(executionPct - 100) * 0.45 +
      Math.max(0, internalExternalRatio - 1.12) * 45 +
      Math.max(0, 58 - input.readinessScore) * 0.75,
    0,
    100,
  );

  let status: ExpectedObtainedStatus = "aligned";
  let action = "keep_course";
  const reasons: string[] = [];
  if (input.readinessScore < 45 && (input.plannedTss > 0 || input.executedTss > 0)) {
    status = "recover";
    action = "protect_recovery";
    reasons.push("readiness_low");
  } else if (mismatchScore >= 32 || executionPct >= 125 || internalExternalRatio >= 1.35) {
    status = "adapt";
    action = "retune_next_session_and_fueling";
    reasons.push("planned_obtained_mismatch");
  } else if (mismatchScore >= 16 || executionPct <= 80 || input.readinessScore < 60) {
    status = "watch";
    action = "monitor_and_adjust_energy";
    reasons.push("watch_delta");
  }
  if (kcalDelta > 150) reasons.push("energy_cost_above_plan");
  if (kcalDelta < -150 && input.plannedKcal > 0) reasons.push("energy_cost_below_plan");

  return {
    status,
    delta: {
      tss_delta: tssDelta,
      execution_pct: executionPct,
      internal_external_ratio: internalExternalRatio,
      kcal_delta: kcalDelta,
      mismatch_score: round(mismatchScore, 1),
    },
    hint: {
      action,
      reasons,
      session_types: input.sessionTypes,
      training_adjustment:
        status === "recover"
          ? "reduce_or_recovery_focus"
          : status === "adapt"
            ? "retune_intensity_or_duration"
            : status === "watch"
              ? "keep_with_monitoring"
              : "no_change",
      nutrition_adjustment:
        kcalDelta > 150 || internalExternalRatio >= 1.2
          ? "increase_recovery_energy_and_redox_support"
          : kcalDelta < -150
            ? "reduce_excess_fueling_preserve_protein"
            : "maintain_current_targets",
    },
  };
}

export async function computeExpectedVsObtainedDeltas(input: {
  db: DbClient;
  athleteId: string;
  from: string;
  to: string;
}): Promise<ExpectedObtainedDelta[]> {
  const deviceFrom = addDays(input.from, -14);
  const [plannedRes, executedRes, deviceRes] = await Promise.all([
    input.db
      .from("planned_workouts")
      .select("id, date, type, duration_minutes, tss_target, kcal_target, kj_target")
      .eq("athlete_id", input.athleteId)
      .gte("date", input.from)
      .lte("date", input.to)
      .order("date", { ascending: true }),
    input.db
      .from("executed_workouts")
      .select("id, date, duration_minutes, tss, planned_workout_id, kcal, kj, trace_summary, lactate_mmoll, glucose_mmol, smo2")
      .eq("athlete_id", input.athleteId)
      .gte("date", input.from)
      .lte("date", input.to)
      .order("date", { ascending: true }),
    input.db
      .from("device_sync_exports")
      .select("provider, payload, created_at")
      .eq("athlete_id", input.athleteId)
      .gte("created_at", `${deviceFrom}T00:00:00.000Z`)
      .lte("created_at", `${input.to}T23:59:59.999Z`)
      .order("created_at", { ascending: true }),
  ]);

  if (plannedRes.error) throw new Error(plannedRes.error.message);
  if (executedRes.error) throw new Error(executedRes.error.message);
  if (deviceRes.error) throw new Error(deviceRes.error.message);

  const plannedRows = (plannedRes.data ?? []) as PlannedRow[];
  const executedRows = (executedRes.data ?? []) as ExecutedRow[];
  const deviceRows = (deviceRes.data ?? []) as Array<Record<string, unknown>>;
  const loadSeries = computeDailyLoadSeries(executedRows);
  const loadByDate = new Map(loadSeries.map((row) => [row.date, row]));
  const plannedDates = plannedRows.map((row) => row.date).filter((date): date is string => Boolean(date));
  const executedDates = executedRows.map((row) => row.date).filter((date): date is string => Boolean(date));
  const allDates = Array.from(new Set([...plannedDates, ...executedDates])).sort();

  return allDates.map((date) => {
    const planned = plannedRows.filter((row) => row.date === date);
    const executed = executedRows.filter((row) => row.date === date);
    const load = loadByDate.get(date);
    const readiness = buildReadiness(deviceRows, date);
    const plannedTss = sumBy(planned, (row) => asNum(row.tss_target));
    const executedTss = sumBy(executed, (row) => asNum(row.tss));
    const plannedKcal = sumBy(planned, (row) => asNum(row.kcal_target));
    const executedKcal = sumBy(executed, (row) => asNum(row.kcal));
    const adaptation = adaptationFromDelta({
      plannedTss,
      executedTss,
      internalLoad: load?.internal ?? 0,
      plannedKcal,
      executedKcal,
      readinessScore: asNum(readiness.score) ?? 50,
      sessionTypes: Array.from(new Set(planned.map((row) => String(row.type ?? "session")))),
    });

    return {
      athleteId: input.athleteId,
      date,
      plannedWorkoutIds: planned.map((row) => row.id),
      executedWorkoutIds: executed.map((row) => row.id),
      expectedLoad: {
        tss: round(plannedTss, 1),
        duration_minutes: round(sumBy(planned, (row) => asNum(row.duration_minutes)), 1),
        kcal: round(plannedKcal, 1),
        kj: round(sumBy(planned, (row) => asNum(row.kj_target)), 1),
      },
      obtainedLoad: {
        tss: round(executedTss, 1),
        duration_minutes: round(sumBy(executed, (row) => asNum(row.duration_minutes)), 1),
        kcal: round(executedKcal, 1),
        kj: round(sumBy(executed, (row) => asNum(row.kj)), 1),
      },
      internalResponse: {
        load: round(load?.internal ?? 0, 1),
        external_load: round(load?.external ?? 0, 1),
        i_ctl: round(load?.iCtl ?? 0, 1),
        i_atl: round(load?.iAtl ?? 0, 1),
        i_tsb: round(load?.iTsb ?? 0, 1),
      },
      delta: adaptation.delta,
      readiness,
      adaptationHint: adaptation.hint,
      status: adaptation.status,
    };
  });
}

export async function persistExpectedVsObtainedDeltas(input: {
  db: DbClient;
  deltas: ExpectedObtainedDelta[];
}): Promise<number> {
  if (!input.deltas.length) return 0;
  const rows = input.deltas.map((delta) => ({
    athlete_id: delta.athleteId,
    date: delta.date,
    planned_workout_ids: delta.plannedWorkoutIds,
    executed_workout_ids: delta.executedWorkoutIds,
    expected_load: delta.expectedLoad,
    obtained_load: delta.obtainedLoad,
    internal_response: delta.internalResponse,
    delta: delta.delta,
    readiness: delta.readiness,
    adaptation_hint: delta.adaptationHint,
    status: delta.status,
    source: "expected_vs_obtained_v1",
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await input.db.from("training_expected_obtained_deltas").upsert(rows, {
    onConflict: "athlete_id,date",
  });
  if (error) throw new Error(error.message);
  return rows.length;
}
