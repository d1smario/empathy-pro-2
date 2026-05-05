import type { ExecutedWorkoutLoadRow } from "@/lib/training/analytics/load-series";

function pickNum(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const k of keys) {
    const v = trace[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export type ExecutedVolumeRollup = {
  sessionCount: number;
  durationMinutes: number;
  tss: number;
  distanceKm: number;
  elevationGainM: number;
  kcal: number;
  kj: number;
};

export type RecoveryContinuousRollup = {
  avgRestingHrBpm: number | null;
  avgHrvRmssdMs: number | null;
  avgSleepHours: number | null;
  avgSkinTempC: number | null;
  sampleCount: number;
};

/**
 * Somma metriche volume su `executed_workouts` nella finestra analytics.
 * Distanza/dislivello provengono da `trace_summary` quando il parser li popola (import FIT/TCX/…).
 */
export function rollupExecutedVolumeFromLoadRows(rows: ExecutedWorkoutLoadRow[]): ExecutedVolumeRollup {
  let sessionCount = 0;
  let durationMinutes = 0;
  let tss = 0;
  let distanceKm = 0;
  let elevationGainM = 0;
  let kcal = 0;
  let kjExplicit = 0;
  let kjCount = 0;

  for (const row of rows) {
    sessionCount += 1;
    durationMinutes += Math.max(0, Number(row.duration_minutes ?? 0));
    tss += Math.max(0, Number(row.tss ?? 0));
    const tr = (row.trace_summary ?? null) as Record<string, unknown> | null;
    const distM = pickNum(tr, ["distance_m", "total_distance_m"]);
    const km =
      pickNum(tr, ["distance_km", "distanceKm", "km", "total_distance_km"]) ??
      (distM != null && distM > 0 ? distM / 1000 : null);
    if (km != null && km > 0) distanceKm += km;
    const el = pickNum(tr, [
      "elevation_gain_m",
      "elev_gain_m",
      "ascent_m",
      "total_ascent",
      "altitude_gain_m",
      "elevationGain",
    ]);
    if (el != null && el > 0) elevationGainM += el;
    const k = row.kcal != null && Number.isFinite(row.kcal) ? Math.max(0, row.kcal) : pickNum(tr, ["kcal", "active_kcal"]);
    if (k != null) kcal += k;
    const rowKj = pickNum(tr, ["kj", "work_kj", "total_work_kj"]);
    if (rowKj != null && rowKj > 0) {
      kjExplicit += rowKj;
      kjCount += 1;
    }
  }

  const kjFromKcal = kcal > 0 ? Math.round(kcal * 4.184 * 100) / 100 : 0;
  const kj = kjCount > 0 ? kjExplicit : kjFromKcal;

  return {
    sessionCount,
    durationMinutes,
    tss,
    distanceKm: Math.round(distanceKm * 100) / 100,
    elevationGainM: Math.round(elevationGainM),
    kcal: Math.round(kcal),
    kj: Math.round(kj * 100) / 100,
  };
}

export function rollupRecoveryContinuousFromLoadRows(rows: ExecutedWorkoutLoadRow[]): RecoveryContinuousRollup {
  let hrSum = 0;
  let hrN = 0;
  let hrvSum = 0;
  let hrvN = 0;
  let sleepSum = 0;
  let sleepN = 0;
  let skinTempSum = 0;
  let skinTempN = 0;
  let sampleCount = 0;
  for (const row of rows) {
    const tr = (row.trace_summary ?? null) as Record<string, unknown> | null;
    const hr = pickNum(tr, ["resting_hr_bpm", "resting_heart_rate", "rest_hr_bpm", "restingHeartRate"]);
    const hrv = pickNum(tr, ["hrv_rmssd_ms", "hrv_rmssd_milli", "hrv_rmssd", "rmssd"]);
    const sleepHoursDirect = pickNum(tr, ["sleep_hours", "total_sleep_hours", "sleep_duration_hours"]);
    const sleepSec = pickNum(tr, ["sleep_duration_sec", "sleep_seconds"]);
    const sleep = sleepHoursDirect ?? (sleepSec != null && sleepSec > 0 ? sleepSec / 3600 : null);
    const skinTemp = pickNum(tr, ["skin_temp_celsius", "temperature_avg_c", "avg_skin_temp_c"]);
    const hasAny = hr != null || hrv != null || sleep != null || skinTemp != null;
    if (!hasAny) continue;
    sampleCount += 1;
    if (hr != null) {
      hrSum += hr;
      hrN += 1;
    }
    if (hrv != null) {
      hrvSum += hrv;
      hrvN += 1;
    }
    if (sleep != null) {
      sleepSum += sleep;
      sleepN += 1;
    }
    if (skinTemp != null) {
      skinTempSum += skinTemp;
      skinTempN += 1;
    }
  }
  const avg = (sum: number, n: number, digits = 1) => (n > 0 ? Math.round((sum / n) * 10 ** digits) / 10 ** digits : null);
  return {
    avgRestingHrBpm: avg(hrSum, hrN, 1),
    avgHrvRmssdMs: avg(hrvSum, hrvN, 1),
    avgSleepHours: avg(sleepSum, sleepN, 2),
    avgSkinTempC: avg(skinTempSum, skinTempN, 2),
    sampleCount,
  };
}
