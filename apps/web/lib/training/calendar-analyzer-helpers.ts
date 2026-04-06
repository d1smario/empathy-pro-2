/**
 * Pure helpers for Training calendar analyzer (parity con V1 `TrainingCalendarPageView`).
 */

import type { ExecutedWorkout } from "@empathy/domain-training";

export function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

export function normalizeDateKey(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return raw.slice(0, 10);
}

export function pickMetric(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const k of keys) {
    const value = n(trace[k]);
    if (value != null) return value;
  }
  return null;
}

export function pickText(trace: Record<string, unknown> | null, keys: string[]): string | null {
  if (!trace) return null;
  for (const k of keys) {
    const v = trace[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

export function pickSeries(trace: Record<string, unknown> | null, keys: string[]): number[] {
  if (!trace) return [];
  for (const k of keys) {
    const raw = trace[k];
    if (!Array.isArray(raw)) continue;
    const values = raw.map((v) => n(v)).filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length > 1) return values;
  }
  return [];
}

export function traceRecord(w: ExecutedWorkout): Record<string, unknown> | null {
  const t = w.traceSummary;
  if (t && typeof t === "object") return t as Record<string, unknown>;
  return null;
}

export function workoutDayKey(row: ExecutedWorkout): string {
  const tr = traceRecord(row);
  const fromTrace = pickText(tr, ["session_day_key", "date_key", "workout_day_key"]);
  return normalizeDateKey(fromTrace ?? row.date);
}

export type FitQuality = {
  status: "OK" | "SPARSE" | "LIKELY_TRUNCATED";
  sourceFile: string | null;
  parserEngine: string | null;
  sourceFormat: string;
  recordCount: number;
  sessionCount: number;
  channelCoveragePct: Record<string, number>;
  note: string;
};

export function computeFitQuality(trace: Record<string, unknown> | null, durationMin: number | null): FitQuality | null {
  if (!trace) return null;
  const format = pickText(trace, ["source_format"]) ?? "unknown";
  const isFit = format === "fit";
  const isGpx = format === "gpx";
  if (!isFit && !isGpx) return null;
  const sourceFile = pickText(trace, ["imported_file_name"]);
  const parserEngine = pickText(trace, ["parser_engine", "parser_version"]);
  const rawCounts =
    trace.raw_counts && typeof trace.raw_counts === "object"
      ? (trace.raw_counts as Record<string, unknown>)
      : null;
  const recordCount = Math.max(
    0,
    Math.round(
      n(rawCounts?.records) ??
        n(trace.fit_record_messages) ??
        n(rawCounts?.points) ??
        n(trace.trackpoint_count) ??
        0,
    ),
  );
  const sessionCount = Math.max(0, Math.round(n(trace.fit_session_messages) ?? 1));
  const streamLens = {
    power: Math.max(Math.round(n(rawCounts?.power) ?? 0), pickSeries(trace, ["power_series_w"]).length),
    hr: Math.max(Math.round(n(rawCounts?.hr) ?? 0), pickSeries(trace, ["hr_series_bpm"]).length),
    speed: Math.max(Math.round(n(rawCounts?.speed) ?? 0), pickSeries(trace, ["speed_series_kmh"]).length),
    cadence: Math.max(Math.round(n(rawCounts?.cadence) ?? 0), pickSeries(trace, ["cadence_series_rpm"]).length),
    altitude: Math.max(Math.round(n(rawCounts?.altitude) ?? 0), pickSeries(trace, ["altitude_series_m"]).length),
  };
  const base = Math.max(1, recordCount);
  const coverage = {
    power: Math.round((streamLens.power / base) * 100),
    hr: Math.round((streamLens.hr / base) * 100),
    speed: Math.round((streamLens.speed / base) * 100),
    cadence: Math.round((streamLens.cadence / base) * 100),
    altitude: Math.round((streamLens.altitude / base) * 100),
  };
  const avgCoverage =
    (coverage.power + coverage.hr + coverage.speed + coverage.cadence + coverage.altitude) / 5;
  const expectedRecords =
    durationMin != null && durationMin > 0 ? Math.max(1, Math.round(durationMin * 60)) : null;
  const ratioVsExpected = expectedRecords != null ? recordCount / Math.max(1, expectedRecords) : null;

  let status: FitQuality["status"] = "OK";
  let note = isFit ? "Traccia FIT coerente." : "Traccia GPX coerente.";
  if (ratioVsExpected != null && ratioVsExpected < 0.12 && avgCoverage < 25) {
    status = "LIKELY_TRUNCATED";
    note = "Pochi record rispetto alla durata: file probabilmente troncato o export incompleto.";
  } else if (
    (isFit && (avgCoverage < 35 || (ratioVsExpected != null && ratioVsExpected < 0.2))) ||
    (isGpx && avgCoverage < 20)
  ) {
    status = "SPARSE";
    note = "Campionamento sparso (smart recording/export semplificato).";
  }

  return {
    status,
    sourceFile,
    parserEngine,
    sourceFormat: format,
    recordCount,
    sessionCount,
    channelCoveragePct: coverage,
    note,
  };
}

export function formatElapsedLabel(index: number, total: number, durationMin: number | null): string {
  if (!Number.isFinite(durationMin ?? NaN) || (durationMin ?? 0) <= 0 || total <= 1) return `sample ${index + 1}`;
  const totalSeconds = Math.max(1, Math.round((durationMin ?? 0) * 60));
  const sec = Math.round((index / Math.max(1, total - 1)) * totalSeconds);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function deriveSpeedKmh(distanceKm: number | null, durationMin: number | null): number | null {
  if (distanceKm == null || durationMin == null) return null;
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMin) || durationMin <= 0) return null;
  const speed = distanceKm / (durationMin / 60);
  return Number.isFinite(speed) ? speed : null;
}

export function resampleToLength(series: number[], targetLength: number): number[] {
  if (targetLength <= 0) return [];
  if (!series.length) return Array.from({ length: targetLength }, () => 0);
  if (series.length === targetLength) return series;
  if (series.length === 1) return Array.from({ length: targetLength }, () => series[0]);
  return Array.from({ length: targetLength }, (_, i) => {
    const pos = (i / Math.max(1, targetLength - 1)) * (series.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(series.length - 1, Math.ceil(pos));
    const w = pos - lo;
    return series[lo] * (1 - w) + series[hi] * w;
  });
}

function healDropouts(series: number[], threshold = 0.0001): number[] {
  if (series.length < 3) return series;
  const out = [...series];
  for (let i = 1; i < out.length - 1; i += 1) {
    const prev = out[i - 1];
    const cur = out[i];
    const next = out[i + 1];
    if (Math.abs(cur) <= threshold && Math.abs(prev) > threshold && Math.abs(next) > threshold) {
      out[i] = (prev + next) / 2;
    }
  }
  return out;
}

function healShortZeroGaps(series: number[], threshold: number, maxGapLen: number): number[] {
  if (series.length < 3) return series;
  const out = [...series];
  let i = 0;
  while (i < out.length) {
    if (Math.abs(out[i]) > threshold) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < out.length && Math.abs(out[i]) <= threshold) i += 1;
    const end = i - 1;
    const gapLen = end - start + 1;
    const leftIdx = start - 1;
    const rightIdx = i;
    if (
      gapLen <= maxGapLen &&
      leftIdx >= 0 &&
      rightIdx < out.length &&
      Math.abs(out[leftIdx]) > threshold &&
      Math.abs(out[rightIdx]) > threshold
    ) {
      const left = out[leftIdx];
      const right = out[rightIdx];
      for (let k = 0; k < gapLen; k += 1) {
        const t = (k + 1) / (gapLen + 1);
        out[start + k] = left + (right - left) * t;
      }
    }
  }
  return out;
}

export function movingAverage(series: number[], window: number): number[] {
  if (series.length <= 2 || window <= 1) return series;
  const half = Math.floor(window / 2);
  return series.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(series.length - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = from; j <= to; j += 1) {
      sum += series[j];
      count += 1;
    }
    return count > 0 ? sum / count : series[i];
  });
}

