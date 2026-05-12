import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseTrainingFile } from "@/lib/training/import-parser";
import { persistExecutedWorkoutSeriesFromTrace } from "@/lib/training/import-series-persist";
import { type GeoPoint, isGeoPoint } from "@/lib/training/series-channel-registry";

/** Chiavi serie HD da file (FIT/GPX/TCX) da fondere su `trace_summary` senza sovrascrivere il summary Garmin. */
const TRACE_SERIES_OVERLAY_KEYS = [
  "route_series_geo",
  "route_points",
  "power_series_w",
  "hr_series_bpm",
  "speed_series_kmh",
  "cadence_series_rpm",
  "altitude_series_m",
  "temperature_series_c",
  "distance_series_m",
  "time_series_s",
  "pace_series_min_per_km",
  "vertical_speed_series_mps",
  "route_distance_series_km",
  "route_altitude_series_m",
] as const;

function extractActivityFileId(callbackUrl: string): string | null {
  try {
    const u = new URL(callbackUrl);
    const id =
      u.searchParams.get("id") ??
      u.searchParams.get("summaryId") ??
      u.searchParams.get("activityId") ??
      u.searchParams.get("summaryID");
    const t = id?.trim();
    return t && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

function normalizeRoutePointsToGeo(trace: Record<string, unknown>): GeoPoint[] {
  const direct = trace.route_series_geo;
  if (Array.isArray(direct)) {
    const out: GeoPoint[] = [];
    for (const p of direct) {
      if (isGeoPoint(p)) out.push({ lat: p.lat, lon: p.lon, ...(typeof p.alt === "number" ? { alt: p.alt } : {}) });
    }
    if (out.length >= 1) return out;
  }

  const rp = trace.route_points;
  if (!Array.isArray(rp) || rp.length === 0) return [];

  const out: GeoPoint[] = [];
  for (const p of rp) {
    if (isGeoPoint(p)) {
      out.push({
        lat: p.lat,
        lon: p.lon,
        ...(typeof p.alt === "number" && Number.isFinite(p.alt) ? { alt: p.alt } : {}),
      });
      continue;
    }
    if (Array.isArray(p) && p.length >= 2) {
      const lat = typeof p[0] === "number" ? p[0] : Number(p[0]);
      const lon = typeof p[1] === "number" ? p[1] : Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        out.push({ lat, lon });
      }
    }
  }
  return out;
}

function mergeTraceSeriesOverlay(
  previous: Record<string, unknown>,
  parsedTrace: Record<string, unknown>,
  routeGeo: GeoPoint[],
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...previous };
  for (const k of TRACE_SERIES_OVERLAY_KEYS) {
    if (k === "route_series_geo") continue;
    if (k in parsedTrace && parsedTrace[k] != null) merged[k] = parsedTrace[k];
  }
  if (routeGeo.length >= 1) {
    merged.route_series_geo = routeGeo;
  }
  const at = new Date().toISOString();
  merged.garmin_binary_route_enriched_at = at;
  merged.garmin_binary_enrich = {
    status: "ok" as const,
    at,
    route_points: routeGeo.length,
  };
  return merged;
}

function parsedTraceHasNonRouteHdSeries(parsedTrace: Record<string, unknown>): boolean {
  for (const k of TRACE_SERIES_OVERLAY_KEYS) {
    if (k === "route_series_geo") continue;
    const v = parsedTrace[k];
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return true;
  }
  return false;
}

async function recordGarminBinaryEnrichDiagnostic(input: {
  supabase: SupabaseClient;
  workoutId: string;
  prev: Record<string, unknown>;
  status: "parse_error" | "no_geo_no_hd_series" | "update_failed";
  message?: string;
}): Promise<void> {
  const at = new Date().toISOString();
  const next: Record<string, unknown> = {
    ...input.prev,
    garmin_binary_enrich: {
      status: input.status,
      at,
      ...(input.message ? { message: input.message.slice(0, 800) } : {}),
    },
  };
  await input.supabase.from("executed_workouts").update({ trace_summary: next }).eq("id", input.workoutId);
}

