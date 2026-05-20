/**
 * Pure helper: data una `ExecutedWorkout`, costruisce il view-model per
 * `CalendarDaySessionDetail` (KPI hero, tabella secondaria min/avg/max e
 * serie pronte da grafico). Niente fetch: legge solo da `traceSummary` +
 * colonne canoniche già in `executed_workouts`.
 *
 * Allineato a `apps/web/lib/training/import-normalizer.ts` per le chiavi
 * canoniche e a `garmin-activity-materialize.ts` per il rimap Garmin.
 */

import type { ExecutedWorkout } from "@empathy/domain-training";
import {
  pickMetric,
  pickSeries,
  pickText,
  traceRecord,
} from "@/lib/training/calendar-analyzer-helpers";
import { resolveExecutedTrainingLoad } from "@/lib/training/infer-executed-training-load";
import {
  resolveExecutedAvgPowerW,
  resolveExecutedKcal,
} from "@/lib/training/resolve-executed-session-energy";
import type { SportGlyphId } from "@/lib/training/builder/sport-glyph-id";

export type SessionKpiTile = {
  label: string;
  value: string;
  unit?: string | null;
  accent?: "fuchsia" | "violet" | "orange" | "cyan" | "emerald" | "sky";
};

export type SessionSecondaryRow = {
  channel: string;
  label: string;
  unit: string;
  min: number | null;
  avg: number | null;
  max: number | null;
};

export type SessionSeriesBundle = {
  channel: SeriesChannel;
  unit: string;
  values: number[];
};

export type SeriesChannel =
  | "power"
  | "hr"
  | "speed"
  | "cadence"
  | "altitude"
  | "temperature";

export type SessionDetailViewModel = {
  workoutId: string;
  sport: string | null;
  sportGlyph: SportGlyphId | null;
  sourceLabel: string;
  /** Es. `garmin_wellness_api_summary` vs `gpx_native_parser` — per copy mappa / provenienza dati. */
  parserEngine: string | null;
  fileName: string | null;
  importQualityNote: string | null;
  kpi: SessionKpiTile[];
  secondary: SessionSecondaryRow[];
  series: SessionSeriesBundle[];
  hasAnySignal: boolean;
};

const SPORT_GLYPH_BY_KEYWORD: Array<{ match: RegExp; glyph: SportGlyphId }> = [
  { match: /\b(road|cycling|cycle|bike)\b/i, glyph: "roadBike" },
  { match: /mtb|mountain/i, glyph: "mtb" },
  { match: /gravel/i, glyph: "gravel" },
  { match: /triathlon|tri/i, glyph: "triathlon" },
  { match: /(run|trail|jog)/i, glyph: "runner" },
  { match: /swim/i, glyph: "swim" },
  { match: /(xc|nordic).*ski|skiing/i, glyph: "xcSki" },
  { match: /alpine|downhill/i, glyph: "alpine" },
  { match: /(canoe|kayak|row)/i, glyph: "canoe" },
  { match: /(gym|strength|weight|barbell)/i, glyph: "gym" },
  { match: /hyrox/i, glyph: "hyrox" },
  { match: /crossfit/i, glyph: "crossfit" },
];

/** Disciplina / type testuale → glifo calendario e dettaglio seduta. */
export function resolveSportGlyphFromSportString(sport: string | null | undefined): SportGlyphId | null {
  const s = (sport ?? "").trim();
  if (!s) return null;
  for (const entry of SPORT_GLYPH_BY_KEYWORD) {
    if (entry.match.test(s)) return entry.glyph;
  }
  return null;
}

function resolveSportGlyph(sport: string | null): SportGlyphId | null {
  return resolveSportGlyphFromSportString(sport);
}

function fmtNumber(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function fmtInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toString();
}

function clean(values: number[]): number[] {
  return values.filter((v) => Number.isFinite(v));
}

function statsFromSeries(values: number[]): { min: number | null; avg: number | null; max: number | null } {
  const f = clean(values);
  if (!f.length) return { min: null, avg: null, max: null };
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of f) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, avg: sum / f.length, max };
}

function pickStatsTriple(
  trace: Record<string, unknown> | null,
  series: number[],
  keys: { avg: string[]; min?: string[]; max?: string[] },
): { min: number | null; avg: number | null; max: number | null } {
  const seriesStats = series.length > 0 ? statsFromSeries(series) : null;
  const avg = pickMetric(trace, keys.avg) ?? seriesStats?.avg ?? null;
  const max = (keys.max ? pickMetric(trace, keys.max) : null) ?? seriesStats?.max ?? null;
  const min = (keys.min ? pickMetric(trace, keys.min) : null) ?? seriesStats?.min ?? null;
  return { min, avg, max };
}

