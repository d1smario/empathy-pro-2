import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseTrainingFile } from "@/lib/training/import-parser";
import { persistExecutedWorkoutSeriesFromTrace } from "@/lib/training/import-series-persist";
import { upsertExecutedWorkoutByExternalId } from "@/lib/training/executed/upsert-executed-workout";
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

const GARMIN_TRACE_FALLBACK_SCAN_LIMIT = 100;

export type GarminBinaryEnrichRunSummary = {
  callback_activity_id: string | null;
  candidate_ids: string[];
  resolved_external_id: string | null;
  executed_workout_id: string | null;
  match?: "external_id_exact" | "trace_summary_fallback" | "inserted_from_activity_file";
  outcome:
    | "merged"
    | "inserted_from_file"
    | "no_executed_row"
    | "skipped_bad_extension"
    | "skipped_no_activity_id"
    | "parse_error"
    | "no_geo_no_hd_series"
    | "update_failed";
  message?: string;
};

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

function collectBareGarminActivityIdsForEnrich(
  callbackUrl: string,
  querySnapshot: Record<string, unknown> | null | undefined,
): string[] {
  const out: string[] = [];
  const push = (raw: unknown) => {
    if (raw == null) return;
    const s = String(raw).trim();
    if (s.length > 0 && !out.includes(s)) out.push(s);
  };
  push(extractActivityFileId(callbackUrl));
  if (querySnapshot && typeof querySnapshot === "object") {
    push(querySnapshot.summary_or_activity_id);
    push(querySnapshot.activityId);
    push(querySnapshot.activityID);
    push(querySnapshot.summaryId);
    push(querySnapshot.summaryID);
  }
  return out;
}

function traceSummaryReferencesBareGarminId(ts: Record<string, unknown>, bare: string): boolean {
  const norm = (v: unknown) => (v == null ? "" : String(v).trim());
  return norm(ts.activity_id) === bare || norm(ts.summary_id) === bare;
}

async function locateExecutedWorkoutForGarminBinary(input: {
  supabase: SupabaseClient;
  athleteId: string;
  bareIds: string[];
}): Promise<{
  id: string;
  trace_summary: unknown;
  resolvedExternalId: string;
  match: "external_id_exact" | "trace_summary_fallback";
} | null> {
  for (const bare of input.bareIds) {
    const externalId = `garmin_api:${bare}`;
    const { data: row, error } = await input.supabase
      .from("executed_workouts")
      .select("id, trace_summary, external_id")
      .eq("athlete_id", input.athleteId)
      .eq("external_id", externalId)
      .maybeSingle();
    if (!error && row?.id && row.external_id) {
      return {
        id: row.id,
        trace_summary: row.trace_summary,
        resolvedExternalId: String(row.external_id),
        match: "external_id_exact",
      };
    }
  }

  const { data: recent, error: e2 } = await input.supabase
    .from("executed_workouts")
    .select("id, trace_summary, external_id")
    .eq("athlete_id", input.athleteId)
    .like("external_id", "garmin_api:%")
    .order("created_at", { ascending: false })
    .limit(GARMIN_TRACE_FALLBACK_SCAN_LIMIT);

  if (e2 || !recent?.length) return null;

  for (const row of recent) {
    const ts =
      row.trace_summary && typeof row.trace_summary === "object" && !Array.isArray(row.trace_summary)
        ? (row.trace_summary as Record<string, unknown>)
        : {};
    for (const bare of input.bareIds) {
      if (traceSummaryReferencesBareGarminId(ts, bare) && row.id && row.external_id) {
        return {
          id: row.id,
          trace_summary: row.trace_summary,
          resolvedExternalId: String(row.external_id),
          match: "trace_summary_fallback",
        };
      }
    }
  }

  return null;
}

function pickPrimaryBareIdForGarminFileRow(bareIds: string[], callbackUrl: string): string | null {
  const urlId = extractActivityFileId(callbackUrl);
  if (urlId) return urlId;
  return bareIds[0] ?? null;
}

