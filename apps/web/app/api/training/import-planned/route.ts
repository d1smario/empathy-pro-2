import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { buildRealityIngestionEnvelope } from "@/lib/reality/build-ingestion-envelope";
import { buildPlannedTrainingImportQuality } from "@/lib/reality/training-import-quality";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { clampPlannedWorkoutRow } from "@/lib/training/planned/clamp-planned-row";
import { parsePlannedProgramFile } from "@/lib/training/planned-import-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export async function POST(req: NextRequest) {
  let importJobId: string | null = null;
  try {
    const form = await req.formData();
    const athleteId = String(form.get("athleteId") ?? "").trim();
    const file = form.get("file");
    const notes = String(form.get("notes") ?? "").trim();

    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileChecksum = createHash("sha1").update(fileBuffer).digest("hex");
    const parsed = await parsePlannedProgramFile({
      fileName: file.name,
      buffer: fileBuffer,
    });
    if (!parsed.rows.length) {
      return NextResponse.json(
        { error: "Nessuna seduta valida trovata nel file programmazione." },
        { status: 400, headers: NO_STORE },
      );
    }

    const insertPayloads = parsed.rows.map((r) => {
      const kcal = r.kcal_target != null ? Math.round(r.kcal_target) : null;
      const row = clampPlannedWorkoutRow({
        athlete_id: athleteId,
        date: r.date,
        type: r.type,
        duration_minutes: r.duration_minutes,
        tss_target: r.tss_target,
        kcal_target: kcal,
        kj_target: kcal != null ? Math.round(kcal * 4.184) : null,
        notes: [r.notes, notes || null].filter(Boolean).join(" | ") || null,
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
    const hasCoachNotes =
      Boolean(notes) || parsed.rows.some((row) => Boolean(row.notes?.trim()));
    const quality = buildPlannedTrainingImportQuality({
      firstDate: sessionDate,
      rowCount: insertPayloads.length,
      hasCoachNotes,
    });
    const realityEnvelope = buildRealityIngestionEnvelope({
      athleteId,
      domain: "training",
      sourceKind: "file_import",
      provider: `planned_${parsed.sourceFormat}`,
      sessionDate,
      format: parsed.sourceFormat,
      fileName: file.name,
      fileChecksumSha1: fileChecksum,
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
        athlete_id: athleteId,
        mode: "planned",
        source_format: parsed.sourceFormat,
        source_vendor: "planned_import",
        status: "processing",
        file_name: file.name,
        file_size_bytes: file.size,
        file_checksum_sha1: fileChecksum,
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
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
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
    let athleteMemoryError: string | null = null;
    try {
      athleteMemory = await resolveAthleteMemory(athleteId);
    } catch (memErr) {
      athleteMemoryError = memErr instanceof Error ? memErr.message : "resolveAthleteMemory failed";
    }

    return NextResponse.json(
      {
        status: "ok" as const,
        athleteMemory,
        ...(athleteMemoryError ? { athleteMemoryError } : {}),
        ingestion: realityEnvelope,
        importedCount: insertPayloads.length,
        firstDate: parsed.firstDate,
        sourceFormat: parsed.sourceFormat,
        fileName: file.name,
        importJobId,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Planned import failed";
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
