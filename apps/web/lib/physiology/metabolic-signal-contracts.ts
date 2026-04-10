/**
 * Extensible contracts for future **metabolic signaling** inputs (continuous lactate, pH, redox proxies, etc.).
 * Persist under `metabolicProfile.metabolicSignals` or session traces when ingest exists.
 *
 * Add new channel IDs only with documented units; keep `custom` for vendor-specific keys in metadata.
 */

export const METABOLIC_SIGNAL_SCHEMA_VERSION = "1" as const;

/** Stable IDs for analytics / twin modulators — extend as new sensors normalize. */
export type MetabolicSignalChannelId =
  | "lactate_blood_discrete_mmol"
  | "lactate_blood_continuous_mmol"
  | "lactate_interstitial_mmol"
  | "muscle_ph"
  | "blood_ph"
  | "nad_nadh_ratio_proxy"
  | "cellular_redox_proxy"
  | "muscle_o2_saturation_pct"
  | "custom";

export type MetabolicSignalSample = {
  channelId: MetabolicSignalChannelId;
  value: number;
  unit: string;
  /** ISO-8601 instant when known */
  measuredAtIso?: string;
  /** Relative to session start (seconds) */
  tStartRelSec?: number;
  tEndRelSec?: number;
  quality?: "raw" | "filtered" | "calibrated" | "synthetic";
  sourceDevice?: string;
  /** Freeform for custom channel or firmware revision */
  metadata?: Record<string, unknown>;
};

/**
 * Optional bag on metabolic profile JSON for forward-compatible device / lab series.
 */
export type MetabolicSignalSeriesMeta = {
  schemaVersion: typeof METABOLIC_SIGNAL_SCHEMA_VERSION;
  /** Sparse samples until continuous ingest ships */
  samples?: MetabolicSignalSample[];
  /** Future: Supabase/storage keys for time series */
  streamRefs?: Array<{ channelId: MetabolicSignalChannelId; ref: string; format?: string }>;
  updatedAtIso?: string;
};
