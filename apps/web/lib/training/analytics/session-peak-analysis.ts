/**
 * Profili a finestre (MMP / VAM) per radar Analyzer — estrazione deterministica
 * da trace_summary + executed_workouts, senza LLM.
 */

import type { ExecutedWorkout } from "@empathy/domain-training";
import {
  POWER_PROFILE_WINDOWS,
  monthPeakMetricProfile,
  pickSeries,
  powerProfileFromSeries,
  traceRecord,
  n,
} from "@/lib/training/calendar-analyzer-helpers";
import {
  monthPeakVamProfile,
  vamProfileFromTrace,
} from "@/lib/training/vam-from-trace";
import type { RadarAxisRow } from "@/components/training/TrainingPowerProfileRadar";

export type SessionPeakMetricId = "power" | "hr" | "cadence" | "speed" | "vam";

export type SessionPeakMetricDef = {
  id: SessionPeakMetricId;
  label: string;
  unit: string;
  keys: string[];
};

export const SESSION_PEAK_METRIC_DEFS: SessionPeakMetricDef[] = [
  { id: "power", label: "Potenza", unit: "W", keys: ["power_series_w", "power_stream_w", "power_series"] },
  {
    id: "hr",
    label: "FC",
    unit: "bpm",
    keys: ["hr_series_bpm", "heart_rate_series_bpm", "heart_rate_series", "hr_stream_bpm", "hr_series"],
  },
  { id: "cadence", label: "Cadenza", unit: "rpm", keys: ["cadence_series_rpm", "cadence_series"] },
  { id: "speed", label: "Velocità", unit: "km/h", keys: ["speed_series_kmh", "speed_stream_kmh", "speed_series"] },
  { id: "vam", label: "VAM", unit: "m/h", keys: [] },
];

export type SessionPeakAnalysisProfile = {
  metricId: SessionPeakMetricId;
  label: string;
  unit: string;
  rows: RadarAxisRow[];
};

function radarRowsFromSessionAndPeaks(
  sessionProfile: { key: string; label: string; watts: number | null }[],
  peaks: Map<string, number>,
  unit: string,
): RadarAxisRow[] {
  return POWER_PROFILE_WINDOWS.map((w) => {
    const sp = sessionProfile.find((p) => p.key === w.key);
    const s = sp?.watts ?? null;
    const peakStored = peaks.get(w.key) ?? 0;
    const mp = Math.max(peakStored, s ?? 0);
    const pct = mp > 0 && s != null ? (s / mp) * 100 : 0;
    return {
      subject: w.label,
      pct,
      sessionW: s,
      monthPeakW: mp > 0 ? mp : null,
      unit,
    };
  });
}

export function buildSessionPeakAnalysisProfile(
  primary: ExecutedWorkout,
  monthExecuted: ExecutedWorkout[],
  metric: SessionPeakMetricDef,
): SessionPeakAnalysisProfile | null {
  const tr = traceRecord(primary);
  const dur = n(primary.durationMinutes);

  if (metric.id === "vam") {
    const vamProf = vamProfileFromTrace(tr, dur);
    if (!vamProf.some((p) => p.vamMh != null)) return null;
    const sessionProfile = vamProf.map((p) => ({ key: p.key, label: p.label, watts: p.vamMh }));
    const peaks = monthPeakVamProfile(
      monthExecuted.map((w) => ({
        durationMinutes: n(w.durationMinutes) ?? 0,
        traceSummary: traceRecord(w),
      })),
    );
    return {
      metricId: metric.id,
      label: metric.label,
      unit: metric.unit,
      rows: radarRowsFromSessionAndPeaks(sessionProfile, peaks, metric.unit),
    };
  }

  const raw = pickSeries(tr, metric.keys);
  if (raw.length < 2) return null;
  const sessionProfile = powerProfileFromSeries(raw, dur);
  const peaks = monthPeakMetricProfile(monthExecuted, metric.keys);
  return {
    metricId: metric.id,
    label: metric.label,
    unit: metric.unit,
    rows: radarRowsFromSessionAndPeaks(sessionProfile, peaks, metric.unit),
  };
}

/** Tutti i radar disponibili per la seduta principale (potenza, FC, VAM, …). */
export function buildAllSessionPeakAnalysisProfiles(
  primary: ExecutedWorkout,
  monthExecuted: ExecutedWorkout[],
): SessionPeakAnalysisProfile[] {
  const out: SessionPeakAnalysisProfile[] = [];
  for (const def of SESSION_PEAK_METRIC_DEFS) {
    const profile = buildSessionPeakAnalysisProfile(primary, monthExecuted, def);
    if (profile) out.push(profile);
  }
  return out;
}
