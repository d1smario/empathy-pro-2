import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { buildRealityIngestionEnvelope } from "@/lib/reality/build-ingestion-envelope";
import { buildPlannedTrainingImportQuality } from "@/lib/reality/training-import-quality";
import { decompressTrainingImportBuffer } from "@/lib/training/import-parser";
import { serializePro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { clampPlannedWorkoutRow } from "@/lib/training/planned/clamp-planned-row";
import { insertPlannedWorkoutRows, insertSinglePlannedWorkout } from "@/lib/training/planned/insert-planned-workout";
import { parsePlannedProgramFile } from "@/lib/training/planned-import-parser";
import {
  type PlannedStructuredFormat,
  type StructuredIntervalRow,
  parseStructuredPlannedWorkoutFromBuffer,
} from "@/lib/training/planned-structured-import";
import { purgeGhostFileImportExecutedForDate } from "@/lib/training/purge-ghost-file-import-executed";
import { resolveImportRenderProfileForAthlete } from "@/lib/training/physiology/resolve-import-render-profile";
import type { TrainingImportDetectedKind } from "@/lib/training/training-import-routing";
import {
  type StructuredCompanionResult,
  upsertStructuredCompanionExecuted,
} from "@/lib/training/structured-import-companion-executed";

const STRUCTURED_NOTES_HEAD = "[STRUCTURED_PLAN_IMPORT]";

export type PlannedImportServiceOk = {
  status: "ok";
  athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemorySlice>> | null;
  athleteMemoryError?: string;
  ingestion: unknown;
  importedCount: number;
  firstDate: string | null;
  sourceFormat: string;
  fileName: string;
  importJobId: string | null;
  structured?: boolean;
  structuredFormat?: PlannedStructuredFormat;
  /** Traccia `executed_workouts` companion per Analyzer (durata/TSS come seduta strutturata). */
  structuredCompanion?: StructuredCompanionResult;
  /** Scala intervalli (durata sec + watt) come TrainingPeaks; `intervalLadderCsv` è pronto per Excel. */
  intervalLadder?: StructuredIntervalRow[];
  intervalLadderCsv?: string;
  detectedKind?: TrainingImportDetectedKind;
  routeReason?: string;
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

  const insertRows = parsed.rows.map((r) => {
    const kcal = r.kcal_target != null ? Math.round(r.kcal_target) : null;
    return clampPlannedWorkoutRow({
      athlete_id: input.athleteId,
      date: r.date,
      type: r.type,
      duration_minutes: r.duration_minutes,
      tss_target: r.tss_target,
      kcal_target: kcal,
      kj_target: kcal != null ? Math.round(kcal * 4.184) : null,
      notes: [r.notes, input.notes || null].filter(Boolean).join(" | ") || null,
    });
  });

  const sessionDate = parsed.firstDate ?? parsed.rows[0]?.date ?? null;
  const hasCoachNotes = Boolean(input.notes) || parsed.rows.some((row) => Boolean(row.notes?.trim()));
  const quality = buildPlannedTrainingImportQuality({
    firstDate: sessionDate,
    rowCount: insertRows.length,
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
      imported_planned_count: insertRows.length,
      first_date: sessionDate,
    },
    rawRefs: {
      row_count: insertRows.length,
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
      imported_planned_count: insertRows.length,
      imported_date: sessionDate,
      quality_status: quality.qualityStatus,
      quality_note: quality.qualityNote,
      channel_coverage: quality.channelCoverage,
      payload: realityEnvelope,
    })
    .select("id")
    .single();
  if (!startJob.error) importJobId = startJob.data?.id ?? null;

  let importedCount = 0;
  try {
    const inserted = await insertPlannedWorkoutRows(db, insertRows);
    importedCount = inserted.ids.length;
  } catch (insertErr) {
    const message = insertErr instanceof Error ? insertErr.message : "planned insert failed";
    if (importJobId) {
      await db
        .from("training_import_jobs")
        .update({
          status: "error",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importJobId);
    }
    throw new Error(message);
  }

  if (importJobId) {
    await db
      .from("training_import_jobs")
      .update({
        status: "done",
        imported_planned_count: importedCount,
        imported_date: sessionDate,
        updated_at: new Date().toISOString(),
        payload: realityEnvelope,
      })
      .eq("id", importJobId);
  }

  let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemorySlice>> | null = null;
  let athleteMemoryError: string | undefined;
  try {
    athleteMemory = await resolveAthleteMemorySlice(input.athleteId, { slice: "training", skipCache: true });
  } catch (memErr) {
    athleteMemoryError = memErr instanceof Error ? memErr.message : "resolveAthleteMemorySlice failed";
  }

  return {
    status: "ok",
    athleteMemory,
    ...(athleteMemoryError ? { athleteMemoryError } : {}),
    ingestion: realityEnvelope,
    importedCount,
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
    routeReason?: string;
  },
): Promise<PlannedImportServiceOk> {
  let importJobId: string | null = null;
  const { effectiveName, payload } = decompressTrainingImportBuffer({
    fileName: input.file.name,
    mimeType: input.file.type ?? "",
    buffer: input.fileBuffer,
  });
  const renderProfile = await resolveImportRenderProfileForAthlete(input.athleteId);
  const parsed = await parseStructuredPlannedWorkoutFromBuffer({
    fileName: effectiveName,
    buffer: payload,
    format: input.format,
    renderProfile,
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
      structured_interval_rows: parsed.intervalLadder.length,
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

  let plannedWorkoutId: string | null = null;
  try {
    const inserted = await insertSinglePlannedWorkout(db, row);
    plannedWorkoutId = inserted.id;
  } catch (insertErr) {
    const message = insertErr instanceof Error ? insertErr.message : "planned insert failed";
    if (importJobId) {
      await db
        .from("training_import_jobs")
        .update({
          status: "error",
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importJobId);
    }
    throw new Error(message);
  }

  try {
    await purgeGhostFileImportExecutedForDate(db, input.athleteId, row.date);
  } catch {
    /** Best-effort: non bloccare PLAN se la pulizia EXEC fantasma fallisce. */
  }

  /**
   * Regola operativa (utente coach):
   *
   * Un import strutturato (ZWO/ERG/MRC/FIT WORKOUT) e' un PROGRAMMA pianificato,
   * NON un'attivita' eseguita. Non creiamo piu' un `executed_workouts` "companion"
   * sintetico in fase di import: quel record finiva per popolare il calendario come
   * se l'allenamento fosse gia' stato eseguito (visibile come "executed" con durata
   * e TSS sintetici), creando il "doppione" planned + executed segnalato dal coach.
   *
   * Quando l'atleta esegue il workout (Garmin/Wahoo), l'attivita' reale (file_type=
   * activity, NON workout) verra' importata dal flusso `runFileImport` e creera'
   * il corretto `executed_workouts` con trace_summary reale dal device.
   *
   * La funzione `upsertStructuredCompanionExecuted` resta disponibile per altri
   * flussi (es. backfill / migrazione / test) ma NON viene piu' chiamata qui.
   */
  const structuredCompanion: StructuredCompanionResult | undefined = undefined;

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

  let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemorySlice>> | null = null;
  let athleteMemoryError: string | undefined;
  try {
    athleteMemory = await resolveAthleteMemorySlice(input.athleteId, { slice: "training", skipCache: true });
  } catch (memErr) {
    athleteMemoryError = memErr instanceof Error ? memErr.message : "resolveAthleteMemorySlice failed";
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
    intervalLadder: parsed.intervalLadder,
    intervalLadderCsv: parsed.intervalLadderCsv,
    detectedKind: "program",
    routeReason: input.routeReason ?? `structured_${input.format}`,
    ...(structuredCompanion ? { structuredCompanion } : {}),
  };
}
