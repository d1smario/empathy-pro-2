import { empathyCardioImpulseDailyFromSession } from "./empathy-cardio-impulse-daily";

export const STRESS_CORE_WEIGHTS = {
  load: 0.35,
  hr: 0.25,
  hrv: 0.2,
  sleep: 0.12,
  rhr: 0.06,
  temp: 0.02,
} as const;

export const DEFAULT_TARGET_SLEEP_HOURS = 7.5;
export const FORM_INT_EPSILON = 1;

export type StressCoreDaySignals = {
  dailyTrainingLoad: number;
  dailyCardioImpulse: number;
  hrvMs?: number | null;
  sleepHours?: number | null;
  restingHrBpm?: number | null;
  skinTempC?: number | null;
};

export type StressCoreBaselines = {
  p90TrainingLoad56: number;
  p90CardioImpulse56: number;
  hrvBaseline7: number | null;
  rhrBaseline7: number | null;
  tempBaseline7: number | null;
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function percentile90(values: number[]): number {
  const sorted = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!sorted.length) return 1;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return Math.max(1, sorted[idx] ?? 1);
}

export function stressCoreBaselinesFromHistory(
  history: Array<{ dailyTrainingLoad: number; dailyCardioImpulse: number }>,
): Pick<StressCoreBaselines, "p90TrainingLoad56" | "p90CardioImpulse56"> {
  return {
    p90TrainingLoad56: percentile90(history.map((h) => h.dailyTrainingLoad)),
    p90CardioImpulse56: percentile90(history.map((h) => h.dailyCardioImpulse)),
  };
}

export function meanFinite(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function stressCoreComponents(
  signals: StressCoreDaySignals,
  baselines: StressCoreBaselines,
  targetSleepHours = DEFAULT_TARGET_SLEEP_HOURS,
): {
  sLoad: number;
  sHr: number;
  sHrv: number;
  sSleep: number;
  sRhr: number;
  sTemp: number;
} {
  const p90L = Math.max(1, baselines.p90TrainingLoad56);
  const p90Hr = Math.max(1, baselines.p90CardioImpulse56);

  const sLoad = clamp01(signals.dailyTrainingLoad / p90L);
  const sHr = clamp01(signals.dailyCardioImpulse / p90Hr);

  let sHrv = 0;
  if (
    signals.hrvMs != null &&
    Number.isFinite(signals.hrvMs) &&
    baselines.hrvBaseline7 != null &&
    baselines.hrvBaseline7 > 0
  ) {
    sHrv = clamp01((baselines.hrvBaseline7 - signals.hrvMs) / (0.15 * baselines.hrvBaseline7));
  }

  let sSleep = 0;
  if (signals.sleepHours != null && Number.isFinite(signals.sleepHours) && targetSleepHours > 0) {
    sSleep = clamp01((targetSleepHours - signals.sleepHours) / targetSleepHours);
  }

  let sRhr = 0;
  if (
    signals.restingHrBpm != null &&
    Number.isFinite(signals.restingHrBpm) &&
    baselines.rhrBaseline7 != null &&
    Number.isFinite(baselines.rhrBaseline7)
  ) {
    sRhr = clamp01((signals.restingHrBpm - baselines.rhrBaseline7) / 15);
  }

  let sTemp = 0;
  if (
    signals.skinTempC != null &&
    Number.isFinite(signals.skinTempC) &&
    baselines.tempBaseline7 != null &&
    Number.isFinite(baselines.tempBaseline7)
  ) {
    sTemp = clamp01(Math.abs(signals.skinTempC - baselines.tempBaseline7) / 1.5);
  }

  return { sLoad, sHr, sHrv, sSleep, sRhr, sTemp };
}

export function computeStressCoreDaily(
  signals: StressCoreDaySignals,
  baselines: StressCoreBaselines,
): number {
  const c = stressCoreComponents(signals, baselines);
  const w = STRESS_CORE_WEIGHTS;
  return (
    100 *
    (w.load * c.sLoad +
      w.hr * c.sHr +
      w.hrv * c.sHrv +
      w.sleep * c.sSleep +
      w.rhr * c.sRhr +
      w.temp * c.sTemp)
  );
}

export function dailyCardioImpulseFromSessions(
  sessions: Array<{ durationMinutes: number; hrAvgBpm?: number | null }>,
): number {
  let sum = 0;
  for (const s of sessions) {
    sum += empathyCardioImpulseDailyFromSession({
      durationMinutes: s.durationMinutes,
      hrAvgBpm: s.hrAvgBpm ?? null,
    });
  }
  return sum;
}