export function prepareDisplaySeries(
  series: number[],
  opts: { zeroThreshold: number; maxGapLen: number; smoothWindow: number },
): number[] {
  const a = healDropouts(series, opts.zeroThreshold);
  const b = healShortZeroGaps(a, opts.zeroThreshold, opts.maxGapLen);
  return movingAverage(b, opts.smoothWindow);
}

export function sanitizeSeriesForPlot(series: number[]): number[] {
  if (!series.length) return [];
  const out = [...series];
  for (let i = 0; i < out.length; i += 1) {
    if (!Number.isFinite(out[i])) out[i] = i > 0 ? out[i - 1] : 0;
  }
  let i = 0;
  while (i < out.length) {
    if (Math.abs(out[i]) > 1e-9) {
      i += 1;
      continue;
    }
    const start = i;
    while (i < out.length && Math.abs(out[i]) <= 1e-9) i += 1;
    const end = i - 1;
    const left = start - 1;
    const right = i;
    if (left >= 0 && right < out.length) {
      const a = out[left];
      const b = out[right];
      for (let k = 0; k <= end - start; k += 1) {
        const t = (k + 1) / (end - start + 2);
        out[start + k] = a + (b - a) * t;
      }
    } else if (left >= 0) {
      for (let k = start; k <= end; k += 1) out[k] = out[left];
    } else if (right < out.length) {
      for (let k = start; k <= end; k += 1) out[k] = out[right];
    }
  }
  return out;
}

