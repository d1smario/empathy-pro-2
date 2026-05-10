/**
 * Synthesizer v1: serie orarie «evidence_conditioned» deterministiche da kernel + timeline + link DB curati.
 * Non sostituisce misure cliniche.
 */

import type {
  BioenergeticAxisFluidEvidenceLinkV1,
  BioenergeticConditioningContextV1,
  BioenergeticContextCoverageV1,
  BioenergeticContributionGraphEdgeV1,
  BioenergeticContributionGraphNodeV1,
  BioenergeticContributionGraphV1,
  BioenergeticCurveEvidenceAttributionV1,
  BioenergeticEvidenceConditionedSeriesV1,
  BioenergeticEvidenceLinkStrengthV1,
  BioenergeticEvidenceStratumV1,
  BioenergeticUncertaintyDecompositionV1,
  KnowledgeDocumentRef,
  KnowledgeSourceDatabase,
} from "@empathy/contracts";
import { kernelDayStress01, type SimDayKernelV1Input } from "./day-simulator-v1";
import { activitySupportHours, mealInhibitoryHours, type SimTimelineEventV1 } from "./sim-timeline-v1";

const DEFAULT_STRATUM: BioenergeticEvidenceStratumV1 = {
  stratumId: "operational_evidence_synth_v1",
  labelIt: "Scenario operativo v1 (kernel + timeline + grafo evidenza DB)",
  inclusionCriteria: ["Giornata con contesto atleta e link curati assi↔fluidi"],
  phenotypeTags: [],
  evidenceQuality: "heterogeneous_primary",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function strengthToWeight01(s: BioenergeticEvidenceLinkStrengthV1): number {
  if (s === "strong_consensus") return 0.88;
  if (s === "supported") return 0.62;
  return 0.38;
}

function slugGraphIdPart(s: string): string {
  const t = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return t.length ? t : "x";
}

function mergeContributionGraphWithDbLinks(
  nodes: BioenergeticContributionGraphNodeV1[],
  edges: BioenergeticContributionGraphEdgeV1[],
  links: readonly BioenergeticAxisFluidEvidenceLinkV1[],
  docFallback: KnowledgeDocumentRef,
): BioenergeticContributionGraphV1 {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const outEdges = [...edges];
  for (const lk of links.slice(0, 24)) {
    const axisId = `db_axis_${slugGraphIdPart(lk.axis.code)}`;
    const fluidId = `db_fluid_${slugGraphIdPart(lk.fluidProcess.code)}`;
    if (!nodeById.has(axisId)) {
      nodeById.set(axisId, { id: axisId, kind: "hormone_axis", labelIt: lk.axis.labelIt });
    }
    if (!nodeById.has(fluidId)) {
      nodeById.set(fluidId, { id: fluidId, kind: "fluid_process", labelIt: lk.fluidProcess.labelIt });
    }
    const refs = lk.documents.length ? lk.documents.slice(0, 3) : [docFallback];
    outEdges.push({
      from: axisId,
      to: fluidId,
      weight01: strengthToWeight01(lk.strength),
      evidenceLinkId: lk.linkId,
      evidenceRefs: refs,
    });
  }
  return { nodes: [...nodeById.values()], edges: outEdges };
}

function firstDocRefs(links: readonly BioenergeticAxisFluidEvidenceLinkV1[], pred: (l: BioenergeticAxisFluidEvidenceLinkV1) => boolean) {
  for (const lk of links) {
    if (!pred(lk)) continue;
    if (lk.documents.length) return lk.documents;
  }
  return links[0]?.documents ?? [];
}

function countFluidCategory(links: readonly BioenergeticAxisFluidEvidenceLinkV1[], category: string): number {
  return links.filter((l) => l.fluidProcess.category === category).length;
}

function defaultCoverage(timeline: readonly SimTimelineEventV1[]): BioenergeticContextCoverageV1 {
  return {
    training: timeline.some((t) => t.type === "executed_session" || t.type === "planned_session") ? 0.75 : 0.25,
    nutrition: timeline.some((t) => t.type === "meal") ? 0.7 : 0.2,
    sleep: 0.35,
    lab: 0.35,
    hr_stream: 0.25,
    bia: 0,
    fluid_intake: 0.2,
    environment: 0.2,
    missingAxes: ["bia", "fluid_intake", "environment"],
  };
}

function hourlyMetabolicStressProxy(
  date: string,
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
  conditioningContext: BioenergeticConditioningContextV1,
): number[] {
  const meals = mealInhibitoryHours(timeline);
  const act = activitySupportHours(timeline);
  const stress = kernelDayStress01(kernel);
  const biaSum = conditioningContext.biaLiteratureSummary;
  let biaMetabolicTilt = 0;
  if (biaSum && biaSum.confidence01 >= 0.32 && biaSum.cellularGeometry.band !== "insufficient_data") {
    biaMetabolicTilt = (biaSum.cellularGeometry.supportIndex01 - 0.52) * 5.5 * biaSum.confidence01;
  }
  const base = 38 + stress * 42 + biaMetabolicTilt;
  const hourly: number[] = [];
  for (let h = 0; h < 24; h += 1) {
    const circ = 8 * Math.sin(((h - 14) * Math.PI) / 12);
    let v = base + circ;
    if (meals.has(h)) v += 9;
    if (act.has(h)) v += 11;
    hourly.push(Math.round(clamp(v, 0, 100) * 10) / 10);
  }
  void date;
  return hourly;
}

function hourlyFluidCouplingProxy(
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
  links: readonly BioenergeticAxisFluidEvidenceLinkV1[],
  conditioningContext: BioenergeticConditioningContextV1,
): number[] {
  const act = activitySupportHours(timeline);
  const ecwN = countFluidCategory(links, "ecw_shift");
  const plasmaN = countFluidCategory(links, "plasma_volume");
  const biaSum = conditioningContext.biaLiteratureSummary;
  const raw = conditioningContext.bodyComposition;
  let biaBonus = 0;
  if (biaSum && biaSum.confidence01 >= 0.28) {
    biaBonus = clamp(0.85 + 2.85 * biaSum.confidence01 * biaSum.extracellularFluid.loadBias01, 0, 5.2);
  } else if (raw && (raw.phaseAngleDeg != null || raw.ecwTbwRatio != null || raw.tbwL != null || raw.ecwL != null)) {
    biaBonus = 2.15;
  }
  const fluidDiaryBonus = (conditioningContext.fluidIntake?.length ?? 0) > 0 ? 1.5 : 0;
  const linkBonus = clamp(ecwN * 2.2 + plasmaN * 1.4 + biaBonus + fluidDiaryBonus, 0, 16);
  const stress = kernelDayStress01(kernel);
  const base = 28 + stress * 22 + linkBonus;
  const hourly: number[] = [];
  for (let h = 0; h < 24; h += 1) {
    const circ = 6 * Math.sin(((h - 10) * Math.PI) / 12);
    let v = base + circ;
    if (act.has(h)) v += 7 + kernel.oxidationDriveScore * 0.06;
    hourly.push(Math.round(clamp(v, 0, 100) * 10) / 10);
  }
  return hourly;
}

function uncertaintyFromCoverage(cov: BioenergeticContextCoverageV1): BioenergeticUncertaintyDecompositionV1 {
  const miss = cov.missingAxes?.length ?? 0;
  const bump = clamp(miss * 1.8, 0, 14);
  const ep = Array.from({ length: 24 }, () => bump);
  return {
    epistemicSd24: ep,
    contextImputationSd24: ep.map((x) => Math.round(x * 0.6 * 10) / 10),
  };
}

export type EvidenceConditionedSynthesisInputV1 = {
  date: string;
  kernel: SimDayKernelV1Input;
  timeline: readonly SimTimelineEventV1[];
  conditioningContext: BioenergeticConditioningContextV1;
  contextDigest: string;
  bankRef: { bankId: string; bankVersion: string };
  resolvedEvidenceLinks: readonly BioenergeticAxisFluidEvidenceLinkV1[];
};

export type EvidenceConditionedSynthesisOutputV1 = {
  series: BioenergeticEvidenceConditionedSeriesV1[];
  contributionGraph: BioenergeticContributionGraphV1;
};

export function synthesizeEvidenceConditionedLayerV1(input: EvidenceConditionedSynthesisInputV1): EvidenceConditionedSynthesisOutputV1 {
  const { date, kernel, timeline, conditioningContext, contextDigest, bankRef, resolvedEvidenceLinks } = input;
  const links = [...resolvedEvidenceLinks];
  const cov = conditioningContext.coverage ?? defaultCoverage(timeline);

  const metabolicHourly = hourlyMetabolicStressProxy(date, kernel, timeline, conditioningContext);
  const fluidHourly = hourlyFluidCouplingProxy(kernel, timeline, links, conditioningContext);

  const metabolicDocs = firstDocRefs(links, () => true);
  const fluidDocs = firstDocRefs(links, (l) => l.fluidProcess.category === "ecw_shift" || l.fluidProcess.category === "plasma_volume");
  const docFallback = metabolicDocs[0] ?? {
    sourceDb: "manual_curation" as KnowledgeSourceDatabase,
    externalId: "empathy_no_doc",
    title: "—",
  };

  const metabolicAttr: BioenergeticCurveEvidenceAttributionV1[] = [
    {
      contributionId: "kernel_stress_prior",
      analyteId: "evidence_metabolic_stress_proxy_v1",
      direction: "mixed",
      magnitude01: kernelDayStress01(kernel),
      documents: metabolicDocs.length ? metabolicDocs.slice(0, 2) : [docFallback],
      notesIt: "Prior da stress kernel v1 e circadiano operativo.",
      priority: 1,
    },
  ];
  const fluidDocPick = fluidDocs.length ? fluidDocs.slice(0, 3) : metabolicDocs.length ? metabolicDocs.slice(0, 1) : [docFallback];
  const fluidAttr: BioenergeticCurveEvidenceAttributionV1[] = [
    {
      contributionId: "evidence_db_fluid_links",
      analyteId: "evidence_fluid_axis_coupling_proxy_v1",
      direction: "up",
      magnitude01: clamp(countFluidCategory(links, "ecw_shift") / 8, 0, 1),
      documents: fluidDocPick,
      notesIt: `Modulazione da ${links.length} link curati assi↔fluidi (categorie ECW/plasma).`,
      priority: 1,
    },
  ];

  const uncertaintyTemplate = uncertaintyFromCoverage(cov);
  const sd = uncertaintyTemplate.epistemicSd24 ?? Array.from({ length: 24 }, () => 4);

  const applySd = (hourly: number[]): BioenergeticUncertaintyDecompositionV1 => ({
    ...uncertaintyTemplate,
    combinedLow24: hourly.map((v, i) => Math.round(clamp(v - (sd[i] ?? 4), 0, 100) * 10) / 10),
    combinedHigh24: hourly.map((v, i) => Math.round(clamp(v + (sd[i] ?? 4), 0, 100) * 10) / 10),
  });

  const sleepMissing = cov.missingAxes?.includes("sleep") && (conditioningContext.sleepAutonomic?.length ?? 0) === 0;

  const series: BioenergeticEvidenceConditionedSeriesV1[] = [
    {
      analyteId: "evidence_metabolic_stress_proxy_v1",
      unit: "index_0_100",
      hourlyMean24: metabolicHourly,
      bankRef,
      stratumApplied: DEFAULT_STRATUM,
      synthesisKind: "evidence_conditioned",
      contextDigest,
      uncertainty: applySd(metabolicHourly),
      attributions: metabolicAttr,
      warnings: sleepMissing ? ["Sonno device assente: incertezza più alta su accoppiamento HPA/fluidi."] : [],
      coverage: cov,
    },
    {
      analyteId: "evidence_fluid_axis_coupling_proxy_v1",
      unit: "index_0_100",
      hourlyMean24: fluidHourly,
      bankRef,
      stratumApplied: DEFAULT_STRATUM,
      synthesisKind: "evidence_conditioned",
      contextDigest,
      uncertainty: applySd(fluidHourly),
      attributions: fluidAttr,
      warnings: links.length === 0 ? ["Nessun link DB: curva dominata solo da kernel/timeline."] : [],
      coverage: cov,
    },
  ];

  const nodes: BioenergeticContributionGraphNodeV1[] = [
    { id: "n_kernel", kind: "prior", labelIt: "Kernel giornata v1" },
    { id: "n_training", kind: "stimulus", labelIt: "Allenamento (timeline)" },
    { id: "n_nutrition", kind: "nutrition", labelIt: "Nutrizione (timeline)" },
    { id: "n_evidence_db", kind: "hormone_axis", labelIt: "Grafo evidenza assi↔fluidi (DB)" },
    { id: "out_metabolic", kind: "prior", labelIt: "Serie: stress metabolico proxy" },
    { id: "out_fluid", kind: "fluid_process", labelIt: "Serie: accoppiamento fluidi proxy" },
  ];

  const edges: BioenergeticContributionGraphEdgeV1[] = [
    { from: "n_kernel", to: "out_metabolic", weight01: 0.55, evidenceRefs: [docFallback] },
    { from: "n_training", to: "out_metabolic", weight01: 0.35, evidenceRefs: metabolicDocs.slice(0, 1).length ? metabolicDocs.slice(0, 1) : [docFallback] },
    { from: "n_nutrition", to: "out_metabolic", weight01: 0.3, evidenceRefs: metabolicDocs.slice(0, 1).length ? metabolicDocs.slice(0, 1) : [docFallback] },
    {
      from: "n_evidence_db",
      to: "out_fluid",
      weight01: 0.5,
      evidenceRefs: fluidDocs.slice(0, 1).length ? fluidDocs.slice(0, 1) : [docFallback],
      evidenceLinkId: links[0]?.linkId,
    },
    { from: "n_kernel", to: "out_fluid", weight01: 0.4, evidenceRefs: [docFallback] },
  ];

  const contributionGraph = mergeContributionGraphWithDbLinks(nodes, edges, links, docFallback);

  return { series, contributionGraph };
}
