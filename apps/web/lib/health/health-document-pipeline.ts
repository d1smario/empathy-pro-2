/**
 * Pipeline canonica di decode + persist per i referti Health.
 *
 * Architecture gate (`empathy_generative_core.mdc`, `empathy_pro2_no_parallel_lines.mdc`):
 *   AI ≠ motore. Il VLM produce **proposte** che NON entrano direttamente in
 *   `biomarker_panels.values`: vengono persistite come `proposed_structured_patches`
 *   in `interpretation_staging_runs` e diventano valori canonici solo dopo conferma.
 *
 *   Esiste **una sola** linea generativa per Health ingest:
 *   parser deterministico → VLM fallback (Claude → GPT-4o) → staging run + values.
 *   Tutti i caller (upload iniziale, re-analyze su panel esistente, futuri trigger)
 *   convogliano qui. Vietato duplicare decode/persist altrove.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  extractStructuredValuesFromLabText,
  type HealthPanelTypeForParse,
} from "@/lib/health/lab-text-extractors";
import { extractTextFromPdfBuffer } from "@/lib/health/parse-health-pdf";
import {
  decodeHealthDocumentWithVlm,
  type HealthFieldProposal,
  type HealthPanelKindForVlm,
} from "@/lib/health/health-vlm-decode";
import { persistNormalizedObservations } from "@/lib/health/health-observation-normalizer";
import { buildAndPersistHealthCausalInteractions } from "@/lib/health/health-causal-interactions";

export type HealthDecodeImportStatus =
  | "parsed_full"
  | "parsed_partial"
  | "vlm_proposed"
  | "needs_manual_review"
  | "failed";

export type HealthDecodeResult = {
  parsed: Record<string, unknown>;
  vlmProposals: HealthFieldProposal[];
  vlmProvider: "anthropic" | "openai" | null;
  vlmModel: string | null;
  vlmDetectedProvider: string | null;
  vlmQualityNotes: string[];
  isPdf: boolean;
  isImage: boolean;
  isPdfScan: boolean;
  pdfPages: number;
  pdfText: string | null;
  importStatus: HealthDecodeImportStatus;
};

function isPdfMime(mime: string, filename: string): boolean {
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf") || m === "application/x-pdf") return true;
  return (filename || "").toLowerCase().endsWith(".pdf");
}

/**
 * Decode puro (no DB): tenta parser deterministico (solo PDF testuale) e in
 * fallback VLM (Claude → GPT-4o, image/* o application/pdf nativo). Idempotente:
 * stesso buffer + stesso panelType → stesso risultato (a meno di drift VLM).
 */
export async function decodeHealthDocument(input: {
  buffer: Buffer;
  mime: string;
  filename: string;
  panelType: HealthPanelTypeForParse;
}): Promise<HealthDecodeResult> {
  const { buffer, mime, filename, panelType } = input;
  const isPdf = isPdfMime(mime, filename);
  const isImage = /^image\//i.test(mime);

  let pdfText: string | null = null;
  let pdfPages = 0;
  if (isPdf) {
    const extracted = await extractTextFromPdfBuffer(buffer);
    if (extracted) {
      pdfText = extracted.text;
      pdfPages = extracted.numpages;
    }
  }

  const parsed: Record<string, unknown> = pdfText
    ? extractStructuredValuesFromLabText(pdfText, panelType)
    : {};
  const heuristicEmpty = Object.keys(parsed).length === 0;
  const isPdfScan = isPdf && !pdfText;

  let vlmProposals: HealthFieldProposal[] = [];
  let vlmProvider: "anthropic" | "openai" | null = null;
  let vlmModel: string | null = null;
  let vlmDetectedProvider: string | null = null;
  let vlmQualityNotes: string[] = [];

  // VLM fallback solo se il parser è muto e l'input è image/* o PDF.
  if (heuristicEmpty && (isImage || isPdf)) {
    try {
      const vlm = await decodeHealthDocumentWithVlm({
        buffer,
        mime: isPdf ? "application/pdf" : mime,
        panelType: panelType as HealthPanelKindForVlm,
      });
      if (vlm) {
        vlmProposals = vlm.fields;
        vlmProvider = vlm.providerUsed;
        vlmModel = vlm.modelUsed;
        vlmDetectedProvider = vlm.detectedProvider;
        vlmQualityNotes = vlm.qualityNotes;
      }
    } catch {
      // best-effort: provider mancante o errore di rete, restiamo su parsed/empty.
    }
  }

  let importStatus: HealthDecodeImportStatus;
  if (Object.keys(parsed).length > 0) {
    const hasStructured = Object.keys(parsed).some(
      (k) => k.endsWith("_taxa") || k.endsWith("_hits") || k.endsWith("_flags"),
    );
    importStatus = hasStructured ? "parsed_full" : "parsed_partial";
  } else if (vlmProposals.length > 0) {
    importStatus = "vlm_proposed";
  } else if (isImage || isPdfScan) {
    importStatus = "needs_manual_review";
  } else {
    importStatus = "failed";
  }

  return {
    parsed,
    vlmProposals,
    vlmProvider,
    vlmModel,
    vlmDetectedProvider,
    vlmQualityNotes,
    isPdf,
    isImage,
    isPdfScan,
    pdfPages,
    pdfText,
    importStatus,
  };
}