function fillNonFiniteLinear(series: number[]): number[] {
  if (!series.length) return [];
  const out = [...series];
  for (let i = 0; i < out.length; i += 1) {
    if (Number.isFinite(out[i])) continue;
    let left = i - 1;
    while (left >= 0 && !Number.isFinite(out[left])) left -= 1;
    let right = i + 1;
    while (right < out.length && !Number.isFinite(out[right])) right += 1;
    if (left >= 0 && right < out.length) {
      const a = out[left];
      const b = out[right];
      const t = (i - left) / (right - left);
      out[i] = a + (b - a) * t;
    } else if (left >= 0) {
      out[i] = out[left];
    } else if (right < out.length) {
      out[i] = out[right];
    } else {
      out[i] = 0;
    }
  }
  return out;
}

export function prepareAltitudeSeries(series: number[], length: number): number[] {
  if (!series.length || length <= 0) return [];
  const aligned = resampleToLength(series, length);
  const finite = fillNonFiniteLinear(aligned);
  const smoothA = movingAverage(finite, 7);
  return movingAverage(smoothA, 5);
}

export function sanitizeAltitudeForPlot(series: number[]): number[] {
  return fillNonFiniteLinear(series);
}

export function buildDownsampleIndices(length: number, maxPoints: number): number[] {
  if (length <= maxPoints) return Array.from({ length }, (_, i) => i);
  if (maxPoints <= 2) return [0, length - 1];
  const idx: number[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    idx.push(Math.round((i / (maxPoints - 1)) * (length - 1)));
  }
  return Array.from(new Set(idx)).sort((a, b) => a - b);
}

export function parseRoute(trace: Record<string, unknown> | null): Array<[number, number]> {
  if (!trace) return [];
  const candidates = ["route_points", "route", "gps_points", "track"];
  for (const key of candidates) {
    const raw = trace[key];
    if (!Array.isArray(raw)) continue;
    const points = raw
      .map((item) => {
        if (typeof item !== "object" || item == null) return null;
        const row = item as Record<string, unknown>;
        const lat = n(row.lat ?? row.latitude);
        const lng = n(row.lng ?? row.lon ?? row.longitude);
        if (lat == null || lng == null) return null;
        return [lat, lng] as [number, number];
      })
      .filter((p): p is [number, number] => p != null);
    if (points.length >= 2) return points;
  }
  return [];
}

export function pickRouteElevationSeries(trace: Record<string, unknown> | null): number[] {
  if (!trace) return [];
  const candidates = ["route_points", "route", "gps_points", "track"];
  for (const key of candidates) {
    const raw = trace[key];
    if (!Array.isArray(raw)) continue;
    const values = raw
      .map((item) => {
        if (typeof item !== "object" || item == null) return null;
        const row = item as Record<string, unknown>;
        return n(row.ele ?? row.altitude ?? row.alt ?? null);
      })
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length >= 8) return values;
  }
  return [];
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeDistanceKm(route: Array<[number, number]>): number {
  if (route.length < 2) return 0;
  let km = 0;
  for (let i = 1; i < route.length; i += 1) km += haversineKm(route[i - 1], route[i]);
  return km;
}

