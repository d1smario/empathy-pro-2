import type { IsoDate, IsoDateTime } from "./common";

export type RealityDomain =
  | "training"
  | "sleep"
  | "recovery"
  | "nutrition"
  | "health"
  | "device"
  | "other";

export type RealitySourceKind = "file_import" | "api_sync" | "manual" | "derived";

export type RealityProvider =
  | "garmin"
  | "garmin_connectiq"
  | "trainingpeaks"
  | "strava"
  | "polar"
  | "wahoo"
  | "coros"
  | "suunto"
  | "apple_watch"
  | "zwift"
  | "hammerhead"
  | "whoop"
  | "oura"
  | "cgm"
  | "manual"
  | "unknown"
  | "other";

export type RealityImportQualityStatus = "OK" | "SPARSE" | "LOW_COVERAGE" | "UNKNOWN";
export type RealityIngestionStatus = "pending" | "processing" | "done" | "error" | "created" | "sent" | "failed";

export type RealityIngestionEnvelope = {
  schemaVersion: "v1";
  domain: RealityDomain;
  sourceKind: RealitySourceKind;
  provider: RealityProvider;
  athleteId?: string;
  sessionDate?: IsoDate | null;
  importedAt: IsoDateTime;
  format?: string | null;
  device?: string | null;
  externalId?: string | null;
  fileName?: string | null;
  fileChecksumSha1?: string | null;
  parser?: {
    engine?: string | null;
    version?: string | null;
  } | null;
  quality?: {
    status: RealityImportQualityStatus;
    note?: string | null;
    channelCoverage?: Record<string, number> | null;
    coveragePct?: number | null;
    missingChannels?: string[] | null;
    recommendedInputs?: string[] | null;
  } | null;
  canonicalPreview?: Record<string, unknown> | null;
  rawRefs?: Record<string, unknown> | null;
};

export type RealityImportJob = {
  id: string;
  mode: "executed" | "planned";
  source_format?: string | null;
  source_vendor?: string | null;
  parser_engine?: string | null;
  parser_version?: string | null;
  status: "pending" | "processing" | "done" | "error";
  file_name: string;
  imported_workout_id?: string | null;
  imported_planned_count?: number | null;
  imported_date?: string | null;
  quality_status?: string | null;
  quality_note?: string | null;
  channel_coverage?: Record<string, number> | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  ingestion?: RealityIngestionEnvelope | null;
};

export type RealityIngestionRecord = {
  id: string;
  domain: RealityDomain;
  sourceKind: RealitySourceKind;
  provider: RealityProvider;
  status: RealityIngestionStatus;
  sourceTable: string;
  externalRef?: string | null;
  createdAt: string;
  updatedAt: string;
  ingestion?: RealityIngestionEnvelope | null;
};

export type RealityProviderDescriptor = {
  provider: RealityProvider;
  label: string;
  supportedDomains: RealityDomain[];
  supportedSourceKinds: RealitySourceKind[];
  notes?: string;
};
