import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { getHealthUploadsBucket } from "@/lib/health/health-upload-storage";
import {
  buildHealthImportBlock,
  buildPanelValuesPayload,
  decodeHealthDocument,
  persistHealthVlmStagingRun,
  selectPanelSourceTag,
} from "@/lib/health/health-document-pipeline";
import type { HealthPanelTypeForParse } from "@/lib/health/lab-text-extractors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

const ALLOWED_TYPES = new Set<HealthPanelTypeForParse>([
  "blood",
  "microbiota",
  "epigenetics",
  "hormones",
  "inflammation",
  "oxidative_stress",
]);

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Re-analyze panel esistente: thin entry-point, **convoglia** sulla stessa
 * pipeline canonica usata da `/api/health/upload-document`. Niente decode,
 * niente persist staging run reimplementati qui.
 *
 * Architecture gate (`empathy_pro2_no_parallel_lines.mdc`):
 *   - scarica il file dal bucket Storage del panel
 *   - chiama `decodeHealthDocument` (parser → VLM Claude/GPT-4o)
 *   - aggiorna `biomarker_panels.values` con la stessa shape canonica
 *   - persiste lo staging run con `trigger_source: health_panel_reanalyze_vlm`
 *
 * Body JSON: `{ athleteId: string }`.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const panelId = params.id?.trim();
    if (!panelId) {
      return NextResponse.json({ ok: false as const, error: "missing_panel_id" }, { status: 400, headers: NO_STORE });
    }
    const body = (await req.json().catch(() => ({}))) as { athleteId?: string };
    const athleteId = String(body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const { db } = await requireAthleteWriteContext(req, athleteId);

    const { data: panel, error: panelErr } = await db
      .from("biomarker_panels")
      .select("id, athlete_id, type, sample_date, source, values")
      .eq("id", panelId)
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (panelErr) {
      return NextResponse.json({ ok: false as const, error: panelErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!panel) {
      return NextResponse.json({ ok: false as const, error: "panel_not_found" }, { status: 404, headers: NO_STORE });
    }
    const panelType = String(panel.type ?? "") as HealthPanelTypeForParse;
    if (!ALLOWED_TYPES.has(panelType)) {
      return NextResponse.json(
        { ok: false as const, error: "unsupported_panel_type", panelType },
        { status: 409, headers: NO_STORE },
      );
    }
    const valuesIn = asRecord((panel as { values?: unknown }).values);
    const importIn = asRecord(valuesIn.import);
    const storagePath = typeof importIn.storage_path === "string" ? importIn.storage_path : null;
    const mime = typeof importIn.mime === "string" ? importIn.mime : "application/octet-stream";
    const filename = typeof importIn.filename === "string" ? importIn.filename : "upload.bin";

    const bucket = getHealthUploadsBucket();
    if (!bucket) {
      return NextResponse.json(
        { ok: false as const, error: "storage_bucket_not_configured" },
        { status: 503, headers: NO_STORE },
      );
    }
    if (!storagePath) {
      return NextResponse.json(
        { ok: false as const, error: "no_file_in_storage" },
        { status: 409, headers: NO_STORE },
      );
    }

    const dl = await db.storage.from(bucket).download(storagePath);
    if (dl.error || !dl.data) {
      return NextResponse.json(
        { ok: false as const, error: dl.error?.message ?? "storage_download_failed" },
        { status: 500, headers: NO_STORE },
      );
    }
    const arrayBuffer = await dl.data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const decode = await decodeHealthDocument({ buffer, mime, filename, panelType });

    if (decode.importStatus !== "vlm_proposed" && Object.keys(decode.parsed).length === 0) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "decode_no_fields",
          note: "Né il parser deterministico né il VLM hanno estratto campi.",
          importStatus: decode.importStatus,
        },
        { status: 502, headers: NO_STORE },
      );
    }

    const sampleDate =
      typeof panel.sample_date === "string" && panel.sample_date.length >= 8
        ? String(panel.sample_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const importBlock = buildHealthImportBlock({
      filename,
      mime,
      sizeBytes: buffer.length,
      decode,
    });
    // Conserviamo tag Storage già presenti su panel.values.import:
    const importMerged = {
      ...importBlock,
      ...(typeof importIn.storage_bucket === "string" ? { storage_bucket: importIn.storage_bucket } : {}),
      ...(typeof importIn.storage_path === "string" ? { storage_path: importIn.storage_path } : {}),
      ...(typeof importIn.storage_uploaded_at === "string"
        ? { storage_uploaded_at: importIn.storage_uploaded_at }
        : {}),
    };
    const valuesOut = buildPanelValuesPayload({ decode, importBlock: importMerged });

    const { error: updateErr } = await db
      .from("biomarker_panels")
      .update({ values: valuesOut, source: selectPanelSourceTag(decode) })
      .eq("id", panelId)
      .eq("athlete_id", athleteId);
    if (updateErr) {
      return NextResponse.json({ ok: false as const, error: updateErr.message }, { status: 500, headers: NO_STORE });
    }

    let stagingRunId: string | null = null;
    if (decode.importStatus === "vlm_proposed" && decode.vlmProposals.length > 0) {
      const sr = await persistHealthVlmStagingRun({
        db,
        athleteId,
        panelId,
        panelType,
        sampleDate,
        decode,
        triggerSource: "health_panel_reanalyze_vlm",
      });
      stagingRunId = sr.stagingRunId;
    }

    return NextResponse.json(
      {
        ok: true as const,
        panelId,
        importStatus: decode.importStatus,
        stagingRunId,
        reviewUrl: stagingRunId ? `/health/staging/${stagingRunId}` : null,
        fieldCount:
          decode.importStatus === "vlm_proposed"
            ? decode.vlmProposals.length
            : Object.keys(decode.parsed).length,
        provider: decode.vlmProvider,
        model: decode.vlmModel,
        detectedProvider: decode.vlmDetectedProvider,
        message:
          decode.importStatus === "vlm_proposed"
            ? `${decode.vlmProposals.length} parametri proposti via ${decode.vlmProvider === "anthropic" ? "Claude" : "GPT-4o"}`
            : `${Object.keys(decode.parsed).length} parametri letti dal parser`,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "panel_analyze_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