function provenanceLabel(source: string | null | undefined, fileName: string | null): string {
  const s = (source ?? "").toLowerCase();
  if (s.startsWith("garmin")) return "Garmin";
  if (s.startsWith("strava")) return "Strava";
  if (s.startsWith("wahoo")) return "Wahoo";
  if (s === "manual" && fileName) return "Import manuale";
  if (s === "manual") return "Manuale";
  if (s === "other") return "Altro";
  return source ?? "Sconosciuta";
}

function pickImportQualityStatus(trace: Record<string, unknown> | null): string | null {
  if (!trace) return null;
  const top = pickText(trace, ["import_quality_status", "fit_quality_status"]);
  if (top) return top;
  const iq = trace.import_quality;
  if (iq && typeof iq === "object" && !Array.isArray(iq)) {
    const st = (iq as Record<string, unknown>).quality_status;
    if (typeof st === "string" && st.trim()) return st.trim();
  }
  return null;
}

function importQualityNote(trace: Record<string, unknown> | null): string | null {
  if (!trace) return null;
  const status = pickImportQualityStatus(trace);
  if (!status) return null;
  if (status === "OK") return null;
  if (status === "SPARSE") return "Campionamento sparso (smart recording).";
  if (status === "LIKELY_TRUNCATED") return "Traccia probabilmente troncata.";
  return status;
}

function buildKpiTiles(
  w: ExecutedWorkout,
  trace: Record<string, unknown> | null,
  powerStats: { avg: number | null },
  hrStats: { avg: number | null },
): SessionKpiTile[] {
  const distanceKm = pickMetric(trace, ["distance_km", "distanceKm", "km"]);
  const tiles: SessionKpiTile[] = [];

  tiles.push({
    label: "Durata",
    value: fmtInt(w.durationMinutes),
    unit: "min",
    accent: "cyan",
  });

  if (distanceKm != null) {
    tiles.push({
      label: "Distanza",
      value: fmtNumber(distanceKm, 2),
      unit: "km",
      accent: "fuchsia",
    });
  }

  const elevGain = pickMetric(trace, [
    "elevation_gain_m",
    "total_elevation_gain_m",
    "altitude_gain_m",
    "elev_gain_m",
    "ascent_m",
    "total_ascent",
    "elevationGain",
  ]);
  if (elevGain != null && elevGain > 0) {
    tiles.push({
      label: "Dislivello",
      value: fmtInt(elevGain),
      unit: "m",
      accent: "emerald",
    });
  }

  const trainingLoad = resolveExecutedTrainingLoad({
    storedTss: w.tss,
    durationMinutes: Math.max(0, Number(w.durationMinutes ?? 0)),
    traceSummary: trace,
    vendorLoad: pickMetric(trace, [
      "training_load",
      "trainingLoad",
      "training_load_score",
      "activity_training_load",
    ]),
  });
  tiles.push({
    label: "Carico",
    value: trainingLoad > 0 ? fmtInt(trainingLoad) : "—",
    accent: "violet",
  });

  if (w.kj != null) {
    tiles.push({
      label: "Lavoro",
      value: fmtInt(w.kj),
      unit: "kJ",
      accent: "orange",
    });
  }

  const kcalResolved = resolveExecutedKcal({
    storedKcal: w.kcal,
    storedKj: w.kj,
    durationMinutes: Math.max(0, Number(w.durationMinutes ?? 0)),
    traceSummary: trace,
    avgPowerW: powerStats.avg,
  });
  if (kcalResolved > 0) {
    tiles.push({
      label: "Energia",
      value: fmtInt(kcalResolved),
      unit: "kcal",
      accent: "orange",
    });
  }

  const powerAvg =
    powerStats.avg ??
    resolveExecutedAvgPowerW({
      storedKj: w.kj,
      durationMinutes: Math.max(0, Number(w.durationMinutes ?? 0)),
      traceSummary: trace,
    });
  if (powerAvg != null) {
    tiles.push({
      label: "Potenza media",
      value: fmtInt(powerAvg),
      unit: "W",
      accent: "fuchsia",
    });
  }

  if (hrStats.avg != null) {
    tiles.push({
      label: "FC media",
      value: fmtInt(hrStats.avg),
      unit: "bpm",
      accent: "emerald",
    });
  }

  return tiles;
}

