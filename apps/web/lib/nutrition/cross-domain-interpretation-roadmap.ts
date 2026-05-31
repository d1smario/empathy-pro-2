import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type {
  CrossDomainInterpretationEdge,
  CrossDomainInterpretationNode,
  CrossDomainInterpretationRoadmap,
} from "@empathy/contracts";
import { CROSS_DOMAIN_INTERPRETATION_POLICY_V1 } from "@empathy/contracts";
import type { MultiscalePathwayBridgeResult } from "@/lib/nutrition/multiscale-pathway-bridge";
import type { HealthPanelModulatorBridgeResult } from "@/lib/nutrition/health-panel-modulator-bridge";
import type { NutrientInterrogationViewModel } from "@/api/nutrition/contracts";

export type CrossDomainInterpretationRoadmapTwinSlice = {
  glycogenStatus?: number | null;
  readiness?: number | null;
  redoxStressIndex?: number | null;
  inflammationRisk?: number | null;
} | null;

export type CrossDomainInterpretationRoadmapPhysiologySlice = {
  performanceProfile?: { redoxStressIndex?: number | null } | null;
  lactateProfile?: {
    gutStressScore?: number | null;
    bloodDeliveryPctOfIngested?: number | null;
  } | null;
} | null;

export type CrossDomainInterpretationRoadmapRecoverySlice = {
  status?: string | null;
  guidance?: string | null;
} | null;

export type BuildCrossDomainInterpretationRoadmapInput = {
  athleteId: string;
  anchorDate: string;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  plannedSessions: Array<{ label: string; adaptationTarget?: string | null }>;
  twin: CrossDomainInterpretationRoadmapTwinSlice;
  physiology: CrossDomainInterpretationRoadmapPhysiologySlice;
  recoverySummary: CrossDomainInterpretationRoadmapRecoverySlice;
  researchTraceSummaries: KnowledgeResearchTraceSummary[];
  hasNutritionPerformanceIntegration: boolean;
  /** v2: ontology multiscala cablata in pathway (Interpretation). */
  multiscaleBridge?: MultiscalePathwayBridgeResult | null;
  healthPanelModulators?: HealthPanelModulatorBridgeResult | null;
  nutrientInterrogation?: NutrientInterrogationViewModel | null;
  /** True quando includeHeavy ha sincronizzato nuovi trace da attivazione multiscala. */
  multiscaleResearchSynced?: boolean;
};

function uniqAnchors(sessions: BuildCrossDomainInterpretationRoadmapInput["plannedSessions"]): string[] {
  const out: string[] = [];
  for (const s of sessions) {
    const t = s.adaptationTarget?.trim();
    const line = t ? `${s.label} · ${t}` : s.label;
    if (line.trim()) out.push(line.trim());
  }
  return out.slice(0, 8);
}

function hasSessionKnowledgePathway(mod: NutritionPathwayModulationViewModel | null): boolean {
  return Boolean(mod?.pathways.some((p) => p.confidence === "session_knowledge"));
}

function hasMultiscalePathway(mod: NutritionPathwayModulationViewModel | null): boolean {
  return Boolean(mod?.pathways.some((p) => p.id === "multiscale_ontology_cofactor_support"));
}

function hasHealthLabPathway(mod: NutritionPathwayModulationViewModel | null): boolean {
  return Boolean(mod?.pathways.some((p) => p.id === "health_lab_micronutrient_support"));
}

function edge(
  id: string,
  fromDomain: CrossDomainInterpretationEdge["fromDomain"],
  toDomain: CrossDomainInterpretationEdge["toDomain"],
  hypothesisLabelIt: string,
  confidence: CrossDomainInterpretationEdge["confidence"],
): CrossDomainInterpretationEdge {
  return { id, fromDomain, toDomain, hypothesisLabelIt, confidence };
}

/**
 * Stub deterministico v1: grafo dominio↔dominio senza LLM e senza chiamate esterne.
 * Versioni future arricchiscono nodi/archi e bumpano `policyVersion` senza rompere il contratto.
 */