function coalesceActivityDateForGarminFileInsert(parsed: {
  date: string | null;
  traceSummary: Record<string, unknown>;
}): string {
  const d = parsed.date?.trim();
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const start = parsed.traceSummary.start_time;
  if (typeof start === "string" && start.length >= 10) {
    const t = new Date(start);
    if (Number.isFinite(t.getTime())) return t.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
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
 * Se la riga non esiste ma il file è decodificabile, **crea** la riga con `upsertExecutedWorkoutByExternalId`
 * (stesso contratto ingest training), così il FIT non resta orfano.
 * Risolve mismatch id URL vs riga (`query_snapshot`, fallback su `trace_summary.activity_id` / `summary_id`).
 * Restituisce un riepilogo da allegare a `garmin_pull_jobs.response_body`.
 */
export async function tryEnrichExecutedWorkoutFromGarminBinaryBlob(input: {
  supabase: SupabaseClient;
  athleteId: string;
  callbackUrl: string;
  buffer: Buffer;
  extension: string;
  contentType: string | null;
  querySnapshot?: Record<string, unknown> | null;
}): Promise<GarminBinaryEnrichRunSummary> {
  const bareIds = collectBareGarminActivityIdsForEnrich(input.callbackUrl, input.querySnapshot);
  const callbackActivityId = extractActivityFileId(input.callbackUrl);

  const baseMeta = (): Pick<GarminBinaryEnrichRunSummary, "callback_activity_id" | "candidate_ids"> => ({
    callback_activity_id: callbackActivityId,
    candidate_ids: bareIds,
  });

  if (bareIds.length === 0) {
    return {
      ...baseMeta(),
      resolved_external_id: null,
      executed_workout_id: null,
      outcome: "skipped_no_activity_id",
      message: "Nessun id attività in callback URL né in query_snapshot del job.",
    };
  }

  const extRaw = input.extension.trim().toLowerCase();
  const ext =
    extRaw === ".gpx" || extRaw === ".tcx" || extRaw === ".fit" || extRaw === ".xml" || extRaw === ".bin"
      ? extRaw
      : null;
  if (!ext) {
    return {
      ...baseMeta(),
      resolved_external_id: null,
      executed_workout_id: null,
      outcome: "skipped_bad_extension",
      message: `Estensione non supportata: ${extRaw || "(vuoto)"}`,
    };
  }

  const located = await locateExecutedWorkoutForGarminBinary({
    supabase: input.supabase,
    athleteId: input.athleteId,
    bareIds,
  });

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
    if (located) {
      const prev =
        located.trace_summary && typeof located.trace_summary === "object" && !Array.isArray(located.trace_summary)
          ? (located.trace_summary as Record<string, unknown>)
          : {};
      await recordGarminBinaryEnrichDiagnostic({
        supabase: input.supabase,
        workoutId: located.id,
        prev,
        status: "parse_error",
        message: msg,
      });
    }
    return {
      ...baseMeta(),
      resolved_external_id: located?.resolvedExternalId ?? null,
      executed_workout_id: located?.id ?? null,
      match: located?.match,
      outcome: "parse_error",
      message: msg,
    };
  }

  const ts = parsed.traceSummary as Record<string, unknown>;
  const routeGeo = normalizeRoutePointsToGeo(ts);
  const hasHd = parsedTraceHasNonRouteHdSeries(ts);

  if (routeGeo.length < 1 && !hasHd) {
    if (located) {
      const prev =
        located.trace_summary && typeof located.trace_summary === "object" && !Array.isArray(located.trace_summary)
          ? (located.trace_summary as Record<string, unknown>)
          : {};
      await recordGarminBinaryEnrichDiagnostic({
        supabase: input.supabase,
        workoutId: located.id,
        prev,
        status: "no_geo_no_hd_series",
        message: "File parsato senza coordinate percorso né serie HR/potenza/velocità utilizzabili.",
      });
      return {
        ...baseMeta(),
        resolved_external_id: located.resolvedExternalId,
        executed_workout_id: located.id,
        match: located.match,
        outcome: "no_geo_no_hd_series",
      };
    }
    return {
      ...baseMeta(),
      resolved_external_id: null,
      executed_workout_id: null,
      outcome: "no_executed_row",
      message:
        "Nessuna riga executed_workouts e file senza percorso né serie HD — impossibile creare sessione da solo binario.",
    };
  }

  if (!located) {
    const bare = pickPrimaryBareIdForGarminFileRow(bareIds, input.callbackUrl);
    if (!bare) {
      return {
        ...baseMeta(),
        resolved_external_id: null,
        executed_workout_id: null,
        outcome: "skipped_no_activity_id",
        message: "Impossibile scegliere id attività per nuova riga.",
      };
    }
    const externalId = `garmin_api:${bare}`;
    const merged = mergeTraceSeriesOverlay({}, ts, routeGeo);
    merged.garmin_created_from_missing_summary_row = true;
    if (/^\d+$/.test(bare)) {
      merged.activity_id = bare;
    }
    const ge = merged.garmin_binary_enrich;
    if (ge && typeof ge === "object" && !Array.isArray(ge)) {
      (ge as Record<string, unknown>).row_match = "inserted_from_activity_file";
    }

    let upsertId: string | null = null;
    try {
      const up = await upsertExecutedWorkoutByExternalId(input.supabase, {
        athlete_id: input.athleteId,
        date: coalesceActivityDateForGarminFileInsert(parsed),
        duration_minutes: Math.max(0.1, parsed.durationMinutes),
        tss: parsed.tss,
        kcal: parsed.kcal,
        kj: parsed.kj,
        source: "api_sync:garmin:activityFile",
        external_id: externalId,
        subjective_notes: null,
        trace_summary: merged as Record<string, unknown>,
      });
      upsertId = up.id;
    } catch (insErr) {
      const m = insErr instanceof Error ? insErr.message : String(insErr);
      return {
        ...baseMeta(),
        resolved_external_id: externalId,
        executed_workout_id: null,
        match: "inserted_from_activity_file",
        outcome: "update_failed",
        message: `Insert da file fallito: ${m}`,
      };
    }

    if (!upsertId) {
      return {
        ...baseMeta(),
        resolved_external_id: externalId,
        executed_workout_id: null,
        match: "inserted_from_activity_file",
        outcome: "update_failed",
        message: "Insert executed_workouts senza id restituito.",
      };
    }

    try {
      await persistExecutedWorkoutSeriesFromTrace({
        db: input.supabase,
        athleteId: input.athleteId,
        executedWorkoutId: upsertId,
        traceSummary: merged,
        parserEngine: "garmin_activity_file_bootstrap",
        parserVersion: "2",
        source: "api_sync:garmin:activityFile",
      });
    } catch {
      /* tabella assente / RLS */
    }

    return {
      ...baseMeta(),
      resolved_external_id: externalId,
      executed_workout_id: upsertId,
      match: "inserted_from_activity_file",
      outcome: "inserted_from_file",
    };
  }

  const prev =
    located.trace_summary && typeof located.trace_summary === "object" && !Array.isArray(located.trace_summary)
      ? (located.trace_summary as Record<string, unknown>)
      : {};

  const merged = mergeTraceSeriesOverlay(prev, ts, routeGeo);
  const ge = merged.garmin_binary_enrich;
  if (ge && typeof ge === "object" && !Array.isArray(ge)) {
    (ge as Record<string, unknown>).row_match = located.match;
  }

  const { error: updErr } = await input.supabase
    .from("executed_workouts")
    .update({ trace_summary: merged })
    .eq("id", located.id);
  if (updErr) {
    await recordGarminBinaryEnrichDiagnostic({
      supabase: input.supabase,
      workoutId: located.id,
      prev,
      status: "update_failed",
      message: updErr.message,
    });
    return {
      ...baseMeta(),
      resolved_external_id: located.resolvedExternalId,
      executed_workout_id: located.id,
      match: located.match,
      outcome: "update_failed",
      message: updErr.message,
    };
  }

  try {
    await persistExecutedWorkoutSeriesFromTrace({
      db: input.supabase,
      athleteId: input.athleteId,
      executedWorkoutId: located.id,
      traceSummary: merged,
      parserEngine: (typeof prev.parser_engine === "string" ? prev.parser_engine : null) ?? "garmin_activity_file",
      parserVersion: String(prev.parser_version ?? "2"),
      source: "api_sync:garmin:activityFile",
    });
  } catch {
    /* tabella assente / RLS */
  }

  return {
    ...baseMeta(),
    resolved_external_id: located.resolvedExternalId,
    executed_workout_id: located.id,
    match: located.match,
    outcome: "merged",
  };
}
