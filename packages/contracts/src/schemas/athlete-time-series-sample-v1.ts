/**
 * Contratto read-model per `public.athlete_time_series_samples` (migration 055).
 * Scrittura: solo boundary ingest / adapter — vedi `docs/INGEST_DEVICE_AND_LAB_MATRIX.md`.
 */

export const ATHLETE_TIME_SERIES_SAMPLE_CONTRACT_VERSION = 1 as const;

/** Canali v1 supportati in CHECK SQL; estendere migration + questo union insieme. */
export const ATHLETE_TIME_SERIES_CHANNEL_V1 = {
  GLUCOSE_MMOL_L: "glucose_mmol_l",
  LACTATE_MMOL_L: "lactate_mmol_l",
} as const;

export type AthleteTimeSeriesChannelV1 =
  (typeof ATHLETE_TIME_SERIES_CHANNEL_V1)[keyof typeof ATHLETE_TIME_SERIES_CHANNEL_V1];

export type AthleteTimeSeriesSampleQualityV1 = "good" | "questionable" | "artifact" | "unknown";

/** Riga lettura Supabase / envelope normalizzato (campi DB). */
export type AthleteTimeSeriesSampleRowV1 = {
  id?: string;
  athlete_id: string;
  observed_at: string;
  channel: AthleteTimeSeriesChannelV1;
  value: number;
  unit: string;
  quality?: AthleteTimeSeriesSampleQualityV1 | null;
  source: string;
  source_ref?: Record<string, unknown>;
  created_at?: string;
};