export function buildCrossDomainInterpretationRoadmapV1(
  input: BuildCrossDomainInterpretationRoadmapInput,
): CrossDomainInterpretationRoadmap {
  const {
    athleteId,
    anchorDate,
    pathwayModulation,
    plannedSessions,
    twin,
    physiology,
    recoverySummary,
    researchTraceSummaries,
    hasNutritionPerformanceIntegration,
    multiscaleBridge,
    healthPanelModulators,
    nutrientInterrogation,
    multiscaleResearchSynced,
  } = input;

  const multiscaleWired = Boolean(multiscaleBridge?.pathwayExtension) || hasMultiscalePathway(pathwayModulation);
  const tracesActive = researchTraceSummaries.some((t) => (t.latestResultSummary ?? "").trim().length > 0);
  const knowledgeGraphWired = tracesActive || Boolean(multiscaleResearchSynced);
  const panelMicro = healthPanelModulators?.subDomainsActive.includes("microbiota");
  const panelEpigen = healthPanelModulators?.subDomainsActive.includes("epigenetics");
  const panelNeuro = healthPanelModulators?.subDomainsActive.includes("neuroendocrine");
  const interrogationCount = nutrientInterrogation?.items.length ?? 0;

  const stimulusAnchorsIt =
    plannedSessions.length > 0
      ? uniqAnchors(plannedSessions)
      : ["Nessuna seduta pianificata in data — roadmap centrata su stato twin/fisiologia e integrazione pasti."];

  const geneticSignals = pathwayModulation?.multiLevelSummary.genetic ?? [];
  const microbiotaSignals = pathwayModulation?.multiLevelSummary.microbiota ?? [];
  const hormonalSignals = pathwayModulation?.multiLevelSummary.hormonal ?? [];
  const neurologicSignals = pathwayModulation?.multiLevelSummary.neurologic ?? [];

  const twinReady = twin != null;
  const physReady = physiology != null;
  const sessionKnowledge = hasSessionKnowledgePathway(pathwayModulation);

  const deferredProbeKeys: string[] = [
    "nutrig.retrieve_variant_bundle_when_health_uploaded",
    "epigen.retrieve_surrogate_methylation_when_panel_exists",
    "neuroend.retrieve_lab_diurnal_axis_when_biomarkers_linked",
    "microbiome.expand_16s_or_shotgun_when_health_panel_linked",
    "knowledge.graph_expand_by_stimulus_and_metabolite",
  ];

  const nodes: CrossDomainInterpretationNode[] = [];

  nodes.push({
    domainId: "training_stimulus",
    probeStatus: plannedSessions.length ? "wired_deterministic" : "active_stub",
    summaryLineIt: plannedSessions.length
      ? `Stimolo da ${plannedSessions.length} seduta/e pianificata/e — ancoraggio per pathway nutrizionali e timing.`
      : "Assenza seduta in data: priorità a stato cronico e recovery.",
    evidenceRefs: plannedSessions.map((_, i) => `planned_session:${i}`),
  });

  nodes.push({
    domainId: "physiology_engine",
    probeStatus: physReady || hasHealthLabPathway(pathwayModulation) ? "wired_deterministic" : "deferred_retrieval",
    summaryLineIt: hasHealthLabPathway(pathwayModulation)
      ? "Panel ematici Health → cofattori pathway (ferritina, B12, vit D, PCR) cablati nel generatore pasti."
      : physReady
        ? "Profilo fisiologico disponibile (proxy redox / delivery / gut da lactato-profile)."
        : "Fisiologia non risolta — bridge ridotto finché non arriva snapshot motori.",
    evidenceRefs: [
      ...(physReady ? ["physiology_state:current"] : []),
      ...(hasHealthLabPathway(pathwayModulation) ? ["health_lab:pathway_bridge"] : []),
    ],
  });

  nodes.push({
    domainId: "twin_state",
    probeStatus: twinReady ? "wired_deterministic" : "deferred_retrieval",
    summaryLineIt: twinReady
      ? "Twin: readiness/redox/glicogeno come contesto qualitativo (non sostituisce solver pasti)."
      : "Twin assente — niente modulazione stato digitale su questo snapshot.",
    evidenceRefs: twinReady ? ["twin_state:current"] : [],
  });

  nodes.push({
    domainId: "recovery_autonomic",
    probeStatus:
      recoverySummary?.status || recoverySummary?.guidance ? "wired_deterministic" : "active_stub",
    summaryLineIt:
      recoverySummary?.guidance?.trim() ||
      (recoverySummary?.status ? `Recovery status: ${recoverySummary.status}` : "Recovery: segnale debole o assente — usarlo quando HRV/sleep sono ingestiti."),
    evidenceRefs: recoverySummary?.status ? [`recovery:${recoverySummary.status}`] : [],
  });

  nodes.push({
    domainId: "neuroendocrine",
    probeStatus:
      panelNeuro || hormonalSignals.length || neurologicSignals.length || typeof twin?.readiness === "number"
        ? panelNeuro
          ? "wired_deterministic"
          : "active_stub"
        : "deferred_retrieval",
    summaryLineIt: panelNeuro
      ? "Biomarker ormonali / snapshot L8 → asse neuroendocrino collegato all'interrogazione nutrienti."
      : hormonalSignals.length || neurologicSignals.length
        ? `Template multi-livello include assi ormonali/neurologici (${[...hormonalSignals, ...neurologicSignals].slice(0, 2).join(" · ")}).`
        : "Asse neuroendocrino: solo proxy da readiness/twin finché non ci sono biomarker dedicati.",
    evidenceRefs: [
      ...(panelNeuro ? ["health_panel:hormones"] : []),
      ...[...hormonalSignals, ...neurologicSignals].slice(0, 4).map((_, i) => `pathway_level:${i}`),
    ],
  });

  nodes.push({
    domainId: "gut_microbiome",
    probeStatus: panelMicro || microbiotaSignals.length ? "wired_deterministic" : "deferred_retrieval",
    summaryLineIt: panelMicro
      ? "Pannello microbiota Health collegato — modulatori barriera/SCFA in interrogazione."
      : microbiotaSignals.length
        ? `Microbiota citato nelle vie attive: ${microbiotaSignals.slice(0, 3).join(" · ")}.`
        : "Microbiota — in attesa di pannelli Health / session knowledge strutturati.",
    evidenceRefs: [
      ...(panelMicro ? ["health_panel:microbiota"] : []),
      ...microbiotaSignals.slice(0, 6),
    ],
  });

  nodes.push({
    domainId: "genomics_nutrigenomics",
    probeStatus:
      multiscaleWired || geneticSignals.length || sessionKnowledge
        ? multiscaleWired
          ? "wired_deterministic"
          : "active_stub"
        : "deferred_retrieval",
    summaryLineIt: multiscaleWired
      ? `Ontology multiscala attiva (${multiscaleBridge?.activatedNodeIds.length ?? 0} nodi) — geni/cluster collegati ai cofattori pasto.`
      : geneticSignals.length || sessionKnowledge
        ? sessionKnowledge
          ? "Genomica/nutrigenomica: hints da session knowledge — espansione retrieval quando ci sono varianti strutturate."
          : `Segnali genetic template da pathway: ${geneticSignals.slice(0, 2).join(" · ")}.`
        : "Nutrigenomica — deferred finché Health/knowledge non espongono varianti nutrizionali strutturate.",
    evidenceRefs: [
      ...(multiscaleWired ? ["multiscale:ontology_bridge"] : []),
      ...geneticSignals.slice(0, 6),
    ],
  });

  nodes.push({
    domainId: "epigenetics",
    probeStatus: panelEpigen ? "active_stub" : "deferred_retrieval",
    summaryLineIt: panelEpigen
      ? "Surrogati epigenetici ingestiti — modulatori metilazione in interrogazione (non decisione clinica)."
      : "Epigenetica — nessun ingest canonico ancora; chiave backlog per metilazione/surrogati quando i pannelli saranno mappati.",
    evidenceRefs: panelEpigen ? ["health_panel:epigenetics"] : [],
  });

  nodes.push({
    domainId: "nutrition_solver",
    probeStatus: hasNutritionPerformanceIntegration ? "wired_deterministic" : "active_stub",
    summaryLineIt: hasNutritionPerformanceIntegration
      ? "Integrazione training↔pasti/fueling attiva — leve scaler disponibili per composer deterministico."
      : "Solver pasti attivo senza leve integrazione estese — solo target profilo/allenamento base.",
    evidenceRefs: hasNutritionPerformanceIntegration ? ["nutrition_performance_integration:v1"] : [],
  });

  nodes.push({
    domainId: "food_composition_catalog",
    probeStatus: "wired_deterministic",
    summaryLineIt:
      "Catalogo composizione (USDA FDC / cache `nutrition_fdc_foods`) — unica fonte micronutrienti per finalize piano.",
    evidenceRefs: ["fdc_cache:canonical"],
  });

  nodes.push({
    domainId: "external_knowledge_graph",
    probeStatus: knowledgeGraphWired ? "wired_deterministic" : "deferred_retrieval",
    summaryLineIt: multiscaleResearchSynced
      ? `Trace espansione sincronizzati da attivazione multiscala (${researchTraceSummaries.length} riepiloghi).`
      : tracesActive
        ? `Knowledge traces recenti (${researchTraceSummaries.length} riepiloghi) collegati al pathway evidence.`
        : "Grafo knowledge esterno — deferred (PubChem/Reactome/Europe PMC su trigger policy future).",
    evidenceRefs: researchTraceSummaries.slice(0, 4).map((t) => `trace:${t.traceId}`),
  });

  const edges: CrossDomainInterpretationEdge[] = [];

  if (plannedSessions.length) {
    edges.push(
      edge(
        "e_train_phys",
        "training_stimulus",
        "physiology_engine",
        "Lo stimolo di allenamento modula il carico fisiologico percepito e i pathway template.",
        "engine_derived",
      ),
    );
    edges.push(
      edge(
        "e_train_twin",
        "training_stimulus",
        "twin_state",
        "Il twin aggiorna readiness/glicogeno in funzione del carico pianificato.",
        "engine_derived",
      ),
    );
  }

  if (physReady) {
    edges.push(
      edge(
        "e_phys_nut",
        "physiology_engine",
        "nutrition_solver",
        "Proxy fisiologici (redox, gut delivery) informano timing/cofattori qualitativi, non kcal inventate.",
        "engine_derived",
      ),
    );
  }

  if (twinReady) {
    edges.push(
      edge(
        "e_twin_nut",
        "twin_state",
        "nutrition_solver",
        "Snapshot twin qualifica contesto pasti (stress/redox/glicogeno) senza override solver.",
        "engine_derived",
      ),
    );
  }

  if (recoverySummary?.status || recoverySummary?.guidance) {
    edges.push(
      edge(
        "e_rec_twin",
        "recovery_autonomic",
        "twin_state",
        "Recovery autonomico influenza readiness e tolleranza allo stimolo successivo.",
        "trace_summary",
      ),
    );
  }

  if (microbiotaSignals.length) {
    edges.push(
      edge(
        "e_micro_nut",
        "gut_microbiome",
        "nutrition_solver",
        "Where microbiota è nelle vie attive, timing fibre/FODMAP può essere vincolato in policy future.",
        sessionKnowledge ? "session_knowledge" : "engine_derived",
      ),
    );
  }

  if (geneticSignals.length || sessionKnowledge) {
    edges.push(
      edge(
        "e_gen_nut",
        "genomics_nutrigenomics",
        "nutrition_solver",
        "Varianti o session knowledge genica possono suggerire micronutrienti prioritari (solo dopo retrieval validato).",
        sessionKnowledge ? "session_knowledge" : "deferred_future_retrieval",
      ),
    );
  }

  if (tracesActive) {
    edges.push(
      edge(
        "e_know_nut",
        "external_knowledge_graph",
        "nutrition_solver",
        "Trace summaries arricchiscono contesto interpretativo — estensione opzionale verso hint solver.",
        "trace_summary",
      ),
    );
  }

  if (hasHealthLabPathway(pathwayModulation)) {
    edges.push(
      edge(
        "e_health_nut",
        "physiology_engine",
        "nutrition_solver",
        "Biomarker ematici strutturati modulano cofattori e swap alimentari (non kcal inventate).",
        "engine_derived",
      ),
    );
  }

  edges.push(
    edge(
      "e_food_nut",
      "food_composition_catalog",
      "nutrition_solver",
      "Finalize nutrienti da cache USDA — coerenza quantitativa con voci piano.",
      "engine_derived",
    ),
  );

  const roadmapHeadlineIt = multiscaleWired
    ? `Road map cross-domain v2: ontology multiscala + ${interrogationCount} nutrienti interrogati — motori deterministici restano fonte numeri.`
    : "Road map interpretativa cross-domain (stub v1): domini cablati vs backlog retrieval — i motori deterministici restano la fonte dei numeri.";

  return {
    schemaVersion: 1,
    layer: multiscaleWired ? "interpretation_bridge_v2_multiscale" : "interpretation_bridge_stub_v1",
    policyVersion: CROSS_DOMAIN_INTERPRETATION_POLICY_V1,
    athleteId,
    anchorDate,
    roadmapHeadlineIt,
    stimulusAnchorsIt,
    nodes,
    edges,
    deferredProbeKeys,
    disclaimerIt:
      "Layer Interpretation — non sostituisce clinica né motori fisiologici. Le ipotesi tra domini sono qualitative; espansione retrieval è governata da policy_version e da payload strutturati validati.",
  };
}
