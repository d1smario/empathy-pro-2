import type {
  RealityIngestionEnvelope,
  RealityIngestionRecord,
  RealityIngestionStatus,
  RealityImportJob,
} from "@/lib/empathy/schemas";
import { buildRealityIngestionEnvelope } from "@/lib/reality/build-ingestion-envelope";
import { normalizeRealityProvider } from "@/lib/reality/provider-utils";

function asStatus(value: unknown, fallback: RealityIngestionStatus): RealityIngestionStatus {
  const status = String(value ?? "").trim().toLowerCase();
  if (
    status === "pending" ||
    status === "processing" ||
    status === "done" ||
    status === "error" ||
    status === "created" ||
    status === "sent" ||
    status === "failed"
  ) {
    return status;
  }
  return fallback;
}

function isRealityIngestionEnvelope(value: unknown): value is RealityIngestionEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === "v1" && typeof record.domain === "string" && typeof record.sourceKind === "string";
}

function extractEmbeddedRealityIngestion(value: unknown): RealityIngestionEnvelope | null {
  if (isRealityIngestionEnvelope(value)) return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (isRealityIngestionEnvelope(record.realityIngestion)) return record.realityIngestion;
  if (isRealityIngestionEnvelope(record.ingestion)) return record.ingestion;
  return null;
}

function buildImportJobFallbackEnvelope(row: Record<string, unknown>): RealityIngestionEnvelope {
  const isPlannedMode = row.mode === "planned";
  const channelCoverage =
    row.channel_coverage && typeof row.channel_coverage === "object"
      ? (row.channel_coverage as Record<string, number>)
      : isPlannedMode
        ? {
            session_date: typeof row.imported_date === "string" ? 100 : 0,
            session_rows: typeof row.imported_planned_count === "number" && row.imported_planned_count > 0 ? 100 : 0,
            structure_contract: 100,
          }
        : null;

  return buildRealityIngestionEnvelope({
    athleteId: typeof row.athlete_id === "string" ? row.athlete_id : undefined,
    domain: "training",
    sourceKind: "file_import",
    provider: typeof row.source_vendor === "string" ? row.source_vendor : "unknown",
    sessionDate: typeof row.imported_date === "string" ? row.imported_date : null,
    format: typeof row.source_format === "string" ? row.source_format : null,
    fileName: typeof row.file_name === "string" ? row.file_name : null,
    parserEngine: typeof row.parser_engine === "string" ? row.parser_engine : null,
    parserVersion: typeof row.parser_version === "string" ? row.parser_version : null,
    qualityStatus: typeof row.quality_status === "string" ? row.quality_status : null,
    qualityNote: typeof row.quality_note === "string" ? row.quality_note : null,
    channelCoverage,
    canonicalPreview: {
      imported_workout_id: typeof row.imported_workout_id === "string" ? row.imported_workout_id : null,
      imported_planned_count: typeof row.imported_planned_count === "number" ? row.imported_planned_count : null,
    },
  });
}

export function mapRealityImportJob(row: Record<string, unknown>): RealityImportJob {
  return {
    id: typeof row.id === "string" ? row.id : "",
    mode: row.mode === "planned" ? "planned" : "executed",
    source_format: typeof row.source_format === "string" ? row.source_format : null,
    source_vendor: typeof row.source_vendor === "string" ? row.source_vendor : null,
    parser_engine: typeof row.parser_engine === "string" ? row.parser_engine : null,
    parser_version: typeof row.parser_version === "string" ? row.parser_version : null,
    status: asStatus(row.status, "error") as RealityImportJob["status"],
    file_name: typeof row.file_name === "string" ? row.file_name : "",
    imported_workout_id: typeof row.imported_workout_id === "string" ? row.imported_workout_id : null,
    imported_planned_count: typeof row.imported_planned_count === "number" ? row.imported_planned_count : null,
    imported_date: typeof row.imported_date === "string" ? row.imported_date : null,
    quality_status: typeof row.quality_status === "string" ? row.quality_status : null,
    quality_note: typeof row.quality_note === "string" ? row.quality_note : null,
    channel_coverage:
      row.channel_coverage && typeof row.channel_coverage === "object"
        ? (row.channel_coverage as Record<string, number>)
        : null,
    error_message: typeof row.error_message === "string" ? row.error_message : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString(),
    ingestion: extractEmbeddedRealityIngestion(row.payload) ?? buildImportJobFallbackEnvelope(row),
  };
}

export function mapRealityImportJobs(rows: Array<Record<string, unknown>>): RealityImportJob[] {
  return rows.map(mapRealityImportJob);
}

export function mapTrainingImportJobToIngestionRecord(row: Record<string, unknown>): RealityIngestionRecord {
  const job = mapRealityImportJob(row);
  const ingestion = job.ingestion ?? buildImportJobFallbackEnvelope(row);
  return {
    id: job.id,
    domain: ingestion.domain,
    sourceKind: ingestion.sourceKind,
    provider: ingestion.provider,
    status: job.status,
    sourceTable: "training_import_jobs",
    externalRef: job.imported_workout_id ?? null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    ingestion,
  };
}

export function mapDeviceSyncExportToIngestionRecord(row: Record<string, unknown>): RealityIngestionRecord {
  const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
  const ingestion =
    extractEmbeddedRealityIngestion(payload) ??
    buildRealityIngestionEnvelope({
      athleteId: typeof row.athlete_id === "string" ? row.athlete_id : undefined,
      domain: "device",
      sourceKind: "api_sync",
      provider: typeof row.provider === "string" ? row.provider : "unknown",
      importedAt: typeof row.created_at === "string" ? row.created_at : undefined,
      externalId: typeof row.external_ref === "string" ? row.external_ref : null,
      canonicalPreview: {
        payload_keys: Object.keys(payload),
      },
    });

  return {
    id: typeof row.id === "string" ? row.id : "",
    domain: ingestion.domain,
    sourceKind: ingestion.sourceKind,
    provider: normalizeRealityProvider(typeof row.provider === "string" ? row.provider : ingestion.provider),
    status: asStatus(row.status, "created"),
    sourceTable: "device_sync_exports",
    externalRef: typeof row.external_ref === "string" ? row.external_ref : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : new Date(0).toISOString(),
    ingestion,
  };
}

export function mergeRealityIngestionRecords(
  ...groups: Array<RealityIngestionRecord[]>
): RealityIngestionRecord[] {
  return groups
    .flat()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
