/**
 * Persistenza serie HD per `executed_workouts` su tabella dedicata
 * `executed_workout_series` (vedi `supabase/migrations/045_executed_workout_series_v1.sql`).
 *
 * Best-effort: se la tabella non esiste o la write fallisce non si rompe l’import
 * (la sessione resta valida con le serie nel `trace_summary` come legacy).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type SeriesChannel = "power" | "hr" | "speed" | "cadence" | "altitude" | "temperature";

const CHANNEL_DEFS: Array<{
  channel: SeriesChannel;
  unit: string;
  traceKeys: string[];
}> = [
  { channel: "power", unit: "W", traceKeys: ["power_series_w"] },
  { channel: "hr", unit: "bpm", traceKeys: ["hr_series_bpm"] },
  { channel: "speed", unit: "km/h", traceKeys: ["speed_series_kmh"] },
  { channel: "cadence", unit: "rpm", traceKeys: ["cadence_series_rpm"] },
  { channel: "altitude", unit: "m", traceKeys: ["altitude_series_m", "route_altitude_series_m"] },
  { channel: "temperature", unit: "°C", traceKeys: ["temperature_series_c"] },
];

function pickSeriesFromTrace(trace: Record<string, unknown>, keys: string[]): number[] | null {
  for (const k of keys) {
    const raw = trace[k];
    if (!Array.isArray(raw)) continue;
    const out: number[] = [];
    for (const v of raw) {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      if (Number.isFinite(n)) out.push(n);
    }
    if (out.length > 1) return out;
  }
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

  for (const def of CHANNEL_DEFS) {
    const series = pickSeriesFromTrace(traceSummary, def.traceKeys);
    if (!series) {
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
          sample_count: series.length,
          samples: series,
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
