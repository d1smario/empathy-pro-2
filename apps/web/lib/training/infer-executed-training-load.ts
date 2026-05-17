import { inferEmpathyTrainingLoadForSession } from "@empathy/domain-training";

const HR_KEYS = [
  "hr_avg_bpm",
  "avg_hr",
  "heart_rate_avg",
  "avg_heart_rate",
  "averageHeartRateInBeatsPerMinute",
];

const POWER_KEYS = ["power_avg_w", "avg_power_w", "avg_power", "normalized_power_w", "np_w"];

function pickNum(trace: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const v = trace[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/**
 * Training load per persistenza/display: usa colonna `tss` se > 0, altrimenti inferenza Empathy V2.
 */
export function resolveExecutedTrainingLoad(input: {
  storedTss?: number | null;
  durationMinutes: number;
  traceSummary?: Record<string, unknown> | null;
  vendorLoad?: number | null;
  ftpW?: number | null;
}): number {
  const stored = Number(input.storedTss ?? 0);
  if (stored > 0) return Math.round(stored);

  return inferEmpathyTrainingLoadForSession({
    vendorLoad: input.vendorLoad,
    durationMinutes: Math.max(0, input.durationMinutes),
    hrAvgBpm: pickNum(input.traceSummary ?? null, HR_KEYS),
    avgPowerW: pickNum(input.traceSummary ?? null, POWER_KEYS),
    ftpW: input.ftpW ?? null,
  });
}

/** Valore da scrivere su `executed_workouts.tss` in materialize/import. */
export function trainingLoadForExecutedPersist(input: {
  vendorLoad?: number | null;
  durationMinutes: number;
  traceSummary?: Record<string, unknown> | null;
  ftpW?: number | null;
}): number {
  return resolveExecutedTrainingLoad({
    storedTss: 0,
    durationMinutes: input.durationMinutes,
    traceSummary: input.traceSummary,
    vendorLoad: input.vendorLoad,
    ftpW: input.ftpW,
  });
}