export function buildSyntheticRoute(distanceKm: number): Array<[number, number]> {
  const centerLat = 45.4642;
  const centerLng = 9.19;
  const points = Math.max(16, Math.min(60, Math.round(distanceKm * 1.5) || 22));
  const radiusBase = Math.max(0.01, Math.min(0.04, distanceKm * 0.0018));
  return Array.from({ length: points }).map((_, idx) => {
    const t = idx / Math.max(1, points - 1);
    const theta = t * Math.PI * 2.2;
    const radius = radiusBase * (0.75 + 0.25 * Math.sin(t * Math.PI * 3));
    const lat = centerLat + radius * Math.cos(theta);
    const lng = centerLng + radius * Math.sin(theta) * 1.4;
    return [lat, lng];
  });
}

/** Finestre classici profilo potenza (stile marketing / MMP hexagon). */
export type PowerProfileWindow = { key: string; label: string; sec: number };

export const POWER_PROFILE_WINDOWS: PowerProfileWindow[] = [
  { key: "w5s", label: "5s", sec: 5 },
  { key: "w20s", label: "20s", sec: 20 },
  { key: "w60s", label: "60s", sec: 60 },
  { key: "w3m", label: "3m", sec: 180 },
  { key: "w12m", label: "12m", sec: 720 },
  { key: "w60m", label: "60m", sec: 3600 },
];

/** Media mobile massima su `windowSamples` campioni consecutivi. */
export function bestRollingAverage(series: number[], windowSamples: number): number | null {
  if (series.length < 2 || windowSamples < 1 || windowSamples > series.length) return null;
  let sum = 0;
  for (let i = 0; i < windowSamples; i += 1) sum += series[i];
  let best = sum;
  for (let i = windowSamples; i < series.length; i += 1) {
    sum += series[i] - series[i - windowSamples];
    if (sum > best) best = sum;
  }
  return best / windowSamples;
}

export function powerProfileFromSeries(
  series: number[],
  durationMinutes: number | null,
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): { key: string; label: string; watts: number | null }[] {
  const durMin = durationMinutes != null && durationMinutes > 0 ? durationMinutes : null;
  const durationSec = durMin != null ? durMin * 60 : null;
  if (series.length < 2 || durationSec == null || durationSec <= 0) {
    return windows.map((w) => ({ key: w.key, label: w.label, watts: null }));
  }
  const dt = durationSec / Math.max(1, series.length - 1);
  return windows.map((w) => {
    const span = Math.max(1, Math.round(w.sec / dt));
    const watts = bestRollingAverage(series, Math.min(span, series.length));
    return { key: w.key, label: w.label, watts: watts != null && watts > 0 ? watts : null };
  });
}

/** Massimi per finestra su tutti i workout del mese che hanno serie potenza. */
export function monthPeakPowerProfile(
  workouts: ExecutedWorkout[],
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): Map<string, number> {
  return monthPeakMetricProfile(workouts, ["power_series_w", "power_stream_w", "power_series"], windows);
}

/** Massimi rolling‑average per finestra su qualsiasi serie numerica (stessi assi temporali del radar potenza). */
export function monthPeakMetricProfile(
  workouts: ExecutedWorkout[],
  seriesKeys: string[],
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): Map<string, number> {
  const peaks = new Map<string, number>();
  for (const w of windows) peaks.set(w.key, 0);
  for (const row of workouts) {
    const tr = traceRecord(row);
    const series = pickSeries(tr, seriesKeys);
    if (series.length < 2) continue;
    const durMin = n(row.durationMinutes);
    const profile = powerProfileFromSeries(series, durMin, windows);
    for (const p of profile) {
      if (p.watts == null) continue;
      const cur = peaks.get(p.key) ?? 0;
      if (p.watts > cur) peaks.set(p.key, p.watts);
    }
  }
  return peaks;
}
