import { DEFAULT_ATL_TAU_DAYS, ewmaDailyStep } from "./daily-load-ewma";
import { EMPATHY_LOAD_METHOD_VERSION } from "./empathy-infer-training-load";
import {
  computeStressCoreDaily,
  dailyCardioImpulseFromSessions,
  FORM_INT_EPSILON,
  meanFinite,
  stressCoreBaselinesFromHistory,
  type StressCoreBaselines,
} from "./empathy-stress-core-daily";

export { EMPATHY_LOAD_METHOD_VERSION };

export const FITNESS4_WINDOW_DAYS = 28;
export const FITNESS8_WINDOW_DAYS = 56;
export const STRAIN_TAU_DAYS = DEFAULT_ATL_TAU_DAYS;

export type EmpathyLoadSessionInput = {
  trainingLoad: number;
  durationMinutes: number;
  hrAvgBpm?: number | null;
};

export type EmpathyLoadWellnessInput = {
  hrvMs?: number | null;
  sleepHours?: number | null;
  restingHrBpm?: number | null;
  skinTempC?: number | null;
};

export type EmpathyLoadMetricsDayInput = {
  date: string;
  sessions: EmpathyLoadSessionInput[];
  wellness?: EmpathyLoadWellnessInput;
};

export type EmpathyDailyLoadPointV2 = {
  date: string;
  methodVersion: typeof EMPATHY_LOAD_METHOD_VERSION;
  /** Somma training load sedute (L_d). */
  trainingLoadDaily: number;
  strain: number;
  fitness4: number;
  fitness8: number;
  form: number;
  stressCore: number;
  fatigueInt: number;
  conditioningInt4: number;
  conditioningInt8: number;
  formInt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rollingMeanInclusive(values: number[], endIndex: number, windowDays: number): number {
  const start = Math.max(0, endIndex - windowDays + 1);
  let sum = 0;
  let count = 0;
  for (let i = start; i <= endIndex; i += 1) {
    sum += values[i] ?? 0;
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function buildWellnessBaselines(
  days: EmpathyLoadMetricsDayInput[],
  index: number,
): Pick<StressCoreBaselines, "hrvBaseline7" | "rhrBaseline7" | "tempBaseline7"> {
  const start = Math.max(0, index - 7);
  const slice = days.slice(start, index);
  return {
    hrvBaseline7: meanFinite(slice.map((d) => d.wellness?.hrvMs)),
    rhrBaseline7: meanFinite(slice.map((d) => d.wellness?.restingHrBpm)),
    tempBaseline7: meanFinite(slice.map((d) => d.wellness?.skinTempC)),
  };
}

/**
 * Serie giornaliera carico esterno + interno (V2).
 * Giorni vuoti nel range [first..last] inclusi con L=0.
 */
export function computeEmpathyLoadMetricsV2(
  days: EmpathyLoadMetricsDayInput[],
): EmpathyDailyLoadPointV2[] {
  const sorted = [...days]
    .filter((d) => typeof d.date === "string" && d.date.length >= 10)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!sorted.length) return [];

  const start = new Date(sorted[0].date + "T12:00:00.000Z");
  const end = new Date(sorted[sorted.length - 1].date + "T12:00:00.000Z");
  const dayCount = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));

  const byDate = new Map<string, EmpathyLoadMetricsDayInput>();
  for (const d of sorted) {
    byDate.set(d.date, d);
  }

  const calendarDays: EmpathyLoadMetricsDayInput[] = [];
  for (let i = 0; i <= dayCount; i += 1) {
    const date = toDateOnly(new Date(start.getTime() + i * DAY_MS));
    calendarDays.push(
      byDate.get(date) ?? {
        date,
        sessions: [],
        wellness: undefined,
      },
    );
  }

  const trainingLoadDaily: number[] = [];
  const cardioDaily: number[] = [];
  const stressCoreDaily: number[] = [];

  const historyLoads: Array<{ dailyTrainingLoad: number; dailyCardioImpulse: number }> = [];

  for (let i = 0; i < calendarDays.length; i += 1) {
    const day = calendarDays[i]!;
    const L = day.sessions.reduce((s, sess) => s + Math.max(0, sess.trainingLoad), 0);
    const cardio = dailyCardioImpulseFromSessions(
      day.sessions.map((s) => ({
        durationMinutes: s.durationMinutes,
        hrAvgBpm: s.hrAvgBpm,
      })),
    );
    trainingLoadDaily.push(L);
    cardioDaily.push(cardio);

    const p90 = stressCoreBaselinesFromHistory(historyLoads);
    const wellnessBase = buildWellnessBaselines(calendarDays, i);
    const baselines: StressCoreBaselines = {
      ...p90,
      ...wellnessBase,
    };
    const stressCore = computeStressCoreDaily(
      {
        dailyTrainingLoad: L,
        dailyCardioImpulse: cardio,
        hrvMs: day.wellness?.hrvMs,
        sleepHours: day.wellness?.sleepHours,
        restingHrBpm: day.wellness?.restingHrBpm,
        skinTempC: day.wellness?.skinTempC,
      },
      baselines,
    );
    stressCoreDaily.push(stressCore);
    historyLoads.push({ dailyTrainingLoad: L, dailyCardioImpulse: cardio });
    if (historyLoads.length > FITNESS8_WINDOW_DAYS) {
      historyLoads.shift();
    }
  }

  let strain = 0;
  let fatigueInt = 0;
  const out: EmpathyDailyLoadPointV2[] = [];

  for (let i = 0; i < calendarDays.length; i += 1) {
    const L = trainingLoadDaily[i] ?? 0;
    const sc = stressCoreDaily[i] ?? 0;
    strain = ewmaDailyStep(strain, L, STRAIN_TAU_DAYS);
    fatigueInt = ewmaDailyStep(fatigueInt, sc, STRAIN_TAU_DAYS);
    const fitness4 = rollingMeanInclusive(trainingLoadDaily, i, FITNESS4_WINDOW_DAYS);
    const fitness8 = rollingMeanInclusive(trainingLoadDaily, i, FITNESS8_WINDOW_DAYS);
    const conditioningInt4 = rollingMeanInclusive(stressCoreDaily, i, FITNESS4_WINDOW_DAYS);
    const conditioningInt8 = rollingMeanInclusive(stressCoreDaily, i, FITNESS8_WINDOW_DAYS);
    const form = fitness4 - strain;
    const formInt = conditioningInt4 / Math.max(FORM_INT_EPSILON, fatigueInt);

    out.push({
      date: calendarDays[i]!.date,
      methodVersion: EMPATHY_LOAD_METHOD_VERSION,
      trainingLoadDaily: L,
      strain,
      fitness4,
      fitness8,
      form,
      stressCore: sc,
      fatigueInt,
      conditioningInt4,
      conditioningInt8,
      formInt,
    });
  }

  return out;
}
