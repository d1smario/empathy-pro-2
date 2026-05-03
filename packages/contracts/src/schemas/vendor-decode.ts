import type { ObservationIngestTags } from "./observation-taxonomy";
import type { RealityProvider } from "./reality";

/**
 * Identifica la pipeline di decode che ha prodotto il clip (audit / telemetria).
 * Non sostituisce `RealityProvider` (origine business).
 */
export type VendorDecodeAdapterId =
  | "garmin_health_activity_summary"
  | "garmin_activity_file_fit"
  | "whoop_v2_rest"
  | "wahoo_cloud_v1"
  | "manual_clip";

/**
 * Unità minima esposta in lettura dopo decode (summary + tag osservazione).
 * Serie ad alta frequenza restano fuori fino a storage dedicato (vedi piano ingest).
 */
export type NormalizedIngestClipV1 = {
  schemaVersion: "v1";
  adapterId: VendorDecodeAdapterId;
  provider: RealityProvider;
  observation: ObservationIngestTags;
  /** Riepilogo numerico/stringa già normalizzato lato adapter (no raw vendor blob). */
  summary: Record<string, unknown>;
};
