import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { getHealthUploadsBucket } from "@/lib/health/health-upload-storage";
import {
  decodeHealthDocumentWithVlm,
  type HealthPanelKindForVlm,
} from "@/lib/health/health-vlm-decode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

const VLM_PANEL_TYPES = new Set<string>([
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
 * Re-analizza un `biomarker_panels` esistente:
 *  - scarica il file dal bucket Storage (deve essere image/* o PDF-scan)
 *  - chiama VLM (Claude → GPT-4o)
 *  - crea/aggiorna `interpretation_staging_runs` con `proposed_structured_patches`
 *  - **non** scrive in `biomarker_panels.values`: la conferma resta sulla review page
 *
 * Body JSON: `{ athleteId: string }` (per double-check; il panel ha già athlete_id).
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
    const panelType = String(panel.type ?? "");
    if (!VLM_PANEL_TYPES.has(panelType)) {
      return NextResponse.json(
        { ok: false as const, error: "unsupported_panel_type", panelType },
        { status: 409, headers: NO_STORE },
      );
    }
    const values = asRecord((panel as { values?: unknown }).values);
    const importBlock = asRecord(values.import);
    const storagePath = typeof importBlock.storage_path === "string" ? importBlock.storage_path : null;
    const mime = typeof importBlock.mime === "string" ? importBlock.mime : "application/octet-stream";
    const filename = typeof importBlock.filename === "string" ? importBlock.filename : "upload.bin";

    const bucket = getHealthUploadsBucket();
    if (!bucket) {
      return NextResponse.json(
        { ok: false as const, error: "storage_bucket_not_configured" },
        { status: 503, headers: NO_STORE },
      );
    }
    if (!storagePath) {
      return NextResponse.json(
        { ok: false as const, error: "no_file_in_storage", note: "Il pannello non ha un file collegato (storage_path mancante)." },
        { status: 409, headers: NO_STORE },
      );
    }

    // Scarica il file dal bucket
    const dl = await db.storage.from(bucket).download(storagePath);
    if (dl.error || !dl.data) {
      return NextResponse.json(
        { ok: false as const, error: dl.error?.message ?? "storage_download_failed" },
        { status: 500, headers: NO_STORE },
      );
    }
    const arrayBuffer = await dl.data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Anthropic Claude accetta image/* e application/pdf nativamente.
    const isImage = /^image\//i.test(mime);
    const isPdf = /^application\/pdf$/i.test(mime);
    if (!isImage && !isPdf) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "vlm_unsupported_mime",
          note: "Il VLM accetta image/* o application/pdf.",
          mime,
          filename,
        },
        { status: 415, headers: NO_STORE },
      );
    }

    const vlm = await decodeHealthDocumentWithVlm({
      buffer,
      mime,
      panelType: panelType as HealthPanelKindForVlm,
    });
    if (!vlm || vlm.fields.length === 0) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "vlm_no_fields",
          note: "Il VLM non ha estratto campi (chiavi mancanti o file non leggibile).",
        },
        { status: 502, headers: NO_STORE },
      );
    }

    // Costruisci `proposed_structured_patches`
    const patches = vlm.fields.map((p) => ({
      target: `health.${panelType}`,
      action: "set_field",
      field: p.field,
      proposed_value: p.value,
      unit: p.unit ?? null,
      reference_range: p.referenceRange ?? null,
      confidence: p.confidence,
      notes: p.notes ?? null,
    }));
    const overallConfidence =
      vlm.fields.reduce((acc, p) => acc + (p.confidence || 0), 0) / Math.max(1, vlm.fields.length);

    const sampleDate =
      typeof panel.sample_date === "string" && panel.sample_date.length >= 8
        ? String(panel.sample_date).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const { data: stagingRun, error: stagingErr } = await db
      .from("interpretation_staging_runs")
      .insert({
        athlete_id: athleteId,
        domain: "health",
        status: "pending_validation",
        trigger_source: "health_upload_vlm",
        source_refs: [{ table: "biomarker_panels", id: panelId }],
        candidate_bundle: {
          panel_type: panelType,
          sample_date: sampleDate,
          vlm_provider: vlm.providerUsed,
          vlm_model: vlm.modelUsed,
          detected_provider: vlm.detectedProvider,
          quality_notes: vlm.qualityNotes,
          field_count: vlm.fields.length,
          re_analysis: true,
        },
        proposed_structured_patches: patches,
        confidence: Math.max(0, Math.min(1, overallConfidence)),
      })
      .select("id")
      .maybeSingle();
    if (stagingErr) {
      return NextResponse.json({ ok: false as const, error: stagingErr.message }, { status: 500, headers: NO_STORE });
    }
    const runId = stagingRun?.id ?? null;

    // Aggiorna `biomarker_panels.values` per riflettere lo stato pending VLM
    const nextValues: Record<string, unknown> = { ...values };
    nextValues.vlm_pending_validation = true;
    nextValues.vlm_proposals = vlm.fields.map((p) => ({
      field: p.field,
      value: p.value,
      unit: p.unit,
      reference_range: p.referenceRange,
      confidence: p.confidence,
      notes: p.notes,
    }));
    nextValues.import = {
      ...importBlock,
      status: "vlm_proposed",
      vlm: {
        provider: vlm.providerUsed,
        model: vlm.modelUsed,
        detected_provider: vlm.detectedProvider,
        field_count: vlm.fields.length,
        re_analyzed_at: new Date().toISOString(),
      },
    };
    await db
      .from("biomarker_panels")
      .update({ values: nextValues, source: "health_upload_vlm_v1" })
      .eq("id", panelId)
      .eq("athlete_id", athleteId);

    return NextResponse.json(
      {
        ok: true as const,
        panelId,
        stagingRunId: runId,
        reviewUrl: runId ? `/health/staging/${runId}` : null,
        fieldCount: vlm.fields.length,
        provider: vlm.providerUsed,
        model: vlm.modelUsed,
        detectedProvider: vlm.detectedProvider,
        message: `${vlm.fields.length} parametri proposti via ${vlm.providerUsed === "anthropic" ? "Claude" : "GPT-4o"}`,
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
