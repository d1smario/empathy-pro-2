import {
  POWER_PROFILE_WINDOWS,
  type PowerProfileWindow,
  bestRollingAverage,
  n,
  pickMetric,
  pickRouteElevationSeries,
  pickSeries,
} from "@/lib/training/calendar-analyzer-helpers";

const TIME_SERIES_KEYS = ["time_series_s", "elapsed_time_series_s", "time_stream_s"];

export type VamProfilePoint = { key: string; label: string; vamMh: number | null };

/** Chiavi canoniche quota (Garmin materialize, FIT import, Wahoo). */
export const ALTITUDE_SERIES_KEYS = [
  "altitude_series_m",
  "route_altitude_series_m",
  "altitude_series",
  "elevation_series_m",
  "enhanced_altitude_series_m",
];

/** Garmin: vertical_speed_series_mps derivato da quota + time_s. */
export const VERTICAL_SPEED_SERIES_KEYS = ["vertical_speed_series_mps", "vertical_speed_series"];

const ELEVATION_GAIN_KEYS = [
  "elevation_gain_m",
  "total_elevation_gain_m",
  "elev_gain_m",
  "ascent_m",
  "total_ascent",
];

export function pickAltitudeSeriesFromTrace(trace: Record<string, unknown> | null): number[] {
  if (!trace) return [];
  const direct = pickSeries(trace, ALTITUDE_SERIES_KEYS);
  const fromRoute = pickRouteElevationSeries(trace);
  if (direct.length >= 8) return direct;
  if (fromRoute.length > direct.length) return fromRoute;
  return direct.length >= 2 ? direct : fromRoute;
}

/** VAM (m/h) = dislivello positivo nella finestra / durata finestra. */
export function bestVamMhInAltitudeWindow(
  altitudeM: number[],
  windowSec: number,
  sampleDtSec: number,
): number | null {
  if (altitudeM.length < 2 || windowSec <= 0 || sampleDtSec <= 0) return null;
  const windowSamples = Math.max(2, Math.round(windowSec / sampleDtSec));
  if (altitudeM.length < windowSamples) return null;

  let bestVam = 0;
  for (let start = 0; start <= altitudeM.length - windowSamples; start += 1) {
    let gainM = 0;
    for (let i = start + 1; i < start + windowSamples; i += 1) {
      gainM += Math.max(0, altitudeM[i]! - altitudeM[i - 1]!);
    }
    const durSec = (windowSamples - 1) * sampleDtSec;
    if (durSec > 0 && gainM > 0) {
      const vam = (gainM / durSec) * 3600;
      if (vam > bestVam) bestVam = vam;
    }
  }
  return bestVam > 0 ? Math.round(bestVam) : null;
}

export function vamProfileFromAltitudeSeries(
  altitudeM: number[],
  durationMinutes: number | null,
  trace: Record<string, unknown> | null = null,
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): VamProfilePoint[] {
  const durMin = durationMinutes != null && durationMinutes > 0 ? durationMinutes : null;
  const sampleDtSec = sampleDtSecForSeries(trace, altitudeM.length, durMin);
  if (altitudeM.length < 2 || sampleDtSec == null || sampleDtSec <= 0) {
    return windows.map((w) => ({ key: w.key, label: w.label, vamMh: null }));
  }
  return windows.map((w) => ({
    key: w.key,
    label: w.label,
    vamMh: bestVamMhInAltitudeWindow(altitudeM, w.sec, sampleDtSec),
  }));
}

/** Δt tra campioni: preferisce `time_series_s` (allineato a Garmin) rispetto a durata/len. */
function sampleDtSecForSeries(
  trace: Record<string, unknown> | null,
  seriesLength: number,
  durationMinutes: number | null,
): number | null {
  if (seriesLength < 2) return null;
  const timeS = pickSeries(trace, TIME_SERIES_KEYS);
  if (timeS.length >= 2) {
    const span = timeS[timeS.length - 1]! - timeS[0]!;
    if (span > 0) return span / (seriesLength - 1);
  }
  const durMin = durationMinutes != null && durationMinutes > 0 ? durationMinutes : null;
  if (durMin != null) return (durMin * 60) / (seriesLength - 1);
  return null;
}

/** vertical_speed in m/s plausibile (esclude serie già in m/h o valori spuri). */
function verticalSpeedLooksLikeMps(values: number[]): boolean {
  const pos = values.filter((v) => v > 0);
  if (pos.length < 2) return false;
  const sorted = [...pos].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return median < 25;
}

