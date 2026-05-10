/**
 * Nucleo contratto: banco evidenza, serie condizionate, grafo contributi, layer VM giornata.
 */

import type { BioenergeticContextCoverageV1 } from "./bioenergetic-conditioning-context-v1";
import type { BioenergeticAxisFluidEvidenceLinkV1 } from "./bioenergetic-evidence-db-v1";
import type {
  BioenergeticCounterfactualCurveBundleV1,
  BioenergeticCrossAnalyteCouplingV1,
  BioenergeticCurveEvidenceAttributionV1,
  BioenergeticInteractionTermRefV1,
} from "./bioenergetic-evidence-interactions-v1";
import type { BioenergeticAnalyteIdV1, BioenergeticUncertaintyDecompositionV1 } from "./bioenergetic-evidence-shared-v1";
import type { KnowledgeDocumentRef } from "./knowledge";

export const BIOENERGETIC_EVIDENCE_CURVE_CONTRACT_VERSION = 1 as const;

export type BioenergeticEvidenceBankRefV1 = {
  bankId: string;
  bankVersion: string;
  buildDigest?: string;
};

export type BioenergeticEvidenceQualityTierV1 =
  | "meta_analysis"
  | "systematic_review"
  | "cohort_pooled"
  | "heterogeneous_primary";

export type BioenergeticEvidenceStratumV1 = {
  stratumId: string;
  labelIt: string;
  inclusionCriteria: string[];
  exclusionCriteria?: string[];
  phenotypeTags: string[];
  evidenceQuality: BioenergeticEvidenceQualityTierV1;
  studyCount?: number;
  subjectCurveCount?: number;
};

export type BioenergeticCurveSynthesisKindV1 =
  | "measured_hold"
  | "device_stream"
  | "deterministic_sim_bank"
  | "evidence_conditioned"
  | "counterfactual_baseline";

export type BioenergeticContributionGraphNodeKindV1 =
  | "stimulus"
  | "nutrition"
  | "prior"
  | "carryover"
  | "lab_anchor"
  | "bia_reading"
  | "hormone_axis"
  | "fluid_process"
  | "environment";

export type BioenergeticContributionGraphNodeV1 = {
  id: string;
  kind: BioenergeticContributionGraphNodeKindV1;
  labelIt?: string;
};

export type BioenergeticContributionGraphEdgeV1 = {
  from: string;
  to: string;
  weight01?: number;
  evidenceLinkId?: string;
  evidenceRefs: KnowledgeDocumentRef[];
};

export type BioenergeticContributionGraphV1 = {
  nodes: BioenergeticContributionGraphNodeV1[];
  edges: BioenergeticContributionGraphEdgeV1[];
};

export type BioenergeticEvidenceConditionedSeriesV1 = {
  analyteId: BioenergeticAnalyteIdV1;
  unit: string;
  hourlyMean24: number[];
  bankRef: BioenergeticEvidenceBankRefV1;
  stratumApplied: BioenergeticEvidenceStratumV1;
  synthesisKind: BioenergeticCurveSynthesisKindV1;
  /** Hash del contesto canonicalizzato (reproducibilità). */
  contextDigest: string;
  uncertainty: BioenergeticUncertaintyDecompositionV1;
  attributions: BioenergeticCurveEvidenceAttributionV1[];
  interactionTerms?: BioenergeticInteractionTermRefV1[];
  crossAnalyteCoupling?: BioenergeticCrossAnalyteCouplingV1[];
  counterfactuals?: BioenergeticCounterfactualCurveBundleV1[];
  warnings: string[];
  coverage: BioenergeticContextCoverageV1;
};

/** Layer opzionale sul view model giornata bioenergetica (scenario letteratura + contesto). */
export type BioenergeticDayEvidenceConditionedLayerV1 = {
  contractVersion: typeof BIOENERGETIC_EVIDENCE_CURVE_CONTRACT_VERSION;
  bankRef: BioenergeticEvidenceBankRefV1;
  series: BioenergeticEvidenceConditionedSeriesV1[];
  contributionGraph?: BioenergeticContributionGraphV1;
  /** Link curati assi ↔ fluidi (da DB 051), se caricati. */
  resolvedEvidenceLinks?: BioenergeticAxisFluidEvidenceLinkV1[];
  disclaimersIt: string[];
};
