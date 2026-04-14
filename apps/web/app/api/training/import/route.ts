import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { buildRealityIngestionEnvelope } from "@/lib/reality/build-ingestion-envelope";
import { buildExecutedTrainingImportQuality } from "@/lib/reality/training-import-quality";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { normalizeImportedTraceSummary } from "@/lib/training/import-normalizer";
import { parseTrainingFile } from "@/lib/training/import-parser";

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
 */
export async function POST(req: NextRequest) {
  let importJobId: string | null = null;
  try {
    const form = await req.formData();
    const athleteId = String(form.get("athleteId") ?? "").trim();
    const file = form.get("file");
    const dateOverride = String(form.get("date") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const device = String(form.get("device") ?? "").trim();
    const plannedWorkoutId = String(form.get("plannedWorkoutId") ?? "").trim();

    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileChecksum = createHash("sha1").update(fileBuffer).digest("hex");
    const parsed = await parseTrainingFile({
      fileName: file.name,
      mimeType: file.type,
      buffer: fileBuffer,
    });

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

    let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemory>> | null = null;
    let athleteMemoryError: string | null = null;
    try {
      athleteMemory = await resolveAthleteMemory(athleteId);
    } catch (memErr) {
      athleteMemoryError = memErr instanceof Error ? memErr.message : "resolveAthleteMemory failed";
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
        visibilityCheck: {
          athlete_id: athleteId,
          date,
        },
        importJobId,
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