export type HealthImportBlock = {
  filename: string;
  mime: string;
  size_bytes: number;
  status: HealthDecodeImportStatus;
  uploaded_at: string;
  pdf_pages?: number;
  parsed_keys: string[];
  vlm: null | {
    provider: "anthropic" | "openai";
    model: string | null;
    detected_provider: string | null;
    field_count: number;
    quality_notes: string[];
  };
  note: string;
  storage_bucket?: string;
  storage_path?: string;
  storage_uploaded_at?: string;
  storage_error?: string;
  normalization_error?: string;
};

export function buildHealthImportBlock(input: {
  filename: string;
  mime: string;
  sizeBytes: number;
  decode: HealthDecodeResult;
  uploadedAt?: string;
}): HealthImportBlock {
  const { filename, mime, sizeBytes, decode } = input;
  const status = decode.importStatus;
  const note =
    status === "parsed_full" || status === "parsed_partial"
      ? "Valori estratti in modo euristico; conferma clinica obbligatoria prima di decisioni."
      : status === "vlm_proposed"
        ? "Valori proposti via VLM (vision). Da confermare nella pagina di review prima di entrare nell'archivio."
        : "Richiede revisione manuale: estrazione incompleta o input non testuale.";
  return {
    filename,
    mime,
    size_bytes: sizeBytes,
    status,
    uploaded_at: input.uploadedAt ?? new Date().toISOString(),
    pdf_pages: decode.isPdf ? decode.pdfPages : undefined,
    parsed_keys: Object.keys(decode.parsed),
    vlm:
      decode.vlmProvider != null
        ? {
            provider: decode.vlmProvider,
            model: decode.vlmModel,
            detected_provider: decode.vlmDetectedProvider,
            field_count: decode.vlmProposals.length,
            quality_notes: decode.vlmQualityNotes,
          }
        : null,
    note,
  };
}

/**
 * Costruisce il payload `biomarker_panels.values` finale a partire dal decode.
 *
 * Convenzione (esistente, preservata): se `vlm_proposed`, le proposte
 * vivono dentro `values.vlm_proposals` + `values.vlm_pending_validation` per
 * permettere a UI/grafici di leggere "shadow values" pre-conferma; il dato
 * canonico resta scritto da `apply` su `interpretation_staging_runs`.
 */
export function buildPanelValuesPayload(input: {
  decode: HealthDecodeResult;
  importBlock: HealthImportBlock;
}): Record<string, unknown> {
  const { decode, importBlock } = input;
  if (decode.importStatus === "vlm_proposed" && decode.vlmProposals.length > 0) {
    return {
      vlm_proposals: decode.vlmProposals.map((p) => ({
        field: p.field,
        value: p.value,
        unit: p.unit,
        reference_range: p.referenceRange,
        confidence: p.confidence,
        notes: p.notes,
      })),
      vlm_pending_validation: true,
      import: importBlock,
    };
  }
  return { ...decode.parsed, import: importBlock };
}

export function selectPanelSourceTag(decode: HealthDecodeResult): string {
  return decode.importStatus === "vlm_proposed" ? "health_upload_vlm_v1" : "health_upload_v1";
}

/**
 * Persist staging run per VLM-proposed: unico writer.
 */
