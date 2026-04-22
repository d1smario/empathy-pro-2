import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { buildRealityIngestionEnvelope } from "@/lib/reality/build-ingestion-envelope";
import { buildPlannedTrainingImportQuality } from "@/lib/reality/training-import-quality";
import { decompressTrainingImportBuffer } from "@/lib/training/import-parser";
import { serializePro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { clampPlannedWorkoutRow } from "@/lib/training/planned/clamp-planned-row";
import { parsePlannedProgramFile } from "@/lib/training/planned-import-parser";
import {
  type PlannedStructuredFormat,
  parseStructuredPlannedWorkoutFromBuffer,
} from "@/lib/training/planned-structured-import";

const STRUCTURED_NOTES_HEAD = "[STRUCTURED_PLAN_IMPORT]";

export type PlannedImportServiceOk = {
  status: "ok";
  athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemory>> | null;
  athleteMemoryError?: string;
  ingestion: unknown;
  importedCount: number;
  firstDate: string | null;
  sourceFormat: string;
  fileName: string;
  importJobId: string | null;
  structured?: boolean;
  structuredFormat?: PlannedStructuredFormat;
};

export async function runPlannedProgramFileImport(
  db: SupabaseClient,
  input: {
    athleteId: string;
    file: File;
    fileChecksum: string;
    fileBuffer: Buffer;
    notes: string;
  },
): Promise<PlannedImportServiceOk> {
  let importJobId: string | null = null;
  const parsed = await parsePlannedProgramFile({
    fileName: input.file.name,
    buffer: input.fileBuffer,
  });
  if (!parsed.rows.length) {
    throw new Error("Nessuna seduta valida trovata nel file programmazione.");
  }

  const insertPayloads = parsed.rows.map((r) => {
    const kcal = r.kcal_target != null ? Math.round(r.kcal_target) : null;
    const row = clampPlannedWorkoutRow({
      athlete_id: input.athleteId,
      date: r.date,
      type: r.type,
      duration_minutes: r.duration_minutes,
      tss_target: r.tss_target,
      kcal_target: kcal,
      kj_target: kcal != null ? Math.round(kcal * 4.184) : null,
      notes: [r.notes, input.notes || null].filter(Boolean).join(" | ") || null,
    });
    const p: Record<string, unknown> = {
      athlete_id: row.athlete_id,
      date: row.date,
      type: row.type,
      duration_minutes: row.duration_minutes,
      tss_target: row.tss_target,
      kcal_target: row.kcal_target,
      notes: row.notes,
    };
    if (row.kj_target != null) p.kj_target = row.kj_target;
    return p;
  });

  const sessionDate = parsed.firstDate ?? parsed.rows[0]?.date ?? null;
  const hasCoachNotes = Boolean(input.notes) || parsed.rows.some((row) => Boolean(row.notes?.trim()));
  const quality = buildPlannedTrainingImportQuality({
    firstDate: sessionDate,
    rowCount: insertPayloads.length,
    hasCoachNotes,
  });
  const realityEnvelope = buildRealityIngestionEnvelope({
    athleteId: input.athleteId,
    domain: "training",
    sourceKind: "file_import",
    provider: `planned_${parsed.sourceFormat}`,
    sessionDate,
    format: parsed.sourceFormat,
    fileName: input.file.name,
    fileChecksumSha1: input.fileChecksum,
    qualityStatus: quality.qualityStatus,
    qualityNote: quality.qualityNote,
    channelCoverage: quality.channelCoverage,
    missingChannels: quality.missingChannels,
    recommendedInputs: quality.recommendedInputs,
    canonicalPreview: {
      imported_planned_count: insertPayloads.length,
      first_date: sessionDate,
    },
    rawRefs: {
      row_count: insertPayloads.length,
    },
  });

  const startJob = await db
    .from("training_import_jobs")
    .insert({
      athlete_id: input.athleteId,
      mode: "planned",
      source_format: parsed.sourceFormat,
      source_vendor: "planned_import",
      status: "processing",
      file_name: input.file.name,
      file_size_bytes: input.file.size,
      file_checksum_sha1: input.fileChecksum,
      imported_planned_count: insertPayloads.length,
      imported_date: sessionDate,
      quality_status: quality.qualityStatus,
      quality_note: quality.qualityNote,
      channel_coverage: quality.channelCoverage,
      payload: realityEnvelope,
    })
    .select("id")
    .single();
  if (!startJob.error) importJobId = startJob.data?.id ?? null;

  const { error } = await db.from("planned_workouts").insert(insertPayloads);
  if (error) {
    if (importJobId) {
      await db
        .from("training_import_jobs")
        .update({
          status: "error",
          error_message: error.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importJobId);
    }
    throw new Error(error.message);
  }

  if (importJobId) {
    await db
      .from("training_import_jobs")
      .update({
        status: "done",
        imported_planned_count: insertPayloads.length,
        imported_date: sessionDate,
        updated_at: new Date().toISOString(),
        payload: realityEnvelope,
      })
      .eq("id", importJobId);
  }

  let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemory>> | null = null;
  let athleteMemoryError: string | undefined;
  try {
    athleteMemory = await resolveAthleteMemory(input.athleteId);
  } catch (memErr) {
    athleteMemoryError = memErr instanceof Error ? memErr.message : "resolveAthleteMemory failed";
  }

  return {
    status: "ok",
    athleteMemory,
    ...(athleteMemoryError ? { athleteMemoryError } : {}),
    ingestion: realityEnvelope,
    importedCount: insertPayloads.length,
    firstDate: parsed.firstDate,
    sourceFormat: parsed.sourceFormat,
    fileName: input.file.name,
    importJobId,
    structured: false,
  };
}

export async function runStructuredPlannedSingleImport(
  db: SupabaseClient,
  input: {
    athleteId: string;
    file: File;
    fileChecksum: string;
    fileBuffer: Buffer;
    notes: string;
    date: string;
    format: PlannedStructuredFormat;
  },
): Promise<PlannedImportServiceOk> {
  let importJobId: string | null = null;
  const { effectiveName, payload } = decompressTrainingImportBuffer({
    fileName: input.file.name,
    mimeType: input.file.type ?? "",
    buffer: input.fileBuffer,
  });
  const parsed = await parseStructuredPlannedWorkoutFromBuffer({
    fileName: effectiveName,
    buffer: payload,
    format: input.format,
  });

  const jsonLine = serializePro2BuilderSessionContract(parsed.contract);
  /** Stesso file + giorno: rimuove duplicati da re-import / doppio invio prima di inserire. */
  const importChecksumTag = `import_sha1=${input.fileChecksum}`;
  const head = `${STRUCTURED_NOTES_HEAD} ${parsed.sourceVendorTag} ${importChecksumTag}`;
  const mergedNotes = [head, input.notes?.trim() || null, jsonLine].filter(Boolean).join("\n");

  const typeKey = `pro2_builder_structured_${input.format}`.slice(0, 120);
  const row = clampPlannedWorkoutRow({
    athlete_id: input.athleteId,
    date: input.date.slice(0, 10),
    type: typeKey,
    duration_minutes: Math.max(1, Math.round(parsed.contract.summary.durationSec / 60)),
    tss_target: Math.max(0, Math.round(parsed.contract.summary.tss)),
    kcal_target:
      parsed.contract.summary.kcal != null && Number.isFinite(parsed.contract.summary.kcal)
        ? Math.round(parsed.contract.summary.kcal)
        : null,
    kj_target:
      parsed.contract.summary.kj != null && Number.isFinite(parsed.contract.summary.kj)
        ? Math.round(parsed.contract.summary.kj)
        : null,
    notes: mergedNotes,
  });

  const insertPayload: Record<string, unknown> = {
    athlete_id: row.athlete_id,
    date: row.date,
    type: row.type,
    duration_minutes: row.duration_minutes,
    tss_target: row.tss_target,
    kcal_target: row.kcal_target,
    notes: row.notes,
  };
  if (row.kj_target != null) insertPayload.kj_target = row.kj_target;

  const sessionDate = row.date;
  const quality = buildPlannedTrainingImportQuality({
    firstDate: sessionDate,
    rowCount: 1,
    hasCoachNotes: Boolean(input.notes),
  });
  const sourceFormat = parsed.sourceVendorTag;
  const realityEnvelope = buildRealityIngestionEnvelope({
    athleteId: input.athleteId,
    domain: "training",
    sourceKind: "file_import",
    provider: sourceFormat,
    sessionDate,
    format: input.format,
    fileName: input.file.name,
    fileChecksumSha1: input.fileChecksum,
    qualityStatus: quality.qualityStatus,
    qualityNote: quality.qualityNote,
    channelCoverage: quality.channelCoverage,
    missingChannels: quality.missingChannels,
    recommendedInputs: quality.recommendedInputs,
    canonicalPreview: {
      imported_planned_count: 1,
      first_date: sessionDate,
      structured_session_name: parsed.sessionName,
    },
    rawRefs: {
      row_count: 1,
      structured_format: input.format,
    },
  });

  const startJob = await db
    .from("training_import_jobs")
    .insert({
      athlete_id: input.athleteId,
      mode: "planned",
      source_format: sourceFormat,
      source_vendor: "structured_plan_import",
      status: "processing",
      file_name: input.file.name,
      file_size_bytes: input.file.size,
      file_checksum_sha1: input.fileChecksum,
      imported_planned_count: 1,
      imported_date: sessionDate,
      quality_status: quality.qualityStatus,
      quality_note: quality.qualityNote,
      channel_coverage: quality.channelCoverage,
      payload: realityEnvelope,
    })
    .select("id")
    .single();
  if (!startJob.error) importJobId = startJob.data?.id ?? null;

  const dedupePattern = `%${importChecksumTag}%`;
  const { error: dedupeErr } = await db
    .from("planned_workouts")
    .delete()
    .eq("athlete_id", input.athleteId)
    .eq("date", row.date)
    .ilike("notes", dedupePattern);
  if (dedupeErr) {
    if (importJobId) {
      await db
        .from("training_import_jobs")
        .update({
          status: "error",
          error_message: dedupeErr.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importJobId);
    }
    throw new Error(dedupeErr.message);
  }

  const ins = await db.from("planned_workouts").insert(insertPayload).select("id").single();
  if (ins.error) {
    if (importJobId) {
      await db
        .from("training_import_jobs")
        .update({
          status: "error",
          error_message: ins.error.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importJobId);
    }
    throw new Error(ins.error.message);
  }

  if (importJobId) {
    await db
      .from("training_import_jobs")
      .update({
        status: "done",
        imported_planned_count: 1,
        imported_date: sessionDate,
        updated_at: new Date().toISOString(),
        payload: realityEnvelope,
      })
      .eq("id", importJobId);
  }

  let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemory>> | null = null;
  let athleteMemoryError: string | undefined;
  try {
    athleteMemory = await resolveAthleteMemory(input.athleteId);
  } catch (memErr) {
    athleteMemoryError = memErr instanceof Error ? memErr.message : "resolveAthleteMemory failed";
  }

  return {
    status: "ok",
    athleteMemory,
    ...(athleteMemoryError ? { athleteMemoryError } : {}),
    ingestion: realityEnvelope,
    importedCount: 1,
    firstDate: sessionDate,
    sourceFormat,
    fileName: input.file.name,
    importJobId,
    structured: true,
    structuredFormat: input.format,
  };
}
