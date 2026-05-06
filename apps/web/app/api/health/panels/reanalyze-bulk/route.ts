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

const MAX_BATCH = 12;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Bulk re-analyze: convoglia tutti i panel "candidati" sulla **stessa**
 * pipeline canonica di `app/api/health/upload-document/route.ts` e di
 * `app/api/health/panels/[id]/analyze-with-ai/route.ts`. Niente decode o
 * persist staging-run reimplementati qui (vedi
 * `.cursor/rules/empathy_pro2_no_parallel_lines.mdc`).
 *
 * Candidato = panel dell'atleta con:
 *   - file in storage (`values.import.storage_path`)
 *   - mime image/* o application/pdf (o filename .pdf)
 *   - `values.import.status` ∈ {needs_manual_review, failed, vlm_proposed, parsed_partial}
 *   - **nessun** valore canonico già scritto (i panel con `parsed_full` o seed
 *     non vengono toccati: la regola è non riscrivere su memoria già consolidata)
 *
 * Il limite per chiamata è MAX_BATCH per evitare cold-start lunghi su Vercel.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { athleteId?: string };
    const athleteId = String(body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const { db } = await requireAthleteWriteContext(req, athleteId);

    const bucket = getHealthUploadsBucket();
    if (!bucket) {
      return NextResponse.json(
        { ok: false as const, error: "storage_bucket_not_configured" },
        { status: 503, headers: NO_STORE },
      );
    }

    const { data: rows, error } = await db
      .from("biomarker_panels")
      .select("id, type, sample_date, values, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: 500, headers: NO_STORE });
    }

    type Candidate = {
      id: string;
      type: HealthPanelTypeForParse;
      sampleDate: string;
      mime: string;
      filename: string;
      storagePath: string;
      importIn: Record<string, unknown>;
    };

    const candidates: Candidate[] = [];
    let canonicalCount = 0;

    for (const r of rows ?? []) {
      const type = String(r.type ?? "") as HealthPanelTypeForParse;
      if (!ALLOWED_TYPES.has(type)) continue;
      const v = asRecord((r as { values?: unknown }).values);
      const importIn = asRecord(v.import);
      const storagePath = typeof importIn.storage_path === "string" ? importIn.storage_path : null;
      const mime = (typeof importIn.mime === "string" ? importIn.mime : "").toLowerCase();
      const filename = typeof importIn.filename === "string" ? importIn.filename : "";
      const status = typeof importIn.status === "string" ? importIn.status : "";

      const flatFields = Object.keys(v).filter(
        (k) => k !== "import" && k !== "vlm_proposals" && k !== "vlm_pending_validation",
      ).length;
      if (flatFields > 0) {
        // Memoria già consolidata: no overwrite.
        canonicalCount++;
        continue;
      }
      if (!storagePath) continue;
      const isImage = mime.startsWith("image/");
      const isPdf = mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
      if (!isImage && !isPdf) continue;
      // Riconvertibili: tutti gli stati che indicano "no values canonici".
      if (!["needs_manual_review", "failed", "vlm_proposed", "parsed_partial", ""].includes(status)) continue;

      const sampleDate =
        typeof r.sample_date === "string" && r.sample_date.length >= 8
          ? String(r.sample_date).slice(0, 10)
          : new Date().toISOString().slice(0, 10);

      candidates.push({
        id: String(r.id),
        type,
        sampleDate,
        mime: isPdf && !mime ? "application/pdf" : mime || "application/octet-stream",
        filename: filename || "upload.bin",
        storagePath,
        importIn,
      });
      if (candidates.length >= MAX_BATCH) break;
    }

    type PanelOutcome = {
      panelId: string;
      type: string;
      ok: boolean;
      importStatus?: string;
      stagingRunId?: string | null;
      reviewUrl?: string | null;
      provider?: "anthropic" | "openai" | null;
      fieldCount?: number;
      error?: string;
    };
    const results: PanelOutcome[] = [];

    for (const c of candidates) {
      try {
        const dl = await db.storage.from(bucket).download(c.storagePath);
        if (dl.error || !dl.data) {
          results.push({ panelId: c.id, type: c.type, ok: false, error: dl.error?.message ?? "storage_download_failed" });
          continue;
        }
        const buffer = Buffer.from(await dl.data.arrayBuffer());

        const decode = await decodeHealthDocument({
          buffer,
          mime: c.mime,
          filename: c.filename,
          panelType: c.type,
        });

        if (decode.importStatus !== "vlm_proposed" && Object.keys(decode.parsed).length === 0) {
          results.push({
            panelId: c.id,
            type: c.type,
            ok: false,
            importStatus: decode.importStatus,
            error: "decode_no_fields",
          });
          continue;
        }

        const importBlock = buildHealthImportBlock({
          filename: c.filename,
          mime: c.mime,
          sizeBytes: buffer.length,
          decode,
        });
        const importMerged = {
          ...importBlock,
          ...(typeof c.importIn.storage_bucket === "string" ? { storage_bucket: c.importIn.storage_bucket } : {}),
          storage_path: c.storagePath,
          ...(typeof c.importIn.storage_uploaded_at === "string"
            ? { storage_uploaded_at: c.importIn.storage_uploaded_at }
            : {}),
        };
        const valuesOut = buildPanelValuesPayload({ decode, importBlock: importMerged });

        const { error: updateErr } = await db
          .from("biomarker_panels")
          .update({ values: valuesOut, source: selectPanelSourceTag(decode) })
          .eq("id", c.id)
          .eq("athlete_id", athleteId);
        if (updateErr) {
          results.push({ panelId: c.id, type: c.type, ok: false, error: updateErr.message });
          continue;
        }

        let stagingRunId: string | null = null;
        if (decode.importStatus === "vlm_proposed" && decode.vlmProposals.length > 0) {
          const sr = await persistHealthVlmStagingRun({
            db,
            athleteId,
            panelId: c.id,
            panelType: c.type,
            sampleDate: c.sampleDate,
            decode,
            triggerSource: "health_panel_reanalyze_vlm",
          });
          stagingRunId = sr.stagingRunId;
        }

        results.push({
          panelId: c.id,
          type: c.type,
          ok: true,
          importStatus: decode.importStatus,
          stagingRunId,
          reviewUrl: stagingRunId ? `/health/staging/${stagingRunId}` : null,
          provider: decode.vlmProvider,
          fieldCount:
            decode.importStatus === "vlm_proposed"
              ? decode.vlmProposals.length
              : Object.keys(decode.parsed).length,
        });
      } catch (err) {
        results.push({
          panelId: c.id,
          type: c.type,
          ok: false,
          error: err instanceof Error ? err.message : "panel_analyze_failed",
        });
      }
    }

    const totalProposed = results.filter((r) => r.ok && r.importStatus === "vlm_proposed").length;
    const totalParsed = results.filter((r) => r.ok && r.importStatus !== "vlm_proposed").length;
    const totalFailed = results.filter((r) => !r.ok).length;

    return NextResponse.json(
      {
        ok: true as const,
        candidates: candidates.length,
        analyzed: results.length,
        withVlmProposals: totalProposed,
        withParsedValues: totalParsed,
        failed: totalFailed,
        canonicalSkipped: canonicalCount,
        message:
          results.length === 0
            ? "Nessun candidato (file in storage assenti o referti già consolidati)."
            : `${totalProposed} proposte VLM · ${totalParsed} parsed · ${totalFailed} errori (su ${results.length} candidati).`,
        results,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "panels_reanalyze_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
