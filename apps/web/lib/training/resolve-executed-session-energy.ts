const POWER_KEYS = ["power_avg_w", "avg_power_w", "avg_power", "normalized_power_w", "np_w", "weighted_avg_power"];
const POWER_SERIES_KEYS = ["power_series_w", "power_stream_w", "power_series"];
const KCAL_KEYS = ["kcal", "calories", "active_kilocalories", "activeCalories", "energy_kcal"];
const KJ_KEYS = ["kj", "work_kj", "work_kJ"];

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

function pickSeries(trace: Record<string, unknown> | null | undefined, keys: string[]): number[] {
  if (!trace) return [];
  for (const key of keys) {
    const v = trace[key];
    if (Array.isArray(v)) {
      const nums = v.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
      if (nums.length >= 2) return nums;
    }
  }
  return [];
}

function avgFromSeries(series: number[]): number | null {
  const f = series.filter((v) => Number.isFinite(v) && v > 0);
  if (!f.length) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

/** kcal da colonna, trace, kJ o stima da potenza × durata. */
export function resolveExecutedKcal(input: {
  storedKcal?: number | null;
  storedKj?: number | null;
  durationMinutes: number;
  traceSummary?: Record<string, unknown> | null;
  avgPowerW?: number | null;
}): number {
  const stored = Number(input.storedKcal ?? 0);
  if (stored > 0) return Math.round(stored);

  const tr = input.traceSummary;
  const fromTrace = pickNum(tr, KCAL_KEYS);
  if (fromTrace != null && fromTrace > 0) return Math.round(fromTrace);

  const kj =
    Number(input.storedKj ?? 0) > 0
      ? Number(input.storedKj)
      : pickNum(tr, KJ_KEYS);
  if (kj != null && kj > 0) return Math.round(kj / 4.184);

  const power = input.avgPowerW ?? resolveExecutedAvgPowerW(input);
  const min = Math.max(0, input.durationMinutes);
  if (power != null && power > 0 && min > 0) {
    const kjEst = (power * min * 60) / 1000;
    return Math.round(kjEst / 4.184);
  }
  return 0;
}

/** Potenza media da trace o da kJ/durata. */
export function resolveExecutedAvgPowerW(input: {
  storedKj?: number | null;
  durationMinutes: number;
  traceSummary?: Record<string, unknown> | null;
}): number | null {
  const tr = input.traceSummary;
  const fromScalar = pickNum(tr, POWER_KEYS);
  if (fromScalar != null && fromScalar > 0) return Math.round(fromScalar);

  const series = pickSeries(tr, POWER_SERIES_KEYS);
  const fromSeries = avgFromSeries(series);
  if (fromSeries != null && fromSeries > 0) return Math.round(fromSeries);

  const kj = Number(input.storedKj ?? 0) > 0 ? Number(input.storedKj) : pickNum(tr, KJ_KEYS);
  const min = Math.max(0, input.durationMinutes);
  if (kj != null && kj > 0 && min > 0) {
    return Math.round((kj * 1000) / (min * 60));
  }
  return null;
}