export async function persistHealthVlmStagingRun(args: {
  db: SupabaseClient;
  athleteId: string;
  panelId: string;
  panelType: HealthPanelTypeForParse;
  sampleDate: string;
  decode: HealthDecodeResult;
  triggerSource?: "health_upload_vlm" | "health_panel_reanalyze_vlm";
}): Promise<{ stagingRunId: string | null; error?: string }> {
  const trigger = args.triggerSource ?? "health_upload_vlm";
  const patches = args.decode.vlmProposals.map((p) => ({
    target: `health.${args.panelType}`,
    action: "set_field",
    field: p.field,
    proposed_value: p.value,
    unit: p.unit ?? null,
    reference_range: p.referenceRange ?? null,
    confidence: p.confidence,
    notes: p.notes ?? null,
  }));
  const overall =
    args.decode.vlmProposals.reduce((acc, p) => acc + (p.confidence || 0), 0) /
    Math.max(1, args.decode.vlmProposals.length);
  const { data, error } = await args.db
    .from("interpretation_staging_runs")
    .insert({
      athlete_id: args.athleteId,
      domain: "health",
      status: "pending_validation",
      trigger_source: trigger,
      source_refs: [{ table: "biomarker_panels", id: args.panelId }],
      candidate_bundle: {
        panel_type: args.panelType,
        sample_date: args.sampleDate,
        vlm_provider: args.decode.vlmProvider,
        vlm_model: args.decode.vlmModel,
        detected_provider: args.decode.vlmDetectedProvider,
        quality_notes: args.decode.vlmQualityNotes,
        field_count: args.decode.vlmProposals.length,
        re_analysis: trigger === "health_panel_reanalyze_vlm",
      },
      proposed_structured_patches: patches,
      confidence: Math.max(0, Math.min(1, overall)),
    })
    .select("id")
    .maybeSingle();
  if (error) return { stagingRunId: null, error: error.message };
  return { stagingRunId: data?.id ?? null };
}

export type HealthNormalizationSummary = {
  extractionRunId: string | null;
  observationsInserted: number;
  lineageInserted: number;
  nodesInserted: number;
  edgesInserted: number;
  responsesInserted: number;
  stagingRunId: string | null;
};

/**
 * Persist normalize + causal graph per panel parsed (deterministico). Crea uno
 * staging run interpretativo (no patches) se ci sono nuove osservazioni o nodi.
 */
export async function runHealthDeterministicPostProcess(args: {
  db: SupabaseClient;
  athleteId: string;
  panelId: string;
  panelType: HealthPanelTypeForParse;
  sampleDate: string;
  decode: HealthDecodeResult;
  filename: string;
  bufferSize: number;
}): Promise<{ summary: HealthNormalizationSummary | null; normalizationError: string | null }> {
  if (args.decode.importStatus === "vlm_proposed") return { summary: null, normalizationError: null };
  const sourceKind: "pdf" | "image" | "other" = args.decode.isPdf
    ? "pdf"
    : args.decode.isImage
      ? "image"
      : "other";
  try {
    const normalized = await persistNormalizedObservations({
      db: args.db,
      athleteId: args.athleteId,
      panelId: args.panelId,
      panelType: args.panelType,
      parsed: args.decode.parsed,
      sampleDate: args.sampleDate,
      sourceKind,
      parserVersion: "health-parser-v2",
      sourceHash: `${args.filename}:${args.bufferSize}`,
      qualityReport: {
        parsed_keys: Object.keys(args.decode.parsed),
        import_status: args.decode.importStatus,
      },
    });
    const causal = await buildAndPersistHealthCausalInteractions({
      db: args.db,
      athleteId: args.athleteId,
      sampleDate: args.sampleDate,
      parsed: args.decode.parsed,
      extractionRunId: normalized.extractionRunId,
      panelId: args.panelId,
    });
    const summary: HealthNormalizationSummary = {
      extractionRunId: normalized.extractionRunId,
      observationsInserted: normalized.inserted,
      lineageInserted: normalized.lineageInserted + causal.lineageInserted,
      nodesInserted: causal.nodesInserted,
      edgesInserted: causal.edgesInserted,
      responsesInserted: causal.responsesInserted,
      stagingRunId: null,
    };
    if (
      normalized.inserted > 0 ||
      causal.nodesInserted > 0 ||
      causal.edgesInserted > 0 ||
      causal.responsesInserted > 0
    ) {
      const { data: stagingRun } = await args.db
        .from("interpretation_staging_runs")
        .insert({
          athlete_id: args.athleteId,
          domain: "health",
          status: "pending_validation",
          trigger_source: "health_upload",
          source_refs: [
            { table: "biomarker_panels", id: args.panelId },
            normalized.extractionRunId ? { table: "extraction_runs", id: normalized.extractionRunId } : null,
          ].filter(Boolean),
          candidate_bundle: {
            panel_type: args.panelType,
            sample_date: args.sampleDate,
            parsed_keys: Object.keys(args.decode.parsed),
            observations_inserted: normalized.inserted,
            system_graph: {
              node_ids: causal.nodeIds,
              edge_ids: causal.edgeIds,
              response_ids: causal.responseIds,
            },
          },
          proposed_structured_patches: [],
          confidence: Object.keys(args.decode.parsed).length > 0 ? 0.72 : 0.35,
        })
        .select("id")
        .maybeSingle();
      summary.stagingRunId = stagingRun?.id ?? null;
    }
    return { summary, normalizationError: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "normalization_failed";
    return { summary: null, normalizationError: msg };
  }
}
