import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveOperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import type { OperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import type { ReasoningCardVm, ReasoningSourceRef, ReasoningTone } from "@/lib/dashboard/reasoning-dashboard-contract";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type StagingRunRow = {
  id: string;
  domain: ReasoningCardVm["domain"];
  status: string | null;
  trigger_source: string | null;
  source_refs: unknown;
  candidate_bundle: Record<string, unknown> | null;
  proposed_structured_patches: unknown;
  confidence: number | null;
  created_at: string | null;
};

type ExpectedDeltaRow = {
  id: string;
  date: string | null;
  status: string | null;
  delta: Record<string, unknown> | null;
  readiness: Record<string, unknown> | null;
  adaptation_hint: Record<string, unknown> | null;
  computed_at: string | null;
};

type BioResponseRow = {
  id: string;
  response_key: string | null;
  category: string | null;
  title: string | null;
  description: string | null;
  mitigation_refs: unknown;
  severity: string | null;
  confidence: number | null;
  observed_at: string | null;
  created_at: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asSourceRefs(value: unknown): ReasoningSourceRef[] {
  return asArray(value)
    .map((row) => asRecord(row))
    .map((row) => ({
      table: typeof row.table === "string" ? row.table : undefined,
      id: typeof row.id === "string" ? row.id : undefined,
      label: typeof row.label === "string" ? row.label : undefined,
      kind: typeof row.kind === "string" ? row.kind : undefined,
    }));
}

function asText(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pct(value: unknown): string {
  const n = asNum(value);
  return n != null ? `${Math.round(n)}%` : "—";
}

function fixed(value: unknown, digits = 1): string {
  const n = asNum(value);
  return n != null ? n.toFixed(digits) : "—";
}

function actionLabel(action: unknown): string {
  return asText(action, "no_change").replaceAll("_", " ");
}

function toneForStatus(status: string | null | undefined): ReasoningTone {
  if (status === "recover" || status === "regenerate" || status === "red") return "rose";
  if (status === "adapt" || status === "watch" || status === "yellow" || status === "pending_validation") return "amber";
  if (status === "committed") return "green";
  if (status === "rejected" || status === "archived") return "slate";
  return "cyan";
}

function proposedPatchLines(value: unknown): string[] {
  return asArray(value).map((row) => {
    const r = asRecord(row);
    const target = asText(r.target, "modulo");
    const action = actionLabel(r.action);
    const reason = Array.isArray(r.reason) ? r.reason.map((x) => asText(x, "")).filter(Boolean).join(" · ") : asText(r.reason, "");
    return reason ? `${target}: ${action} · ${reason}` : `${target}: ${action}`;
  });
}

function trainingExplanation(status: string, bundle: Record<string, unknown>, patches: unknown): ReasoningCardVm {
  const delta = asRecord(bundle.delta);
  const readiness = asRecord(bundle.readiness);
  const hint = asRecord(bundle.adaptation_hint);
  const trainingAction = actionLabel(hint.training_adjustment);
  const nutritionAction = actionLabel(hint.nutrition_adjustment);
  const readinessScore = asNum(readiness.score);
  const internalRatio = asNum(delta.internal_external_ratio);
  const executionPct = asNum(delta.execution_pct);
  const isRecovery = status === "recover";

  return {
    id: `expected-obtained-${asText(bundle.date, "day")}`,
    domain: "cross_module",
    title: isRecovery ? "Recupero incompleto" : status === "adapt" ? "Adattamento richiesto" : "Delta piano/realtà",
    value: fixed(delta.mismatch_score, 1),
    subtitle: `execution ${executionPct != null ? `${Math.round(executionPct)}%` : "—"} · readiness ${
      readinessScore != null ? Math.round(readinessScore) : "—"
    }`,
    tone: toneForStatus(status),
    status,
    confidence: null,
    explanation: isRecovery
      ? "Allenamento ridotto o giornata rigenerativa proposta perché recupero/readiness non sono sufficienti rispetto al carico."
      : "Il sistema confronta piano, realtà eseguita e carico interno: se la divergenza supera soglia, apre una proposta di adattamento.",
    actionLines: [trainingAction, nutritionAction, ...proposedPatchLines(patches)],
    evidenceLines: [
      `TSS delta ${fixed(delta.tss_delta, 1)}`,
      `Rapporto interno/esterno ${internalRatio != null ? internalRatio.toFixed(2) : "—"}`,
      `Readiness source days ${asText(readiness.source_days, "—")}`,
    ],
    riskLines: [
      readinessScore != null && readinessScore < 45 ? "Rischio: accumulo fatica / recupero incompleto." : "",
      internalRatio != null && internalRatio >= 1.2 ? "Rischio: carico interno alto rispetto al lavoro esterno." : "",
    ].filter(Boolean),
    timingLines: [
      nutritionAction.includes("redox") ? "Nutrizione: aumentare supporto recovery/redox nella finestra post-sessione." : "",
      trainingAction.includes("recovery") ? "Training: mettere rigenerazione o riduzione nella prossima seduta utile." : "",
    ].filter(Boolean),
    sourceRefs: [],
    stagingRunId: null,
    createdAt: null,
  };
}

function cardFromStagingRun(row: StagingRunRow): ReasoningCardVm {
  const bundle = asRecord(row.candidate_bundle);
  const candidateStatus = asText(bundle.status, row.status ?? "pending_validation");
  const base =
    row.trigger_source === "expected_vs_obtained"
      ? trainingExplanation(candidateStatus, bundle, row.proposed_structured_patches)
      : {
          id: row.id,
          domain: row.domain,
          title: row.domain === "health" ? "Nuova interpretazione Health" : "Interpretazione in validazione",
          value: row.confidence != null ? `${Math.round(row.confidence * 100)}%` : "—",
          subtitle: `${row.domain} · ${row.trigger_source ?? "manual"}`,
          tone: toneForStatus(row.status),
          status: row.status ?? "pending_validation",
          confidence: row.confidence,
          explanation:
            row.domain === "health"
              ? "Esami o segnali biologici hanno generato nodi, archi o risposte da validare prima di diventare memoria operativa."
              : "Proposta interpretativa in attesa di validazione.",
          actionLines: proposedPatchLines(row.proposed_structured_patches),
          evidenceLines: Object.entries(bundle).slice(0, 5).map(([key, value]) => `${key}: ${asText(value)}`),
          riskLines: [],
          timingLines: [],
          sourceRefs: [],
          stagingRunId: null,
          createdAt: null,
        };

  return {
    ...base,
    id: `staging-${row.id}`,
    domain: row.domain,
    status: row.status ?? base.status,
    confidence: row.confidence,
    sourceRefs: asSourceRefs(row.source_refs),
    stagingRunId: row.id,
    createdAt: row.created_at,
  };
}

function cardsFromOperationalBundle(bundle: OperationalSignalsBundle | null): ReasoningCardVm[] {
  if (!bundle) return [];
  const g = bundle.adaptationGuidance;
  const loop = bundle.adaptationLoop;
  const bio = bundle.bioenergeticModulation;
  const nut = bundle.nutritionPerformanceIntegration;
  const cards: ReasoningCardVm[] = [
    {
      id: "compute-adaptation-loop",
      domain: "training",
      title: "Ragionamento VIRYA/adattamento",
      value: `${g.scorePct}%`,
      subtitle: `${g.trafficLight} · ${loop.status} · ${actionLabel(loop.nextAction)}`,
      tone: toneForStatus(loop.status === "aligned" ? g.trafficLight : loop.status),
      status: loop.status,
      confidence: null,
      explanation:
        "VIRYA deve leggere semaforo adattamento, divergenza e nextAction per decidere se mantenere, ritunare o rigenerare il microciclo.",
      actionLines: [actionLabel(loop.nextAction), bundle.operationalContext?.headline ?? ""].filter(Boolean),
      evidenceLines: [
        `Atteso ${g.expectedAdaptation.toFixed(2)} · osservato ${g.observedAdaptation.toFixed(2)}`,
        `Divergenza ${loop.divergenceScore.toFixed(1)} · intervento ${loop.interventionScore.toFixed(1)}`,
      ],
      riskLines: loop.triggers,
      timingLines: ["Applicare prima a VIRYA/microciclo, poi materializzare singola sessione col Builder."],
      sourceRefs: [{ kind: "athlete_memory", label: "operational_signals_bundle" }],
      stagingRunId: null,
      createdAt: null,
    },
    {
      id: "compute-nutrition-dials",
      domain: "nutrition",
      title: "Ragionamento Nutrition/Fueling",
      value: `${nut.fuelingChoScale.toFixed(2)}x`,
      subtitle: `E ${nut.trainingEnergyScale.toFixed(2)}x · protein +${nut.proteinBiasPctPoints.toFixed(1)} pt`,
      tone: "cyan",
      status: "computed",
      confidence: null,
      explanation:
        "I dial nutrizione scalano energia training, carboidrati, proteine e idratazione sulla base dello stesso bundle usato da training.",
      actionLines: nut.rationale,
      evidenceLines: [`Hydration floor ${nut.hydrationFloorMultiplier.toFixed(2)}x`],
      riskLines: [],
      timingLines: ["Applicare timing pre/peri/post workout coerente con sessione e recovery."],
      sourceRefs: [{ kind: "athlete_memory", label: "nutrition_performance_integration" }],
      stagingRunId: null,
      createdAt: null,
    },
  ];

  if (bio) {
    cards.push({
      id: "compute-bioenergetis-redox",
      domain: "bioenergetics",
      title: "Ragionamento Redox/Bioenergetis",
      value: `${bio.loadScale.toFixed(2)}x`,
      subtitle: `${bio.state} · copertura ${Math.round(bio.signalCoveragePct)}%`,
      tone: bio.state === "protective" ? "rose" : bio.state === "watch" ? "amber" : "green",
      status: bio.state,
      confidence: null,
      explanation:
        "La modulazione bioenergetica collega fisiologia, twin e recovery: se stress/redox o incertezza salgono, il carico deve essere protetto.",
      actionLines: [bio.headline, bio.guidance],
      evidenceLines: [`Incertezza ±${Math.round(bio.inputUncertaintyPct)}%`, ...bio.signalCoverage],
      riskLines: bio.missingSignals.map((signal) => `Segnale mancante: ${signal}`),
      timingLines: ["Usare questo dato prima della prescrizione sessione; il Builder non deve inventarlo."],
      sourceRefs: [{ kind: "athlete_memory", label: "bioenergetic_modulation" }],
      stagingRunId: null,
      createdAt: null,
    });
  }
  return cards;
}

function cardFromBioResponse(row: BioResponseRow): ReasoningCardVm {
  const mitigation = asArray(row.mitigation_refs).map((item) => {
    const rec = asRecord(item);
    return asText(rec.label ?? rec.action ?? rec.kind, JSON.stringify(item));
  });
  return {
    id: `bio-response-${row.id}`,
    domain: "bioenergetics",
    title: row.title ?? row.response_key ?? "Risposta bioenergetica",
    value: row.severity ?? "risk",
    subtitle: `${row.category ?? "response"} · conf ${row.confidence != null ? Math.round(row.confidence * 100) : "—"}%`,
    tone: row.severity === "high" ? "rose" : row.severity === "medium" ? "amber" : "violet",
    status: "candidate",
    confidence: row.confidence,
    explanation: row.description ?? "Risposta derivata dal system map biologico: richiede validazione prima di diventare applicazione.",
    actionLines: mitigation,
    evidenceLines: [row.response_key ?? ""].filter(Boolean),
    riskLines: row.category ? [`Categoria: ${row.category}`] : [],
    timingLines: [],
    sourceRefs: [{ table: "bioenergetics_responses", id: row.id }],
    stagingRunId: null,
    createdAt: row.observed_at ?? row.created_at,
  };
}

function cardFromDelta(row: ExpectedDeltaRow): ReasoningCardVm {
  return {
    ...trainingExplanation(row.status ?? "watch", {
      date: row.date,
      status: row.status,
      delta: row.delta ?? {},
      readiness: row.readiness ?? {},
      adaptation_hint: row.adaptation_hint ?? {},
    }, []),
    id: `delta-${row.id}`,
    stagingRunId: null,
    createdAt: row.computed_at,
    sourceRefs: [{ table: "training_expected_obtained_deltas", id: row.id }],
  };
}

function summary(cards: ReasoningCardVm[]) {
  return {
    pending: cards.filter((c) => c.status === "pending_validation" || c.stagingRunId).length,
    committed: cards.filter((c) => c.status === "committed").length,
    rejected: cards.filter((c) => c.status === "rejected").length,
    archived: cards.filter((c) => c.status === "archived").length,
    total: cards.length,
  };
}

function optionalRows(res: { data: unknown[] | null; error: { message?: string; code?: string } | null }) {
  if (!res.error) return res.data ?? [];
  const msg = res.error.message ?? "";
  const code = String(res.error.code ?? "");
  if (code === "42P01" || msg.includes("does not exist")) return [];
  throw new Error(res.error.message);
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);
    const [stagingRes, deltasRes, bioRes, athleteMemory] = await Promise.all([
      db
        .from("interpretation_staging_runs")
        .select("id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence, created_at")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(40),
      db
        .from("training_expected_obtained_deltas")
        .select("id, date, status, delta, readiness, adaptation_hint, computed_at")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(20),
      db
        .from("bioenergetics_responses")
        .select("id, response_key, category, title, description, mitigation_refs, severity, confidence, observed_at, created_at")
        .eq("athlete_id", athleteId)
        .order("observed_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(20),
      resolveAthleteMemory(athleteId).catch(() => null),
    ]);

    const operationalSignals = athleteMemory
      ? await resolveOperationalSignalsBundle({ athleteId, athleteMemory }).catch(() => null)
      : null;

    const cards = [
      ...cardsFromOperationalBundle(operationalSignals),
      ...(optionalRows(stagingRes) as StagingRunRow[]).map(cardFromStagingRun),
      ...(optionalRows(deltasRes) as ExpectedDeltaRow[]).map(cardFromDelta),
      ...(optionalRows(bioRes) as BioResponseRow[]).map(cardFromBioResponse),
    ];

    return NextResponse.json(
      {
        ok: true as const,
        athleteId,
        generatedAt: new Date().toISOString(),
        cards,
        summary: summary(cards),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "reasoning_dashboard_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
