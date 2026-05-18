/**
 * Profili a finestre (MMP / VAM) per radar Analyzer — estrazione deterministica
 * da trace_summary + executed_workouts. Un radar per ogni canale presente nella registrazione.
 */

import type { ExecutedWorkout } from "@empathy/domain-training";
import {
  POWER_PROFILE_WINDOWS,
  type PowerProfileWindow,
  monthPeakMetricProfile,
  pickMetric,
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

export type SessionPeakMetricId =
  | "power"
  | "hr"
  | "cadence"
  | "speed"
  | "vam"
  | "lactate"
  | "glucose"
  | "smo2"
  | "temperature"
  | "core_temp"
  | "vo2"
  | "vco2";

export type SessionPeakMetricDef = {
  id: SessionPeakMetricId;
  label: string;
  unit: string;
  /** Serie temporale HD in trace_summary. */
  keys: string[];
  /** Max/avg in trace se manca la serie (profilo piatto sulle finestre). */
  scalarKeys?: string[];
  /** Campo canonico su ExecutedWorkout (es. lactateMmoll). */
  workoutField?: keyof Pick<ExecutedWorkout, "lactateMmoll" | "glucoseMmol" | "smo2">;
};

/** Ordine di visualizzazione in Analyzer (solo quelli con dati vengono renderizzati). */
export const SESSION_PEAK_METRIC_DEFS: SessionPeakMetricDef[] = [
  { id: "power", label: "Potenza", unit: "W", keys: ["power_series_w", "power_stream_w", "power_series"] },
  {
    id: "hr",
    label: "FC",
    unit: "bpm",
    keys: ["hr_series_bpm", "heart_rate_series_bpm", "heart_rate_series", "hr_stream_bpm", "hr_series"],
    scalarKeys: ["hr_max_bpm", "max_hr", "max_heart_rate", "hr_avg_bpm", "avg_hr", "average_heart_rate", "max_heart_rate"],
  },
  {
    id: "cadence",
    label: "Cadenza",
    unit: "rpm",
    keys: ["cadence_series_rpm", "cadence_series"],
    scalarKeys: ["cadence_max_rpm", "max_cadence_rpm", "cadence_avg_rpm", "avg_cadence_rpm"],
  },
  {
    id: "speed",
    label: "Velocità",
    unit: "km/h",
    keys: ["speed_series_kmh", "speed_stream_kmh", "speed_series"],
    scalarKeys: ["speed_max_kmh", "max_speed_kmh", "speed_avg_kmh", "avg_speed_kmh"],
  },
  { id: "vam", label: "VAM", unit: "m/h", keys: [] },
  {
    id: "lactate",
    label: "Lattato",
    unit: "mmol/L",
    keys: ["lactate_series_mmol_l", "lactate_series"],
    scalarKeys: ["lactate_max_mmol_l", "lactate_peak_mmol_l", "lactate_avg_mmol_l"],
    workoutField: "lactateMmoll",
  },
  {
    id: "glucose",
    label: "Glucosio",
    unit: "mmol/L",
    keys: ["glucose_series_mmol_l", "glucose_series"],
    scalarKeys: ["glucose_max_mmol_l", "glucose_avg_mmol_l"],
    workoutField: "glucoseMmol",
  },
  {
    id: "smo2",
    label: "SmO₂",
    unit: "%",
    keys: ["smo2_series_pct", "smo2_series"],
    scalarKeys: ["smo2_min_pct", "smo2_avg_pct"],
    workoutField: "smo2",
  },
  {
    id: "temperature",
    label: "Temperatura",
    unit: "°C",
    keys: ["temperature_series_c", "temp_series_c"],
    scalarKeys: ["temperature_max_c", "temperature_avg_c", "temp_avg_c"],
  },
  {
    id: "core_temp",
    label: "Core temp",
    unit: "°C",
    keys: ["core_temp_series_c", "core_temperature_series_c"],
    scalarKeys: ["core_temp_max_c", "core_temperature_max_c"],
  },
  {
    id: "vo2",
    label: "VO₂",
    unit: "ml/kg/min",
    keys: ["vo2_series_ml_kg_min", "vo2_series_l_min", "vo2_series", "oxygen_uptake_series"],
    scalarKeys: ["vo2_max_ml_kg_min", "vo2_avg_ml_kg_min"],
  },
  {
    id: "vco2",
    label: "VCO₂",
    unit: "L/min",
    keys: ["vco2_series_l_min", "vco2_series", "co2_output_series"],
    scalarKeys: ["vco2_max_l_min", "vco2_avg_l_min"],
  },
];

export type SessionPeakAnalysisProfile = {
  metricId: SessionPeakMetricId;
  label: string;
  unit: string;
  rows: RadarAxisRow[];
};

function workoutScalarValue(w: ExecutedWorkout, field?: SessionPeakMetricDef["workoutField"]): number | null {
  if (!field) return null;
  const raw = w[field];
  const v = n(raw);
  return v != null && v > 0 ? v : null;
}

function resolveSessionScalar(
  workout: ExecutedWorkout,
  trace: Record<string, unknown> | null,
  def: SessionPeakMetricDef,
): number | null {
  if (def.scalarKeys?.length) {
    const fromTrace = pickMetric(trace, def.scalarKeys);
    if (fromTrace != null && fromTrace > 0) return fromTrace;
  }
  return workoutScalarValue(workout, def.workoutField);
}

function monthPeakScalar(
  workouts: ExecutedWorkout[],
  def: SessionPeakMetricDef,
): number {
  let peak = 0;
  for (const row of workouts) {
    const tr = traceRecord(row);
    const series = pickSeries(tr, def.keys);
    if (series.length >= 2) {
      const durMin = n(row.durationMinutes);
      const profile = powerProfileFromSeries(series, durMin);
      for (const p of profile) {
        if (p.watts != null && p.watts > peak) peak = p.watts;
      }
    }
    const scalar = resolveSessionScalar(row, tr, def);
    if (scalar != null && scalar > peak) peak = scalar;
  }
  return peak;
}

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

function radarRowsFromScalarPeak(
  sessionValue: number,
  monthPeak: number,
  unit: string,
  windows: PowerProfileWindow[] = POWER_PROFILE_WINDOWS,
): RadarAxisRow[] {
  const mp = Math.max(monthPeak, sessionValue);
  return windows.map((w) => ({
    subject: w.label,
    pct: mp > 0 ? (sessionValue / mp) * 100 : 0,
    sessionW: sessionValue,
    monthPeakW: mp > 0 ? mp : null,
    unit,
  }));
}

function buildRollingPeakProfile(
  primary: ExecutedWorkout,
  monthExecuted: ExecutedWorkout[],
  def: SessionPeakMetricDef,
  series: number[],
): SessionPeakAnalysisProfile {
  const dur = n(primary.durationMinutes);
  const sessionProfile = powerProfileFromSeries(series, dur);
  const peaks = monthPeakMetricProfile(monthExecuted, def.keys);
  return {
    metricId: def.id,
    label: def.label,
    unit: def.unit,
    rows: radarRowsFromSessionAndPeaks(sessionProfile, peaks, def.unit),
  };
}

function buildScalarPeakProfile(
  primary: ExecutedWorkout,
  monthExecuted: ExecutedWorkout[],
  def: SessionPeakMetricDef,
  sessionValue: number,
): SessionPeakAnalysisProfile {
  const monthPeak = monthPeakScalar(monthExecuted, def);
  return {
    metricId: def.id,
    label: def.label,
    unit: def.unit,
    rows: radarRowsFromScalarPeak(sessionValue, monthPeak, def.unit),
  };
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

  const series = pickSeries(tr, metric.keys);
  if (series.length >= 2) {
    return buildRollingPeakProfile(primary, monthExecuted, metric, series);
  }

  const scalar = resolveSessionScalar(primary, tr, metric);
  if (scalar != null) {
    return buildScalarPeakProfile(primary, monthExecuted, metric, scalar);
  }

  return null;
}

/** Tutti i radar per canali presenti nella seduta principale (potenza, FC, rpm, VAM, lattato, …). */
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

/** Elenco id metriche disponibili (per diagnostica / copy UI). */
export function listAvailablePeakMetricIds(
  primary: ExecutedWorkout,
  monthExecuted: ExecutedWorkout[],
): SessionPeakMetricId[] {
  return buildAllSessionPeakAnalysisProfiles(primary, monthExecuted).map((p) => p.metricId);
}
