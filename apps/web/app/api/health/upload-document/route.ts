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
import { persistNormalizedObservations } from "@/lib/health/health-observation-normalizer";
import { buildAndPersistHealthCausalInteractions } from "@/lib/health/health-causal-interactions";
import {
  decodeHealthDocumentWithVlm,
  type HealthFieldProposal,
  type HealthPanelKindForVlm,
} from "@/lib/health/health-vlm-decode";

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

    const parsed: Record<string, unknown> = pdfText
      ? extractStructuredValuesFromLabText(pdfText, panelType as HealthPanelTypeForParse)
      : {};

    /**
     * VLM decode (Fase B): se il parser euristico non ha trovato campi
     * strutturati e il file è image/* o PDF-scan illeggibile, prova Claude → GPT-4o.
     * AI ≠ motore: i numeri NON entrano in `biomarker_panels.values` ma in
     * `proposed_structured_patches` di uno staging run, da confermare in UI.
     */
    const isImage = mime.startsWith("image/");
    const isPdfScan = pdf && !pdfText;
    const heuristicEmpty = Object.keys(parsed).length === 0;

    let vlmProposals: HealthFieldProposal[] = [];
    let vlmProvider: "anthropic" | "openai" | null = null;
    let vlmModel: string | null = null;
    let vlmDetectedProvider: string | null = null;
    let vlmQualityNotes: string[] = [];
    if (heuristicEmpty && (isImage || isPdfScan)) {
      try {
        const vlm = await decodeHealthDocumentWithVlm({
          buffer,
          mime: isPdfScan ? "image/png" : mime,
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
        // best-effort: nessun VLM provider configurato, oppure errore di rete.
      }
    }

    let importStatus: string;
    if (Object.keys(parsed).length > 0) {
      const hasStructured = Object.keys(parsed).some((k) => k.endsWith("_taxa") || k.endsWith("_hits") || k.endsWith("_flags"));
      importStatus = hasStructured ? "parsed_full" : "parsed_partial";
    } else if (vlmProposals.length > 0) {
      importStatus = "vlm_proposed";
    } else if (isImage) {
      importStatus = "needs_manual_review";
    } else if (isPdfScan) {
      importStatus = "needs_manual_review";
    } else {
      importStatus = "failed";
    }

    const importBlock: Record<string, unknown> = {
      filename,
      mime,
      size_bytes: buffer.length,
      status: importStatus,
      uploaded_at: new Date().toISOString(),
      pdf_pages: pdf ? pdfPages : undefined,
      parsed_keys: Object.keys(parsed),
      vlm:
        vlmProvider != null
          ? {
              provider: vlmProvider,
              model: vlmModel,
              detected_provider: vlmDetectedProvider,
              field_count: vlmProposals.length,
              quality_notes: vlmQualityNotes,
            }
          : null,
      note:
        importStatus === "parsed_full" || importStatus === "parsed_partial"
          ? "Valori estratti in modo euristico; conferma clinica obbligatoria prima di decisioni."
          : importStatus === "vlm_proposed"
            ? "Valori proposti via VLM (vision). Da confermare nella pagina di review prima di entrare nell'archivio."
            : "Richiede revisione manuale: estrazione incompleta o input non testuale.",
    };

    /**
     * Modalità VLM-proposed: il pannello biomarker resta vuoto di valori canonici
     * finché l'utente non conferma in `/health/staging/[id]`. Manteniamo solo il
     * metadata `import` per l'audit.
     */
    const vlmProposalsForValues: Record<string, unknown> = {};
    if (importStatus === "vlm_proposed" && vlmProposals.length > 0) {
      vlmProposalsForValues.vlm_proposals = vlmProposals.map((p) => ({
        field: p.field,
        value: p.value,
        unit: p.unit,
        reference_range: p.referenceRange,
        confidence: p.confidence,
        notes: p.notes,
      }));
      vlmProposalsForValues.vlm_pending_validation = true;
    }

    const values: Record<string, unknown> = {
      ...(importStatus === "vlm_proposed" ? vlmProposalsForValues : parsed),
      import: importBlock,
    };

    const { data: inserted, error } = await db
      .from("biomarker_panels")
      .insert({
        athlete_id: athleteId,
        type: panelType,
        sample_date: sampleDate,
        source: importStatus === "vlm_proposed" ? "health_upload_vlm_v1" : "health_upload_v1",
        values,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
    }

    const panelId = inserted?.id ?? null;
    let normalizationSummary: {
      extractionRunId: string | null;
      observationsInserted: number;
      lineageInserted: number;
      nodesInserted: number;
      edgesInserted: number;
      responsesInserted: number;
      stagingRunId: string | null;
    } | null = null;

    /**
     * VLM proposed: persistiamo direttamente staging run con `proposed_structured_patches`
     * scollegato dalla pipeline causal/normalize (che lavora su valori già confermati).
     */
    if (panelId && importStatus === "vlm_proposed" && vlmProposals.length > 0) {
      const patches = vlmProposals.map((p) => ({
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
        vlmProposals.reduce((acc, p) => acc + (p.confidence || 0), 0) / Math.max(1, vlmProposals.length);
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
            vlm_provider: vlmProvider,
            vlm_model: vlmModel,
            detected_provider: vlmDetectedProvider,
            quality_notes: vlmQualityNotes,
            field_count: vlmProposals.length,
          },
          proposed_structured_patches: patches,
          confidence: Math.max(0, Math.min(1, overallConfidence)),
        })
        .select("id")
        .maybeSingle();
      normalizationSummary = {
        extractionRunId: null,
        observationsInserted: 0,
        lineageInserted: 0,
        nodesInserted: 0,
        edgesInserted: 0,
        responsesInserted: 0,
        stagingRunId: !stagingErr ? stagingRun?.id ?? null : null,
      };
    }

    if (panelId && importStatus !== "vlm_proposed") {
      try {
        const normalized = await persistNormalizedObservations({
          db,
          athleteId,
          panelId,
          panelType: panelType as HealthPanelTypeForParse,
          parsed,
          sampleDate,
          sourceKind: pdf ? "pdf" : mime.startsWith("image/") ? "image" : "other",
          parserVersion: "health-parser-v2",
          sourceHash: `${filename}:${buffer.length}`,
          qualityReport: {
            parsed_keys: Object.keys(parsed),
            import_status: importStatus,
          },
        });
        const causal = await buildAndPersistHealthCausalInteractions({
          db,
          athleteId,
          sampleDate,
          parsed,
          extractionRunId: normalized.extractionRunId,
          panelId,
        });
        normalizationSummary = {
          extractionRunId: normalized.extractionRunId,
          observationsInserted: normalized.inserted,
          lineageInserted: normalized.lineageInserted + causal.lineageInserted,
          nodesInserted: causal.nodesInserted,
          edgesInserted: causal.edgesInserted,
          responsesInserted: causal.responsesInserted,
          stagingRunId: null,
        };
        if (normalized.inserted > 0 || causal.nodesInserted > 0 || causal.edgesInserted > 0 || causal.responsesInserted > 0) {
          const { data: stagingRun, error: stagingErr } = await db
            .from("interpretation_staging_runs")
            .insert({
              athlete_id: athleteId,
              domain: "health",
              status: "pending_validation",
              trigger_source: "health_upload",
              source_refs: [
                { table: "biomarker_panels", id: panelId },
                normalized.extractionRunId ? { table: "extraction_runs", id: normalized.extractionRunId } : null,
              ].filter(Boolean),
              candidate_bundle: {
                panel_type: panelType,
                sample_date: sampleDate,
                parsed_keys: Object.keys(parsed),
                observations_inserted: normalized.inserted,
                system_graph: {
                  node_ids: causal.nodeIds,
                  edge_ids: causal.edgeIds,
                  response_ids: causal.responseIds,
                },
              },
              proposed_structured_patches: [],
              confidence: Object.keys(parsed).length > 0 ? 0.72 : 0.35,
            })
            .select("id")
            .maybeSingle();
          if (stagingErr) throw new Error(stagingErr.message);
          normalizationSummary.stagingRunId = stagingRun?.id ?? null;
        }
      } catch (normErr) {
        const msg = normErr instanceof Error ? normErr.message : "normalization_failed";
        const nextValues = {
          ...values,
          import: {
            ...importBlock,
            normalization_error: msg,
          },
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
    if (Object.keys(parsed).length > 0) parts.push(`${Object.keys(parsed).length} parametri dal PDF`);
    if (importStatus === "vlm_proposed") {
      parts.push(
        `${vlmProposals.length} parametri proposti via ${vlmProvider === "anthropic" ? "Claude" : "GPT-4o"} (vision)${vlmDetectedProvider ? ` · provider rilevato: ${vlmDetectedProvider}` : ""}`,
      );
    }
    if (normalizationSummary?.observationsInserted) parts.push(`${normalizationSummary.observationsInserted} osservazioni normalizzate`);
    if (normalizationSummary?.lineageInserted) parts.push(`${normalizationSummary.lineageInserted} lineage`);
    if ((normalizationSummary?.edgesInserted ?? 0) > 0 || (normalizationSummary?.responsesInserted ?? 0) > 0) {
      parts.push(`grafo: ${normalizationSummary?.edgesInserted ?? 0} edge · ${normalizationSummary?.responsesInserted ?? 0} response`);
    }
    if (normalizationSummary?.stagingRunId) {
      parts.push(
        importStatus === "vlm_proposed"
          ? "review da confermare aperta"
          : "staging interpretativo aperto",
      );
    }
    if (storagePath) parts.push("file su Storage");
    else if (bucket && storageErr) parts.push(`Storage: ${storageErr}`);
    else if (!bucket) parts.push("Storage non configurato (HEALTH_UPLOADS_BUCKET)");

    return NextResponse.json(
      {
        ok: true as const,
        panelId,
        parsedKeys: Object.keys(parsed),
        normalization: normalizationSummary,
        storagePath,
        importStatus,
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