const SECONDARY_DEFINITIONS = [
  {
    channel: "speed",
    label: "Velocità",
    unit: "km/h",
    seriesKeys: ["speed_series_kmh"],
    avg: ["speed_avg_kmh", "avg_speed_kmh", "avg_speed", "speed_kmh"],
    min: ["speed_min_kmh", "min_speed_kmh"],
    max: ["speed_max_kmh", "max_speed_kmh", "peak_speed_kmh"],
    digits: 1,
  },
  {
    channel: "cadence",
    label: "Cadenza",
    unit: "rpm",
    seriesKeys: ["cadence_series_rpm"],
    avg: ["cadence_avg_rpm", "avg_cadence_rpm", "avg_cadence"],
    min: ["cadence_min_rpm"],
    max: ["cadence_max_rpm", "max_cadence"],
    digits: 0,
  },
  {
    channel: "altitude",
    label: "Quota",
    unit: "m",
    seriesKeys: ["altitude_series_m", "route_altitude_series_m"],
    avg: ["altitude_avg_m", "avg_altitude"],
    min: ["altitude_min_m", "min_altitude"],
    max: ["altitude_max_m", "max_altitude", "peak_altitude_m"],
    digits: 0,
  },
  {
    channel: "temperature",
    label: "Temperatura",
    unit: "°C",
    seriesKeys: ["temperature_series_c"],
    avg: ["temperature_avg_c", "avg_temperature", "avg_temp"],
    min: ["temperature_min_c", "min_temperature"],
    max: ["temperature_max_c", "max_temperature"],
    digits: 1,
  },
  {
    channel: "hr",
    label: "FC",
    unit: "bpm",
    seriesKeys: ["hr_series_bpm"],
    avg: ["hr_avg_bpm", "avg_hr", "avg_heartrate"],
    min: ["hr_min_bpm", "min_hr"],
    max: ["hr_max_bpm", "max_hr", "max_heart_rate", "max_heartrate"],
    digits: 0,
  },
  {
    channel: "power",
    label: "Potenza",
    unit: "W",
    seriesKeys: ["power_series_w"],
    avg: ["power_avg_w", "power_avg", "avg_power", "weighted_avg_power"],
    min: ["power_min_w"],
    max: ["power_max_w", "max_power", "peak_power"],
    digits: 0,
  },
] as const;

function roundForDisplay(v: number | null, digits: number): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const factor = 10 ** digits;
  return Math.round(v * factor) / factor;
}

function buildSecondaryTable(trace: Record<string, unknown> | null): {
  rows: SessionSecondaryRow[];
  series: SessionSeriesBundle[];
} {
  const rows: SessionSecondaryRow[] = [];
  const series: SessionSeriesBundle[] = [];

  for (const def of SECONDARY_DEFINITIONS) {
    const ser = pickSeries(trace, [...def.seriesKeys]);
    const stats = pickStatsTriple(trace, ser, {
      avg: [...def.avg],
      min: def.min ? [...def.min] : undefined,
      max: def.max ? [...def.max] : undefined,
    });
    const hasAny = stats.min != null || stats.avg != null || stats.max != null || ser.length >= 1;
    if (!hasAny) continue;
    rows.push({
      channel: def.channel,
      label: def.label,
      unit: def.unit,
      min: roundForDisplay(stats.min, def.digits),
      avg: roundForDisplay(stats.avg, def.digits),
      max: roundForDisplay(stats.max, def.digits),
    });
    if (
      ser.length >= 1 &&
      (def.channel === "power" ||
        def.channel === "hr" ||
        def.channel === "speed" ||
        def.channel === "cadence" ||
        def.channel === "altitude" ||
        def.channel === "temperature")
    ) {
      const chartValues = ser.length >= 2 ? ser : [ser[0]!, ser[0]!];
      series.push({
        channel: def.channel as SeriesChannel,
        unit: def.unit,
        values: chartValues,
      });
    }
  }

  return { rows, series };
}

export function buildSessionDetailVM(workout: ExecutedWorkout): SessionDetailViewModel {
  const trace = traceRecord(workout);
  const sport =
    pickText(trace, ["sport", "activity_type", "activityType"]) ?? null;

  const powerSeries = pickSeries(trace, ["power_series_w"]);
  const hrSeries = pickSeries(trace, ["hr_series_bpm"]);
  const powerStats = pickStatsTriple(trace, powerSeries, {
    avg: ["power_avg_w", "power_avg", "avg_power", "weighted_avg_power"],
    min: ["power_min_w"],
    max: ["power_max_w", "max_power", "peak_power"],
  });
  const hrStats = pickStatsTriple(trace, hrSeries, {
    avg: ["hr_avg_bpm", "avg_hr", "avg_heartrate"],
    min: ["hr_min_bpm", "min_hr"],
    max: ["hr_max_bpm", "max_hr", "max_heart_rate", "max_heartrate"],
  });

  const kpi = buildKpiTiles(workout, trace, powerStats, hrStats);
  const { rows, series } = buildSecondaryTable(trace);

  const fileName = pickText(trace, ["imported_file_name"]);
  const sourceLabel = provenanceLabel(workout.source, fileName);
  const parserEngine = pickText(trace, ["parser_engine"]);
  const note = importQualityNote(trace);

  const hasAnySignal =
    rows.length > 0 ||
    series.length > 0 ||
    kpi.length > 2 || // sempre presenti durata + tss
    workout.kj != null ||
    workout.kcal != null;

  return {
    workoutId: workout.id,
    sport,
    sportGlyph: resolveSportGlyph(sport),
    sourceLabel,
    parserEngine,
    fileName,
    importQualityNote: note,
    kpi,
    secondary: rows,
    series,
    hasAnySignal,
  };
}
