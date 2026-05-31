/**
 * Interpretation bridge — roadmap tra domini scientifici/operativi.
 *
 * Non contiene numeri da motori né target macro: è il contratto per una seconda passata
 * (retrieval + evidenza strutturata) che nel tempo può orchestrare query cross-settore,
 * restando subordinata ai motori deterministici EMPATHY (Reality > Plan).
 */

/** Domini che il bridge può interrogare o dichiarare differiti (chiavi stabili per policy/versioning). */
export type CrossDomainInterpretationDomainId =
  | "physiology_engine"
  | "twin_state"
  | "training_stimulus"
  | "recovery_autonomic"
  | "nutrition_solver"
  | "gut_microbiome"
  | "genomics_nutrigenomics"
  | "epigenetics"
  | "neuroendocrine"
  | "external_knowledge_graph"
  | "food_composition_catalog";

/** Stato cablaggio: cosa è già alimentato vs cosa resta da collegare senza rompere il path deterministico. */
export type CrossDomainProbeStatus =
  | "wired_deterministic"
  | "active_stub"
  | "deferred_retrieval"
  | "not_available";

export type CrossDomainInteractionConfidence =
  | "engine_derived"
  | "session_knowledge"
  | "trace_summary"
  | "deferred_future_retrieval"
  | "coach_memory_context";

/** Nodo roadmap (dominio ↔ stato operativo). */
export type CrossDomainInterpretationNode = {
  domainId: CrossDomainInterpretationDomainId;
  probeStatus: CrossDomainProbeStatus;
  summaryLineIt: string;
  /** Riferimenti opachi (trace id, pathway id, modulo prodotto) — solo audit/UI. */
  evidenceRefs?: string[];
};

/** Arco ipotesi cross-domain (interpretazione, non causalità clinica asserita). */
export type CrossDomainInterpretationEdge = {
  id: string;
  fromDomain: CrossDomainInterpretationDomainId;
  toDomain: CrossDomainInterpretationDomainId;
  hypothesisLabelIt: string;
  confidence: CrossDomainInteractionConfidence;
};

/**
 * Roadmap serializzabile da agganciare a `/api/nutrition/module`, traces, memoria atleta.
 * `layer` evolve con versioni; client ignorano campi futuri se schemaVersion === 1.
 */
export type CrossDomainInterpretationRoadmap = {
  schemaVersion: 1;
  layer: "interpretation_bridge_stub_v1" | "interpretation_bridge_v2_multiscale";
  /** Policy orchestrazione (bump quando cambiano regole di defer/wired). */
  policyVersion: string;
  athleteId: string;
  /** Data ancorata (tipicamente pathwayDate o giorno piano). */
  anchorDate: string;
  roadmapHeadlineIt: string;
  stimulusAnchorsIt: string[];
  nodes: CrossDomainInterpretationNode[];
  edges: CrossDomainInterpretationEdge[];
  /** Chiavi stabili per backlog retrieval (nutrigenomica, epigenetica, panel microbiota, …). */
  deferredProbeKeys: string[];
  disclaimerIt: string;
};

/** Versione policy iniziale — incrementare solo quando cambiano regole del builder v1. */
export const CROSS_DOMAIN_INTERPRETATION_POLICY_V1 = "empathy.cross_domain_interpretation.policy_v1" as const;
