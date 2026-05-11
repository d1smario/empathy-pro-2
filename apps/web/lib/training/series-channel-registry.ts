/**
 * Registry centrale dei canali HD persistiti in `executed_workout_series`.
 *
 * Single source of truth condiviso tra:
 *   - migration `045_executed_workout_series_v1.sql` + `050_executed_workout_series_route_distance.sql`
 *     (CHECK constraint sul nome canale)
 *   - `import-series-persist.ts` (write side)
 *   - `app/api/training/session-series/route.ts` (read side)
 *   - `session-detail-summary.ts` + UI `CalendarDaySessionDetail.tsx`
 *
 * Aggiungere un canale qui ⇒ aggiornare contestualmente:
 *   1. la migration (CHECK widening),
 *   2. il consumer UI (label/colore o componente dedicato per oggetti),
 *   3. l'extractor che lo popola (es. `extractGarminActivitySeries`).
 */

export type SeriesSampleShape = "scalar" | "geo_point";

export type SeriesChannelSpec = {
  channel: SeriesChannelId;
  unit: string;
  /** Forma di un singolo elemento `samples[i]`. `scalar` = number; `geo_point` = `{lat, lon, alt?}`. */
  shape: SeriesSampleShape;
  /** Chiavi accettate in `trace_summary` per ricostruire la serie (in ordine di preferenza). */
  traceKeys: string[];
  /** Etichetta human-readable (UI). */
  label: string;
};

export type SeriesChannelId =
  | "power"
  | "hr"
  | "speed"
  | "cadence"
  | "altitude"
  | "temperature"
  | "route"
  | "distance"
  | "time_elapsed"
  | "pace_min_per_km"
  | "vertical_speed_mps";

export const SERIES_CHANNEL_REGISTRY: SeriesChannelSpec[] = [
  { channel: "power", unit: "W", shape: "scalar", traceKeys: ["power_series_w"], label: "Potenza" },
  { channel: "hr", unit: "bpm", shape: "scalar", traceKeys: ["hr_series_bpm"], label: "FC" },
  { channel: "speed", unit: "km/h", shape: "scalar", traceKeys: ["speed_series_kmh"], label: "Velocità" },
  { channel: "cadence", unit: "rpm", shape: "scalar", traceKeys: ["cadence_series_rpm"], label: "Cadenza" },
  {
    channel: "altitude",
    unit: "m",
    shape: "scalar",
    traceKeys: ["altitude_series_m", "route_altitude_series_m"],
    label: "Quota",
  },
  { channel: "temperature", unit: "°C", shape: "scalar", traceKeys: ["temperature_series_c"], label: "Temperatura" },
  {
    channel: "route",
    unit: "lat,lon",
    shape: "geo_point",
    traceKeys: ["route_series_geo", "route_points"],
    label: "Percorso",
  },
  { channel: "distance", unit: "m", shape: "scalar", traceKeys: ["distance_series_m"], label: "Distanza" },
  { channel: "time_elapsed", unit: "s", shape: "scalar", traceKeys: ["time_series_s"], label: "Tempo" },
  {
    channel: "pace_min_per_km",
    unit: "min/km",
    shape: "scalar",
    traceKeys: ["pace_series_min_per_km"],
    label: "Pace",
  },
  {
    channel: "vertical_speed_mps",
    unit: "m/s",
    shape: "scalar",
    traceKeys: ["vertical_speed_series_mps"],
    label: "Velocità verticale",
  },
];

const REGISTRY_BY_CHANNEL = new Map<SeriesChannelId, SeriesChannelSpec>(
  SERIES_CHANNEL_REGISTRY.map((s) => [s.channel, s] as const),
);

export function getSeriesChannelSpec(channel: string): SeriesChannelSpec | null {
  return REGISTRY_BY_CHANNEL.get(channel as SeriesChannelId) ?? null;
}

export const ALL_SERIES_CHANNEL_IDS: ReadonlySet<SeriesChannelId> = new Set(
  SERIES_CHANNEL_REGISTRY.map((s) => s.channel),
);

export function isSeriesChannelId(value: string): value is SeriesChannelId {
  return ALL_SERIES_CHANNEL_IDS.has(value as SeriesChannelId);
}

export type GeoPoint = { lat: number; lon: number; alt?: number };

export function isGeoPoint(value: unknown): value is GeoPoint {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.lat === "number" &&
    Number.isFinite(r.lat) &&
    typeof r.lon === "number" &&
    Number.isFinite(r.lon) &&
    Math.abs(r.lat) <= 90 &&
    Math.abs(r.lon) <= 180
  );
}
