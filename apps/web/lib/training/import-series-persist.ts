/**
 * Persistenza serie HD per `executed_workouts` su tabella dedicata
 * `executed_workout_series` (vedi migrations 045 + 050).
 *
 * Convoglia tutti i canali (scalari + route geo) su un'unica tabella e usa il
 * `SERIES_CHANNEL_REGISTRY` come single source of truth (no duplicazione enum).
 *
 * Best-effort: se la tabella non esiste o la write fallisce non si rompe l’import
 * (la sessione resta valida con le serie nel `trace_summary` come legacy).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type GeoPoint,
  type SeriesChannelSpec,
  SERIES_CHANNEL_REGISTRY,
  isGeoPoint,
} from "@/lib/training/series-channel-registry";

function pickScalarSeries(trace: Record<string, unknown>, keys: string[]): number[] | null {
  for (const k of keys) {
    const raw = trace[k];
    if (!Array.isArray(raw)) continue;
    const out: number[] = [];
    for (const v of raw) {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      if (Number.isFinite(n)) out.push(n);
    }
    if (out.length >= 1) return out;
  }
  return null;
}

function pickGeoSeries(trace: Record<string, unknown>, keys: string[]): GeoPoint[] | null {
  for (const k of keys) {
    const raw = trace[k];
    if (!Array.isArray(raw)) continue;
    const out: GeoPoint[] = [];
    for (const v of raw) {
      if (isGeoPoint(v)) {
        out.push({ lat: v.lat, lon: v.lon, ...(typeof v.alt === "number" ? { alt: v.alt } : {}) });
        continue;
      }
      if (Array.isArray(v) && v.length >= 2) {
        const lat = typeof v[0] === "number" ? v[0] : Number(v[0]);
        const lon = typeof v[1] === "number" ? v[1] : Number(v[1]);
        if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          out.push({ lat, lon });
        }
      }
    }
    if (out.length >= 1) return out;
  }
  return null;
}

function pickSamplesForChannel(trace: Record<string, unknown>, def: SeriesChannelSpec): unknown[] | null {
  if (def.shape === "scalar") return pickScalarSeries(trace, def.traceKeys);
  if (def.shape === "geo_point") return pickGeoSeries(trace, def.traceKeys);
  return null;
}

export type PersistSeriesResult = {
  attempted: number;
  written: number;
  skipped: number;
  errors: string[];
};

export async function persistExecutedWorkoutSeriesFromTrace(input: {
  db: SupabaseClient;
  athleteId: string;
  executedWorkoutId: string;
  traceSummary: Record<string, unknown>;
  parserEngine?: string | null;
  parserVersion?: string | null;
  source?: string;
}): Promise<PersistSeriesResult> {
  const { db, athleteId, executedWorkoutId, traceSummary } = input;
  const result: PersistSeriesResult = { attempted: 0, written: 0, skipped: 0, errors: [] };

  for (const def of SERIES_CHANNEL_REGISTRY) {
    const samples = pickSamplesForChannel(traceSummary, def);
    if (!samples) {
      result.skipped += 1;
      continue;
    }
    result.attempted += 1;
    try {
      const { error } = await db.from("executed_workout_series").upsert(
        {
          executed_workout_id: executedWorkoutId,
          athlete_id: athleteId,
          channel: def.channel,
          unit: def.unit,
          sample_count: samples.length,
          samples,
          source: input.source ?? "file_import",
          parser_engine: input.parserEngine ?? null,
          parser_version: input.parserVersion ?? null,
          version: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "executed_workout_id,channel,version" },
      );
      if (error) {
        result.errors.push(`${def.channel}: ${error.message}`);
      } else {
        result.written += 1;
      }
    } catch (err) {
      result.errors.push(`${def.channel}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return result;
}
