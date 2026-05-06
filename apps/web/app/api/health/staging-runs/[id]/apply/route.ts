import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAthleteWriteContext,
  requireAuthenticatedTrainingUser,
  supabaseForAthleteTableRead,
} from "@/lib/auth/athlete-read-context";
import { persistNormalizedObservations } from "@/lib/health/health-observation-normalizer";
import { buildAndPersistHealthCausalInteractions } from "@/lib/health/health-causal-interactions";
import type { HealthPanelTypeForParse } from "@/lib/health/lab-text-extractors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

const HEALTH_PANEL_TYPES = new Set<string>([
  "blood",
  "microbiota",
  "epigenetics",
  "hormones",
  "inflammation",
  "oxidative_stress",
]);

type ConfirmedPatch = {
  field: string;
  value: number | string | null;
  unit?: string | null;
  confidence?: number;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function normalizeConfirmed(raw: unknown): ConfirmedPatch[] {
  if (!Array.isArray(raw)) return [];
  const out: ConfirmedPatch[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    const rec = r as Record<string, unknown>;
    const field = String(rec.field ?? "").trim().toLowerCase();
    if (!field) continue;
    let value: number | string | null = null;
    if (typeof rec.value === "number" && Number.isFinite(rec.value)) value = rec.value;
    else if (typeof rec.value === "string" && rec.value.trim()) value = rec.value.trim();
    const unit = typeof rec.unit === "string" && rec.unit.trim() ? rec.unit.trim() : null;
    const confidence =
      typeof rec.confidence === "number" && Number.isFinite(rec.confidence)
        ? Math.max(0, Math.min(1, rec.confidence))
        : undefined;
    out.push({ field, value, unit, confidence });
  }
  return out;
}

/**
 * Conferma di una review VLM: l'utente / coach valida i `proposed_structured_patches`
 * (eventualmente editandoli) e li promuove a verità in `biomarker_panels.values`.
 *
 * Body JSON:
 *  - `confirmedPatches`: ConfirmedPatch[] (array fields con `value` finale)
 *  - `reason` (string opzionale)
 *
 * Effetti:
 *  - merge dei `confirmedPatches` su `biomarker_panels.values` per il pannello sorgente
 *  - chiusura `interpretation_staging_runs.status = "committed"` + audit
 *  - normalizzazione osservazioni + grafo causale (riusa `persistNormalizedObservations`)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const runId = params.id?.trim();
    if (!runId) {
      return NextResponse.json({ ok: false as const, error: "missing_run_id" }, { status: 400, headers: NO_STORE });
    }
    const body = (await req.json().catch(() => ({}))) as {
      confirmedPatches?: unknown;
      reason?: string;
    };
    const confirmed = normalizeConfirmed(body.confirmedPatches);
    if (!confirmed.length) {
      return NextResponse.json(
        { ok: false as const, error: "no_confirmed_patches" },
        { status: 400, headers: NO_STORE },
      );
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;

    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
    const readDb = supabaseForAthleteTableRead(rlsClient);

    const { data: run, error: runErr } = await readDb
      .from("interpretation_staging_runs")
      .select("id, athlete_id, domain, status, source_refs, candidate_bundle, proposed_structured_patches, confidence")
      .eq("id", runId)
      .maybeSingle();
    if (runErr) {
      return NextResponse.json({ ok: false as const, error: runErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!run) {
      return NextResponse.json({ ok: false as const, error: "staging_run_not_found" }, { status: 404, headers: NO_STORE });
    }
    if (run.domain !== "health") {
      return NextResponse.json(
        { ok: false as const, error: "wrong_domain", domain: run.domain },
        { status: 409, headers: NO_STORE },
      );
    }
    if (run.status === "committed" || run.status === "rejected" || run.status === "archived") {
      return NextResponse.json(
        { ok: false as const, error: "staging_already_closed", status: run.status },
        { status: 409, headers: NO_STORE },
      );
    }

    const athleteId = String(run.athlete_id ?? "");
    if (!athleteId) {
      return NextResponse.json(
        { ok: false as const, error: "missing_athlete_id_in_run" },
        { status: 500, headers: NO_STORE },
      );
    }
    const { db } = await requireAthleteWriteContext(req, athleteId);

    const candidate = asRecord(run.candidate_bundle);
    const panelType = String(candidate.panel_type ?? "");
    if (!HEALTH_PANEL_TYPES.has(panelType)) {
      return NextResponse.json(
        { ok: false as const, error: "invalid_panel_type", panelType },
        { status: 409, headers: NO_STORE },
      );
    }
    const sampleDate =
      typeof candidate.sample_date === "string" && candidate.sample_date.length >= 8
        ? candidate.sample_date.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const sourceRefs = asArray(run.source_refs);
    const panelRef = sourceRefs.find((r) => {
      const rec = asRecord(r);
      return rec.table === "biomarker_panels" && typeof rec.id === "string";
    });
    const panelId = panelRef ? String(asRecord(panelRef).id ?? "") : null;
    if (!panelId) {
      return NextResponse.json(
        { ok: false as const, error: "missing_source_panel_id" },
        { status: 409, headers: NO_STORE },
      );
    }

    const { data: panelRow, error: panelErr } = await db
      .from("biomarker_panels")
      .select("id, athlete_id, type, sample_date, values")
      .eq("id", panelId)
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (panelErr) {
      return NextResponse.json({ ok: false as const, error: panelErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!panelRow) {
      return NextResponse.json(
        { ok: false as const, error: "panel_not_found" },
        { status: 404, headers: NO_STORE },
      );
    }

    const priorValues = asRecord((panelRow as { values?: unknown }).values);
    const importBlock = asRecord(priorValues.import);

    /** Mergiamo i confirmedPatches in `values`, mantenendo `import` + audit + rimuovendo flag pending. */
    const nextValues: Record<string, unknown> = { ...priorValues };
    delete nextValues.vlm_pending_validation;
    const previousProposals = asArray(priorValues.vlm_proposals);
    const confirmedSnapshot: Array<Record<string, unknown>> = [];

    for (const c of confirmed) {
      if (c.value === null || c.value === undefined) continue;
      nextValues[c.field] = c.value;
      if (c.unit) nextValues[`${c.field}__unit`] = c.unit;
      confirmedSnapshot.push({
        field: c.field,
        value: c.value,
        unit: c.unit ?? null,
        confidence: c.confidence ?? null,
      });
    }

    nextValues.import = {
      ...importBlock,
      vlm_confirmed_at: new Date().toISOString(),
      vlm_confirmed_by: userId,
      vlm_confirmed_count: confirmedSnapshot.length,
      vlm_proposals_archived: previousProposals,
    };
    nextValues.vlm_confirmed_patches = confirmedSnapshot;

    const { error: updErr } = await db
      .from("biomarker_panels")
      .update({ values: nextValues, source: "health_upload_vlm_v1_confirmed" })
      .eq("id", panelId)
      .eq("athlete_id", athleteId);
    if (updErr) {
      return NextResponse.json({ ok: false as const, error: updErr.message }, { status: 500, headers: NO_STORE });
    }

    /** Chiudi staging run + audit. */
    const nowIso = new Date().toISOString();
    const { error: stagingUpdErr } = await db
      .from("interpretation_staging_runs")
      .update({ status: "committed", updated_at: nowIso })
      .eq("id", runId)
      .eq("athlete_id", athleteId);
    if (stagingUpdErr) {
      return NextResponse.json(
        { ok: false as const, error: stagingUpdErr.message },
        { status: 500, headers: NO_STORE },
      );
    }
    const { error: auditErr } = await db.from("interpretation_staging_commits").insert({
      run_id: runId,
      athlete_id: athleteId,
      target: "biomarker_panels",
      target_ids: [panelId],
      status: "committed",
      reason,
      payload: {
        domain: "health",
        panel_type: panelType,
        sample_date: sampleDate,
        proposed_count: previousProposals.length,
        confirmed_count: confirmedSnapshot.length,
        confirmed_patches: confirmedSnapshot,
        prior_values_keys: Object.keys(priorValues),
      },
      committed_by: userId,
    });
    if (auditErr) {
      // best-effort: la write principale è già passata
    }

    /** Costruisci `parsed` per la pipeline normalize/causal e la riusa. */
    const parsedForNormalize: Record<string, unknown> = {};
    for (const c of confirmedSnapshot) {
      const f = c.field as string;
      if (typeof f === "string" && f) parsedForNormalize[f] = c.value;
    }

    let observationsInserted = 0;
    let causalEdges = 0;
    let causalNodes = 0;
    try {
      const normalized = await persistNormalizedObservations({
        db,
        athleteId,
        panelId,
        panelType: panelType as HealthPanelTypeForParse,
        parsed: parsedForNormalize,
        sampleDate,
        sourceKind: "other",
        parserVersion: "health-vlm-confirm-v1",
        sourceHash: `staging:${runId}`,
        qualityReport: {
          confirmed_keys: Object.keys(parsedForNormalize),
          source: "health_upload_vlm_v1_confirmed",
        },
      });
      observationsInserted = normalized.inserted;
      const causal = await buildAndPersistHealthCausalInteractions({
        db,
        athleteId,
        sampleDate,
        parsed: parsedForNormalize,
        extractionRunId: normalized.extractionRunId,
        panelId,
      });
      causalEdges = causal.edgesInserted;
      causalNodes = causal.nodesInserted;
    } catch {
      // best-effort: la verità clinica è già scritta in biomarker_panels.values
    }

    return NextResponse.json(
      {
        ok: true as const,
        runId,
        panelId,
        confirmedCount: confirmedSnapshot.length,
        observationsInserted,
        causalNodes,
        causalEdges,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "health_staging_apply_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
