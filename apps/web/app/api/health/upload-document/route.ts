import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import {
  getHealthUploadsBucket,
  sanitizeHealthObjectName,
  uploadHealthObject,
} from "@/lib/health/health-upload-storage";
import {
  buildHealthImportBlock,
  buildPanelValuesPayload,
  decodeHealthDocument,
  persistHealthVlmStagingRun,
  runHealthDeterministicPostProcess,
  selectPanelSourceTag,
  type HealthNormalizationSummary,
} from "@/lib/health/health-document-pipeline";
import type { HealthPanelTypeForParse } from "@/lib/health/lab-text-extractors";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const ALLOWED_TYPES = new Set<HealthPanelTypeForParse>([
  "blood",
  "microbiota",
  "epigenetics",
  "hormones",
  "inflammation",
  "oxidative_stress",
]);

/**
 * Upload documento Health (linea generativa unica): convoglia in
 * `lib/health/health-document-pipeline.ts` per decode + persist + staging.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const athleteId = String(form.get("athleteId") ?? "").trim();
    const panelType = String(form.get("panelType") ?? "blood").trim() as HealthPanelTypeForParse;
    const sampleDateRaw = String(form.get("sampleDate") ?? "").trim();
    const file = form.get("file");

    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!ALLOWED_TYPES.has(panelType)) {
      return NextResponse.json({ ok: false as const, error: "invalid_panelType" }, { status: 400, headers: NO_STORE });
    }
    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ ok: false as const, error: "missing_file" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);

    const mime = file.type || "application/octet-stream";
    const filename = file instanceof File ? file.name : "upload.bin";
    const maxBytes = 12 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ ok: false as const, error: "file_too_large" }, { status: 413, headers: NO_STORE });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sampleDate =
      sampleDateRaw.length >= 8 ? sampleDateRaw.slice(0, 10) : new Date().toISOString().slice(0, 10);

    const decode = await decodeHealthDocument({ buffer, mime, filename, panelType });
    const importBlock = buildHealthImportBlock({
      filename,
      mime,
      sizeBytes: buffer.length,
      decode,
    });
    const values = buildPanelValuesPayload({ decode, importBlock });

    const { data: inserted, error } = await db
      .from("biomarker_panels")
      .insert({
        athlete_id: athleteId,
        type: panelType,
        sample_date: sampleDate,
        source: selectPanelSourceTag(decode),
        values,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
    }

    const panelId = inserted?.id ?? null;
    let normalizationSummary: HealthNormalizationSummary | null = null;

    if (panelId && decode.importStatus === "vlm_proposed" && decode.vlmProposals.length > 0) {
      const sr = await persistHealthVlmStagingRun({
        db,
        athleteId,
        panelId,
        panelType,
        sampleDate,
        decode,
        triggerSource: "health_upload_vlm",
      });
      normalizationSummary = {
        extractionRunId: null,
        observationsInserted: 0,
        lineageInserted: 0,
        nodesInserted: 0,
        edgesInserted: 0,
        responsesInserted: 0,
        stagingRunId: sr.stagingRunId,
      };
    }

    if (panelId && decode.importStatus !== "vlm_proposed") {
      const post = await runHealthDeterministicPostProcess({
        db,
        athleteId,
        panelId,
        panelType,
        sampleDate,
        decode,
        filename,
        bufferSize: buffer.length,
      });
      normalizationSummary = post.summary;
      if (post.normalizationError) {
        const nextValues = {
          ...values,
          import: { ...importBlock, normalization_error: post.normalizationError },
        };
        await db.from("biomarker_panels").update({ values: nextValues }).eq("id", panelId);
      }
    }

    const bucket = getHealthUploadsBucket();
    let storagePath: string | null = null;
    let storageErr: string | null = null;

    if (bucket && panelId) {
      const safe = sanitizeHealthObjectName(filename);
      const objectPath = `${athleteId}/${panelId}/${safe}`;
      const up = await uploadHealthObject(db, bucket, objectPath, buffer, mime);
      if (up.ok) {
        storagePath = objectPath;
        const nextValues = {
          ...values,
          import: {
            ...importBlock,
            storage_bucket: bucket,
            storage_path: objectPath,
            storage_uploaded_at: new Date().toISOString(),
          },
        };
        await db.from("biomarker_panels").update({ values: nextValues }).eq("id", panelId);
      } else {
        storageErr = up.message;
        const nextValues = {
          ...values,
          import: {
            ...importBlock,
            storage_error: up.message,
            storage_bucket: bucket,
          },
        };
        await db.from("biomarker_panels").update({ values: nextValues }).eq("id", panelId);
      }
    }

    const parts: string[] = [];
    if (Object.keys(decode.parsed).length > 0) {
      parts.push(`${Object.keys(decode.parsed).length} parametri dal PDF`);
    }
    if (decode.importStatus === "vlm_proposed") {
      parts.push(
        `${decode.vlmProposals.length} parametri proposti via ${decode.vlmProvider === "anthropic" ? "Claude" : "GPT-4o"} (vision)${decode.vlmDetectedProvider ? ` · provider rilevato: ${decode.vlmDetectedProvider}` : ""}`,
      );
    }
    if (normalizationSummary?.observationsInserted) {
      parts.push(`${normalizationSummary.observationsInserted} osservazioni normalizzate`);
    }
    if (normalizationSummary?.lineageInserted) {
      parts.push(`${normalizationSummary.lineageInserted} lineage`);
    }
    if ((normalizationSummary?.edgesInserted ?? 0) > 0 || (normalizationSummary?.responsesInserted ?? 0) > 0) {
      parts.push(
        `grafo: ${normalizationSummary?.edgesInserted ?? 0} edge · ${normalizationSummary?.responsesInserted ?? 0} response`,
      );
    }
    if (normalizationSummary?.stagingRunId) {
      parts.push(
        decode.importStatus === "vlm_proposed" ? "review da confermare aperta" : "staging interpretativo aperto",
      );
    }
    if (storagePath) parts.push("file su Storage");
    else if (bucket && storageErr) parts.push(`Storage: ${storageErr}`);
    else if (!bucket) parts.push("Storage non configurato (HEALTH_UPLOADS_BUCKET)");

    return NextResponse.json(
      {
        ok: true as const,
        panelId,
        parsedKeys: Object.keys(decode.parsed),
        normalization: normalizationSummary,
        storagePath,
        importStatus: decode.importStatus,
        stagingRunId: normalizationSummary?.stagingRunId ?? null,
        reviewUrl: normalizationSummary?.stagingRunId
          ? `/health/staging/${normalizationSummary.stagingRunId}`
          : null,
        message: parts.length ? `Registrato. ${parts.join(" · ")}.` : "Documento registrato.",
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
