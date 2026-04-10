/** Multiscale biological engine — types only (Pro 2 domain-knowledge). */

export const MULTISCALE_ONTOLOGY_VERSION = "2026.4.1" as const;

export type MultiscaleScaleId =
  | "genome_epigenome"
  | "transcriptome"
  | "proteome"
  | "metabolome"
  | "cell_signalling"
  | "tissue"
  | "systems"
  | "whole_body";

/** L1–L6 “gold” hierarchy (interpretation priority). */
export type MetabolicHierarchyLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type MultiscaleNodeKind =
  | "scale_anchor"
  | "gene_cluster"
  | "enzyme"
  | "signalling_axis"
  | "endocrine_cascade"
  | "microbiota_function"
  | "neuro_tag";

export type MultiscaleNode = {
  id: string;
  kind: MultiscaleNodeKind;
  label: string;
  labelIt: string;
  scale: MultiscaleScaleId;
  metabolicLevel: MetabolicHierarchyLevel;
  /** HGNC / common symbols for literature tagging */
  symbols?: string[];
  /** Links to nutrition functional tags (folate, mg, …) */
  cofactorNutrientTags?: string[];
};

export type MultiscaleEdgePredicate =
  | "activates"
  | "inhibits"
  | "modulates"
  | "supports"
  | "requires";

export type MultiscaleEvidenceLevel = "strong" | "moderate" | "weak" | "exploratory";

export type MultiscaleEdge = {
  id: string;
  subjectId: string;
  predicate: MultiscaleEdgePredicate;
  objectId: string;
  evidenceLevel: MultiscaleEvidenceLevel;
};

/** Proxies from twin + physiology (no PHI); aligns with V1 pathway-modulation thresholds. */
export type MultiscaleSignalSnapshot = {
  redoxStressIndex?: number | null;
  twinInflammationRisk?: number | null;
  glycogenStatus?: number | null;
  readiness?: number | null;
  gutStressScorePct?: number | null;
  choDeliveryPctOfIngested?: number | null;
  oxidativeBottleneckIndex?: number | null;
};

export type BottleneckLevelScore = {
  level: MetabolicHierarchyLevel;
  score: number;
  rationaleIt: string;
};

export type MetabolicBottleneckView = {
  ontologyVersion: typeof MULTISCALE_ONTOLOGY_VERSION;
  dominantBottleneck: BottleneckLevelScore;
  orderedLevels: BottleneckLevelScore[];
  suggestedInterpretationTags: string[];
  activatedNodeIds: string[];
};