function vamProfileFromVerticalSpeedSeries(
  verticalSpeedMps: number[],
  durationMinutes: number | null,
  trace: Record<string, unknown> | null,
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): VamProfilePoint[] {
  const positive = verticalSpeedMps.map((v) => Math.max(0, v));
  if (positive.length < 2 || !verticalSpeedLooksLikeMps(positive)) {
    return windows.map((w) => ({ key: w.key, label: w.label, vamMh: null }));
  }
  const dt = sampleDtSecForSeries(trace, positive.length, durationMinutes);
  if (dt == null || dt <= 0) {
    return windows.map((w) => ({ key: w.key, label: w.label, vamMh: null }));
  }
  return windows.map((w) => {
    const span = Math.max(1, Math.round(w.sec / dt));
    const avgMs = bestRollingAverage(positive, Math.min(span, positive.length));
    const vamMh = avgMs != null && avgMs > 0 ? Math.round(avgMs * 3600) : null;
    return { key: w.key, label: w.label, vamMh };
  });
}

function vamProfileFromElevationGainScalar(
  gainM: number,
  durationMinutes: number,
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): VamProfilePoint[] {
  const avgVam = durationMinutes > 0 ? Math.round((gainM / (durationMinutes * 60)) * 3600) : null;
  return windows.map((w) => ({
    key: w.key,
    label: w.label,
    vamMh: w.sec >= 300 && avgVam != null && avgVam > 0 ? avgVam : null,
  }));
}

/**
 * Profilo VAM da trace device (Garmin/Wahoo/FIT): vertical_speed → quota → dislivello scalare.
 */
/** VAM media salita (m/h) = dislivello positivo / ore di movimento. */
export function sessionAverageVamMh(
  trace: Record<string, unknown> | null,
  durationMinutes: number | null,
): number | null {
  const durMin = n(durationMinutes);
  if (durMin == null || durMin <= 0) return null;
  const gain = pickMetric(trace, ELEVATION_GAIN_KEYS);
  if (gain != null && gain > 0) {
    return Math.round(gain / (durMin / 60));
  }
  const altitude = pickAltitudeSeriesFromTrace(trace);
  if (altitude.length >= 2) {
    let gainM = 0;
    for (let i = 1; i < altitude.length; i += 1) {
      gainM += Math.max(0, altitude[i]! - altitude[i - 1]!);
    }
    if (gainM > 0) return Math.round(gainM / (durMin / 60));
  }
  return null;
}

export function vamProfileFromTrace(
  trace: Record<string, unknown> | null,
  durationMinutes: number | null,
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): VamProfilePoint[] {
  const durMin = n(durationMinutes);
  const vsp = pickSeries(trace, VERTICAL_SPEED_SERIES_KEYS);
  if (vsp.length >= 2 && verticalSpeedLooksLikeMps(vsp)) {
    const fromVsp = vamProfileFromVerticalSpeedSeries(vsp, durMin, trace, windows);
    if (fromVsp.some((p) => p.vamMh != null)) return fromVsp;
  }

  const altitude = pickAltitudeSeriesFromTrace(trace);
  if (altitude.length >= 2 && durMin != null && durMin > 0) {
    return vamProfileFromAltitudeSeries(altitude, durMin, trace, windows);
  }

  const gain = pickMetric(trace, ELEVATION_GAIN_KEYS);
  if (gain != null && gain > 0 && durMin != null && durMin > 0) {
    return vamProfileFromElevationGainScalar(gain, durMin, windows);
  }

  return windows.map((w) => ({ key: w.key, label: w.label, vamMh: null }));
}

/** Picchi VAM mensili per confronto radar (stessa logica del picco potenza). */
export function monthPeakVamProfile(
  workouts: Array<{ durationMinutes: number; traceSummary: Record<string, unknown> | null }>,
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): Map<string, number> {
  const peaks = new Map<string, number>();
  for (const w of windows) peaks.set(w.key, 0);
  for (const row of workouts) {
    const profile = vamProfileFromTrace(row.traceSummary, row.durationMinutes, windows);
    for (const p of profile) {
      if (p.vamMh == null) continue;
      peaks.set(p.key, Math.max(peaks.get(p.key) ?? 0, p.vamMh));
    }
  }
  return peaks;
}

/** Miglior VAM su tutte le finestre (etichetta + valore) per KPI giornaliero. */
/** Picco su finestre brevi (5s–60m); per salita media usare `sessionAverageVamMh`. */
export function sessionPeakVam(
  trace: Record<string, unknown> | null,
  durationMinutes: number | null,
): { label: string; vamMh: number } | null {
  const profile = vamProfileFromTrace(trace, durationMinutes);
  let best: { label: string; vamMh: number } | null = null;
  for (const p of profile) {
    if (p.vamMh == null) continue;
    if (!best || p.vamMh > best.vamMh) best = { label: p.label, vamMh: p.vamMh };
  }
  return best;
}
