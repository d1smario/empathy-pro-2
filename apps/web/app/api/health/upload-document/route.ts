import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import {
  getHealthUploadsBucket,
  sanitizeHealthObjectName,
  uploadHealthObject,
} from "@/lib/health/health-upload-storage";
import {
  extractStructuredValuesFromLabText,
  type HealthPanelTypeForParse,
} from "@/lib/health/lab-text-extractors";
import { extractTextFromPdfBuffer } from "@/lib/health/parse-health-pdf";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const ALLOWED_TYPES = new Set<string>([
  "blood",
  "microbiota",
  "epigenetics",
  "hormones",
  "inflammation",
  "oxidative_stress",
]);

function isPdfMime(mime: string, filename: string): boolean {
  const m = mime.toLowerCase();
  if (m.includes("pdf") || m === "application/x-pdf") return true;
  return filename.toLowerCase().endsWith(".pdf");
}

/**
 * Upload documento Health: insert `biomarker_panels`, parsing PDF opzionale, Storage opzionale (`HEALTH_UPLOADS_BUCKET`).
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const athleteId = String(form.get("athleteId") ?? "").trim();
    const panelType = String(form.get("panelType") ?? "blood").trim();
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

    const pdf = isPdfMime(mime, filename);
    let pdfText: string | null = null;
    let pdfPages = 0;
    if (pdf) {
      const extracted = await extractTextFromPdfBuffer(buffer);
      if (extracted) {
        pdfText = extracted.text;
        pdfPages = extracted.numpages;
      }
    }

    const parsed = pdfText
      ? extractStructuredValuesFromLabText(pdfText, panelType as HealthPanelTypeForParse)
      : {};

    let importStatus: string;
    if (pdf && pdfText && Object.keys(parsed).length > 0) {
      importStatus = "parsed_partial";
    } else if (pdf && pdfText) {
      importStatus = "parse_no_match";
    } else if (pdf && !pdfText) {
      importStatus = "parse_no_text";
    } else if (mime.startsWith("image/")) {
      importStatus = "image_queued";
    } else {
      importStatus = "queued_parser";
    }

    const importBlock: Record<string, unknown> = {
      filename,
      mime,
      size_bytes: buffer.length,
      status: importStatus,
      uploaded_at: new Date().toISOString(),
      pdf_pages: pdf ? pdfPages : undefined,
      parsed_keys: Object.keys(parsed),
      note:
        importStatus === "parsed_partial"
          ? "Valori estratti dal PDF (euristica). Verifica in laboratorio prima di decisioni cliniche."
          : "In attesa di estrazione manuale o parser dedicato se il PDF non è leggibile o non contiene le etichette attese.",
    };

    const values: Record<string, unknown> = {
      ...parsed,
      import: importBlock,
    };

    const { data: inserted, error } = await db
      .from("biomarker_panels")
      .insert({
        athlete_id: athleteId,
        type: panelType,
        sample_date: sampleDate,
        source: "health_upload_v1",
        values,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
    }

    const panelId = inserted?.id ?? null;
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
    if (Object.keys(parsed).length > 0) parts.push(`${Object.keys(parsed).length} parametri dal PDF`);
    if (storagePath) parts.push("file su Storage");
    else if (bucket && storageErr) parts.push(`Storage: ${storageErr}`);
    else if (!bucket) parts.push("Storage non configurato (HEALTH_UPLOADS_BUCKET)");

    return NextResponse.json(
      {
        ok: true as const,
        panelId,
        parsedKeys: Object.keys(parsed),
        storagePath,
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
