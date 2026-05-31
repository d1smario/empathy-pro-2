import type { SupabaseClient } from "@supabase/supabase-js";

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { buildRealityIngestionEnvelope } from "@/lib/reality/build-ingestion-envelope";
import { buildExecutedTrainingImportQuality } from "@/lib/reality/training-import-quality";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { normalizeImportedTraceSummary } from "@/lib/training/import-normalizer";
import { parseTrainingFile } from "@/lib/training/import-parser";
import { persistExecutedWorkoutSeriesFromTrace } from "@/lib/training/import-series-persist";
import { tryRecordArchetypeTraceFromExecuted } from "@/lib/training/library/try-record-archetype-trace";
import {
  fitStructuredFallbackAfterEmptyExecuted,
  normalizeTrainingImportIntent,
  resolveTrainingImportRoute,
} from "@/lib/training/training-import-routing";
import {
  runPlannedProgramFileImport,
  runStructuredPlannedSingleImport,
} from "@/lib/training/training-planned-import-service";
import {
  assertTrainingManualStagingPathForAthlete,
  createSupabaseServiceRoleClient,
  downloadTrainingManualStagingObject,
  removeTrainingManualStagingObjectBestEffort,
  TRAINING_MANUAL_IMPORT_MAX_BYTES,
} from "@/lib/training/training-manual-import-storage";
import { readTrainingManualImportsBucket } from "@/lib/supabase-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function inferDateFromFileName(fileName: string): string | null {
  const name = fileName.trim();
  const dmy = name.match(/(\d{1,2})[.\-_/](\d{1,2})[.\-_/](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    const y = dmy[3];
    return `${y}-${m}-${d}`;
  }
  const ymd = name.match(/(\d{4})[.\-_/](\d{1,2})[.\-_/](\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, "0");
    const d = ymd[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

function buildExternalId(input: {
  athleteId: string;
  date: string;
  format: string;
  fileChecksumSha1?: string | null;
  fileName?: string;
}) {
  const stableSource =
    input.fileChecksumSha1 && input.fileChecksumSha1.trim().length > 0
      ? input.fileChecksumSha1.trim()
      : (input.fileName ?? "").trim();
  const digest = createHash("sha1")
    .update(`${input.athleteId}|${stableSource}|${input.date}|${input.format}`)
    .digest("hex")
    .slice(0, 20);
  return `imp:${input.format}:${input.date}:${digest}`;
}

/**
 * Import workout eseguito (FIT/TCX/GPX/CSV/JSON) — auth Bearer+cookie come V1; scrittura con service role se configurato.
 *
 * **Upload diretto (grandi file):** `Content-Type: application/json` con `storage: { bucket, objectPath }`
 * dopo `POST /api/training/import/sign-upload` + `uploadToSignedUrl` dal browser (vedi `training-import-api.ts`).
 */
export async function POST(req: NextRequest) {
  let importJobId: string | null = null;
  try {
    let athleteId: string;
    let file: File;
    let fileBuffer: Buffer;
    let dateOverride: string;
    let plannedDate: string;
    let notes: string;
    let device: string;
    let plannedWorkoutId: string;
    let importIntent: ReturnType<typeof normalizeTrainingImportIntent>;
    let db: SupabaseClient;

    const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.includes("application/json")) {
      const raw = (await req.json()) as Record<string, unknown>;
      athleteId = String(raw.athleteId ?? "").trim();
      const storage = raw.storage as { bucket?: string; objectPath?: string } | undefined;
      const bucket = String(storage?.bucket ?? "").trim();
      const objectPath = String(storage?.objectPath ?? "").trim();
      const fileName = String(raw.fileName ?? "").trim();
      const mimeType = String(raw.mimeType ?? "").trim() || "application/octet-stream";
      const declaredSize =
        typeof raw.fileSizeBytes === "number" && Number.isFinite(raw.fileSizeBytes)
          ? Math.floor(raw.fileSizeBytes)
          : 0;

      if (!athleteId) {
        return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
      }
      if (!bucket || !objectPath || !fileName) {
        return NextResponse.json(
          { error: "Missing storage.bucket, storage.objectPath or fileName" },
          { status: 400, headers: NO_STORE },
        );
      }
      const expectedBucket = readTrainingManualImportsBucket();
      if (bucket !== expectedBucket) {
        return NextResponse.json({ error: "storage_bucket_forbidden" }, { status: 400, headers: NO_STORE });
      }
      if (declaredSize > TRAINING_MANUAL_IMPORT_MAX_BYTES) {
        return NextResponse.json({ error: "file_too_large" }, { status: 413, headers: NO_STORE });
      }

      ({ db } = await requireAthleteWriteContext(req, athleteId));
      assertTrainingManualStagingPathForAthlete({ athleteId, objectPath });

      const admin = createSupabaseServiceRoleClient();
      if (!admin) {
        return NextResponse.json(
          { error: "storage_import_requires_SUPABASE_SERVICE_ROLE_KEY" },
          { status: 503, headers: NO_STORE },
        );
      }

      const dl = await downloadTrainingManualStagingObject({
        supabase: admin,
        bucket,
        objectPath,
      });
      fileBuffer = dl.buffer;
      await removeTrainingManualStagingObjectBestEffort({ supabase: admin, bucket, objectPath });

      if (declaredSize > 0 && declaredSize !== fileBuffer.length) {
        return NextResponse.json({ error: "file_size_mismatch" }, { status: 400, headers: NO_STORE });
      }

      const effMime = mimeType || dl.contentType || "application/octet-stream";
      file = new File([new Uint8Array(fileBuffer)], fileName, { type: effMime });

      dateOverride = String(raw.date ?? "").trim();
      plannedDate = String(raw.plannedDate ?? "").trim();
      notes = String(raw.notes ?? "").trim();
      device = String(raw.device ?? "").trim();
      plannedWorkoutId = String(raw.plannedWorkoutId ?? "").trim();
      importIntent = normalizeTrainingImportIntent(raw.importIntent);
    } else {
      const form = await req.formData();
      athleteId = String(form.get("athleteId") ?? "").trim();
      const fileEntry = form.get("file");
      dateOverride = String(form.get("date") ?? "").trim();
      plannedDate = String(form.get("plannedDate") ?? "").trim();
      notes = String(form.get("notes") ?? "").trim();
      device = String(form.get("device") ?? "").trim();
      plannedWorkoutId = String(form.get("plannedWorkoutId") ?? "").trim();
      importIntent = normalizeTrainingImportIntent(form.get("importIntent"));

      if (!athleteId) {
        return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
      }
      if (!(fileEntry instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400, headers: NO_STORE });
      }
      file = fileEntry;

      ({ db } = await requireAthleteWriteContext(req, athleteId));
      fileBuffer = Buffer.from(await file.arrayBuffer());
    }

    const fileChecksum = createHash("sha1").update(fileBuffer).digest("hex");

    const route = resolveTrainingImportRoute({
      intent: importIntent,
      fileName: file.name,
      mimeType: file.type,
      buffer: fileBuffer,
    });

    if (route.kind === "planned_program") {
      const plannedBody = await runPlannedProgramFileImport(db, {
        athleteId,
        file,
        fileChecksum,
        fileBuffer,
        notes,
      });
      return NextResponse.json(plannedBody, { headers: NO_STORE });
    }

    if (route.kind === "planned_structured") {
      const anchorDate = plannedDate || dateOverride || inferDateFromFileName(file.name);
      if (!anchorDate) {
        return NextResponse.json(
          {
            error:
              "Per sedute strutturate (ZWO, ERG, MRC, FIT workout) serve la data: usa il giorno nel calendario o il campo data.",
          },
          { status: 400, headers: NO_STORE },
        );
      }
      const structuredBody = await runStructuredPlannedSingleImport(db, {
        athleteId,
        file,
        fileChecksum,
        fileBuffer,
        notes,
        date: anchorDate,
        format: route.format,
        routeReason: route.routeReason,
      });
      return NextResponse.json(structuredBody, { headers: NO_STORE });
    }

    const parsed = await parseTrainingFile({
      fileName: file.name,
      mimeType: file.type,
      buffer: fileBuffer,
    });

    const structuredFallback = fitStructuredFallbackAfterEmptyExecuted({
      fileName: file.name,
      mimeType: file.type,
      buffer: fileBuffer,
      durationMinutes: parsed.durationMinutes,
      intent: importIntent,
    });

    if (structuredFallback) {
      const anchorDate =
        plannedDate || dateOverride || inferDateFromFileName(file.name) || parsed.date;
      if (!anchorDate) {
        return NextResponse.json(
          {
            error:
              "Per sedute strutturate (FIT workout) serve la data: usa il giorno nel calendario o il campo data.",
          },
          { status: 400, headers: NO_STORE },
        );
      }
      const structuredBody = await runStructuredPlannedSingleImport(db, {
        athleteId,
        file,
        fileChecksum,
        fileBuffer,
        notes,
        date: anchorDate,
        format: structuredFallback.format,
        routeReason: structuredFallback.routeReason,
      });
      return NextResponse.json(structuredBody, { headers: NO_STORE });
    }

    const date = dateOverride || parsed.date || inferDateFromFileName(file.name);
    if (!date) {
      return NextResponse.json(
        {
          error:
            "Impossibile determinare la data dal file (FIT/FIT.GZ/CSV/JSON/TCX/GPX). Inserisci una data manuale.",
        },
        { status: 400, headers: NO_STORE },
      );
    }

    const normalized = normalizeImportedTraceSummary({
      parsed,
      fileName: file.name,
      deviceHint: device || undefined,
    });
    const trace = normalized.traceSummary as Record<string, unknown>;
    const parserEngine = typeof trace.parser_engine === "string" ? trace.parser_engine : null;
    const parserVersion = typeof trace.parser_version === "string" ? trace.parser_version : null;
    const channels = (trace.channels_available ?? {}) as Record<string, unknown>;
    const channelCoverage = {
      power: channels.power ? 100 : 0,
      hr: channels.hr ? 100 : 0,
      speed: channels.speed ? 100 : 0,
      cadence: channels.cadence ? 100 : 0,
      altitude: channels.altitude ? 100 : 0,
      temperature: channels.temperature ? 100 : 0,
    };
    const quality = buildExecutedTrainingImportQuality({ channelCoverage });
    const sourceTag = `file_import:${parsed.format}:${normalized.vendor}`;
    const realityEnvelope = buildRealityIngestionEnvelope({
      athleteId,
      domain: "training",
      sourceKind: "file_import",
      provider: normalized.vendor,
      sessionDate: date,
      format: parsed.format,
      device: device || null,
      fileName: file.name,
      fileChecksumSha1: fileChecksum,
      parserEngine,
      parserVersion,
      qualityStatus: quality.qualityStatus,
      qualityNote: quality.qualityNote,
      channelCoverage,
      missingChannels: quality.missingChannels,
      recommendedInputs: quality.recommendedInputs,
      canonicalPreview: {
        source: sourceTag,
        duration_minutes: parsed.durationMinutes,
        tss: parsed.tss,
        kcal: parsed.kcal,
        kj: parsed.kj,
        planned_workout_id: plannedWorkoutId || null,
      },
      rawRefs: {
        trace_summary_keys: Object.keys(normalized.traceSummary),
      },
    });

    const startJob = await db
      .from("training_import_jobs")
      .insert({
        athlete_id: athleteId,
        mode: "executed",
        source_format: parsed.format,
        source_vendor: normalized.vendor,
        source_device: device || null,
        parser_engine: parserEngine,
        parser_version: parserVersion,
        status: "processing",
        file_name: file.name,
        file_size_bytes: file.size,
        file_checksum_sha1: fileChecksum,
        imported_date: date,
        quality_status: quality.qualityStatus,
        quality_note: quality.qualityNote,
        channel_coverage: channelCoverage,
        payload: realityEnvelope,
      })
      .select("id")
      .single();
    if (!startJob.error) importJobId = startJob.data?.id ?? null;
    const payload = {
      athlete_id: athleteId,
      date,
      duration_minutes: Math.max(0, Math.round(parsed.durationMinutes)),
      tss: Math.max(0, parsed.tss),
      kcal: parsed.kcal,
      kj: parsed.kj,
      trace_summary: {
        ...normalized.traceSummary,
        session_day_key: date,
        imported_file_name: file.name,
        imported_mime_type: file.type || null,
        import_file_checksum_sha1: fileChecksum,
        import_quality: {
          coverage_pct: quality.coveragePct,
          quality_status: quality.qualityStatus,
          quality_note: quality.qualityNote,
          missing_channels: quality.missingChannels,
          recommended_inputs: quality.recommendedInputs,
          channel_coverage_pct: channelCoverage,
        },
      },
      subjective_notes: notes || null,
      source: sourceTag,
      planned_workout_id: plannedWorkoutId || null,
      external_id: buildExternalId({
        athleteId,
        date,
        format: parsed.format,
        fileChecksumSha1: fileChecksum,
        fileName: file.name,
      }),
    };

    const existingRes = await db
      .from("executed_workouts")
      .select("id")
      .eq("athlete_id", athleteId)
      .eq("external_id", payload.external_id)
      .limit(1)
      .maybeSingle();

    if (existingRes.error) {
      if (importJobId) {
        await db
          .from("training_import_jobs")
          .update({
            status: "error",
            error_message: existingRes.error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", importJobId);
      }
      return NextResponse.json({ error: existingRes.error.message }, { status: 500, headers: NO_STORE });
    }

    let data: Record<string, unknown> | null = null;
    if (existingRes.data?.id) {
      const updateRes = await db
        .from("executed_workouts")
        .update(payload)
        .eq("id", existingRes.data.id)
        .eq("athlete_id", athleteId)
        .select(
          "id, athlete_id, date, duration_minutes, tss, source, kcal, kj, trace_summary, lactate_mmoll, glucose_mmol, smo2, subjective_notes",
        )
        .single();
      if (updateRes.error) {
        if (importJobId) {
          await db
            .from("training_import_jobs")
            .update({
              status: "error",
              error_message: updateRes.error.message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", importJobId);
        }
        return NextResponse.json({ error: updateRes.error.message }, { status: 500, headers: NO_STORE });
      }
      data = updateRes.data as Record<string, unknown>;
    } else {
      const insertRes = await db
        .from("executed_workouts")
        .insert(payload)
        .select(
          "id, athlete_id, date, duration_minutes, tss, source, kcal, kj, trace_summary, lactate_mmoll, glucose_mmol, smo2, subjective_notes",
        )
        .single();
      if (insertRes.error) {
        if (importJobId) {
          await db
            .from("training_import_jobs")
            .update({
              status: "error",
              error_message: insertRes.error.message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", importJobId);
        }
        return NextResponse.json({ error: insertRes.error.message }, { status: 500, headers: NO_STORE });
      }
      data = insertRes.data as Record<string, unknown>;
    }

    /** Fase 3: serie HD su tabella dedicata. Best-effort: niente errore se la tabella manca. */
    const persistedSeriesResult = data?.id
      ? await persistExecutedWorkoutSeriesFromTrace({
          db,
          athleteId,
          executedWorkoutId: data.id as string,
          traceSummary: payload.trace_summary as Record<string, unknown>,
          parserEngine,
          parserVersion,
          source: `file_import:${parsed.format}`,
        }).catch((err) => ({
          attempted: 0,
          written: 0,
          skipped: 0,
          errors: [err instanceof Error ? err.message : "unknown"],
        }))
      : null;

    if (data?.id && payload.planned_workout_id) {
      void tryRecordArchetypeTraceFromExecuted({
        db,
        athleteId,
        plannedWorkoutId: String(payload.planned_workout_id),
        executedWorkoutId: String(data.id),
        executedTss: Number(payload.tss ?? 0),
        observedAt: date,
      });
    }

    if (importJobId) {
      await db
        .from("training_import_jobs")
        .update({
          status: "done",
          imported_workout_id: (data?.id as string | undefined) ?? null,
          imported_date: date,
          updated_at: new Date().toISOString(),
          payload: {
            ...realityEnvelope,
            externalId: payload.external_id,
            canonicalPreview: {
              ...realityEnvelope.canonicalPreview,
              imported_workout_id: (data?.id as string | undefined) ?? null,
            },
          },
        })
        .eq("id", importJobId);
    }

    let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemorySlice>> | null = null;
    let athleteMemoryError: string | null = null;
    try {
      athleteMemory = await resolveAthleteMemorySlice(athleteId, { slice: "training" });
    } catch (memErr) {
      athleteMemoryError = memErr instanceof Error ? memErr.message : "resolveAthleteMemorySlice failed";
    }

    return NextResponse.json(
      {
        status: "ok" as const,
        imported: data,
        athleteMemory,
        ...(athleteMemoryError ? { athleteMemoryError } : {}),
        ingestion: {
          ...realityEnvelope,
          externalId: payload.external_id,
        },
        parsed: {
          format: parsed.format,
          date,
          duration_minutes: parsed.durationMinutes,
          tss: parsed.tss,
        },
        detectedKind: route.detectedKind,
        routeReason: route.routeReason,
        visibilityCheck: {
          athlete_id: athleteId,
          date,
        },
        importJobId,
        ...(persistedSeriesResult ? { seriesPersist: persistedSeriesResult } : {}),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Training import failed";
    if (importJobId) {
      try {
        await createServerSupabaseClient()
          .from("training_import_jobs")
          .update({ status: "error", error_message: message, updated_at: new Date().toISOString() })
          .eq("id", importJobId);
      } catch {
        // best-effort
      }
    }
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