/**
 * Dopo archiviazione blob `activityFile` (FIT/GPX/TCX), estrae percorso e serie HD
 * e le associa al `executed_workouts` già creato dal summary (`external_id` = `garmin_api:<id>`).
 * In caso di errore o assenza traccia, scrive `trace_summary.garmin_binary_enrich` per diagnostica (non silenzioso).
 */
export async function tryEnrichExecutedWorkoutFromGarminBinaryBlob(input: {
  supabase: SupabaseClient;
  athleteId: string;
  callbackUrl: string;
  buffer: Buffer;
  extension: string;
  contentType: string | null;
}): Promise<void> {
  const extRaw = input.extension.trim().toLowerCase();
  const activityId = extractActivityFileId(input.callbackUrl);
  if (!activityId) return;

  const ext =
    extRaw === ".gpx" || extRaw === ".tcx" || extRaw === ".fit" || extRaw === ".xml" || extRaw === ".bin"
      ? extRaw
      : null;
  if (!ext) return;

  const externalId = `garmin_api:${activityId}`;

  const { data: row, error } = await input.supabase
    .from("executed_workouts")
    .select("id, trace_summary")
    .eq("athlete_id", input.athleteId)
    .eq("external_id", externalId)
    .maybeSingle();

  if (error || !row?.id) return;

  const prev =
    row.trace_summary && typeof row.trace_summary === "object" && !Array.isArray(row.trace_summary)
      ? (row.trace_summary as Record<string, unknown>)
      : {};

  const parseName =
    ext === ".bin" ? "garmin_activity.fit" : ext === ".xml" ? "garmin_activity.gpx" : `garmin_activity${ext}`;
  const mime =
    ext === ".gpx" || parseName.endsWith(".gpx")
      ? "application/gpx+xml"
      : ext === ".tcx"
        ? "application/vnd.garmin.tcx+xml"
        : "application/octet-stream";

  let parsed: Awaited<ReturnType<typeof parseTrainingFile>>;
  try {
    parsed = await parseTrainingFile({
      fileName: parseName,
      mimeType: mime,
      buffer: input.buffer,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordGarminBinaryEnrichDiagnostic({
      supabase: input.supabase,
      workoutId: row.id,
      prev,
      status: "parse_error",
      message: msg,
    });
    return;
  }

  const ts = parsed.traceSummary as Record<string, unknown>;
  const routeGeo = normalizeRoutePointsToGeo(ts);
  const hasHd = parsedTraceHasNonRouteHdSeries(ts);
  if (routeGeo.length < 1 && !hasHd) {
    await recordGarminBinaryEnrichDiagnostic({
      supabase: input.supabase,
      workoutId: row.id,
      prev,
      status: "no_geo_no_hd_series",
      message: "File parsato senza coordinate percorso né serie HR/potenza/velocità utilizzabili.",
    });
    return;
  }

  const merged = mergeTraceSeriesOverlay(prev, ts, routeGeo);

  const { error: updErr } = await input.supabase
    .from("executed_workouts")
    .update({ trace_summary: merged })
    .eq("id", row.id);
  if (updErr) {
    await recordGarminBinaryEnrichDiagnostic({
      supabase: input.supabase,
      workoutId: row.id,
      prev,
      status: "update_failed",
      message: updErr.message,
    });
    return;
  }

  try {
    await persistExecutedWorkoutSeriesFromTrace({
      db: input.supabase,
      athleteId: input.athleteId,
      executedWorkoutId: row.id,
      traceSummary: merged,
      parserEngine: (typeof prev.parser_engine === "string" ? prev.parser_engine : null) ?? "garmin_activity_file",
      parserVersion: String(prev.parser_version ?? "2"),
      source: "api_sync:garmin:activityFile",
    });
  } catch {
    /* tabella assente / RLS */
  }
}
