/**
 * Interazioni X×Y, cross-analita, controfattuali, attribuzione contributi.
 */

import type { BioenergeticAnalyteIdV1, BioenergeticUncertaintyDecompositionV1 } from "./bioenergetic-evidence-shared-v1";
import type { KnowledgeDocumentRef, KnowledgeEvidenceLevel } from "./knowledge";

export type BioenergeticDeformationOperatorKindV1 = "typed" | "generic";

export type BioenergeticDeformationOperatorV1 = {
  operatorId: string;
  version: string;
  appliesTo: BioenergeticAnalyteIdV1;
  operatorKind: BioenergeticDeformationOperatorKindV1;
  params: Record<string, number | string | boolean>;
  evidenceRefs: KnowledgeDocumentRef[];
  confidence: number;
};

export type BioenergeticInteractionKindV1 =
  | "meal_x_postexercise"
  | "cho_x_intensity"
  | "sleep_x_cortisol_nominal"
  | "heat_x_ecw_shift"
  | "sodium_load_x_ecw"
  | "exercise_x_plasma_volume_proxy"
  | "bia_quality_mismatch_x_uncertainty"
  | "custom";

export type BioenergeticSignedInteractionEffectV1 =
  | "synergistic_up"
  | "synergistic_down"
  | "antagonistic"
  | "uncertain";

export type BioenergeticInteractionTermV1 = {
  termId: string;
  interactionKind: BioenergeticInteractionKindV1;
  stimulusRefs: string[];
  nutritionRefs?: string[];
  signedEffect: BioenergeticSignedInteractionEffectV1;
  effectSizePrior?: number;
  effectSizeSd?: number;
  documents: KnowledgeDocumentRef[];
};

export type BioenergeticInteractionTermRefV1 = {
  termId: string;
  contributionToAnalyte: BioenergeticAnalyteIdV1;
};

export type BioenergeticCrossAnalyteCouplingV1 = {
  primary: BioenergeticAnalyteIdV1;
  secondary: BioenergeticAnalyteIdV1;
  correlationPrior: number;
  correlationSd?: number;
  lagHours?: number;
  documents: KnowledgeDocumentRef[];
};

export type BioenergeticCounterfactualCurveBundleV1 = {
  labelIt: string;
  removedContextIds: string[];
  analyteId: BioenergeticAnalyteIdV1;
  unit: string;
  hourlyMean24: number[];
  uncertainty?: BioenergeticUncertaintyDecompositionV1;
  documents: KnowledgeDocumentRef[];
};

export type BioenergeticCurveEvidenceAttributionV1 = {
  contributionId: string;
  analyteId: BioenergeticAnalyteIdV1;
  direction: "up" | "down" | "mixed";
  magnitude01?: number;
  hourRange?: readonly [number, number];
  operator?: BioenergeticDeformationOperatorV1;
  documents: KnowledgeDocumentRef[];
  notesIt?: string;
  conditionalOn?: string[];
  evidenceLevel?: KnowledgeEvidenceLevel;
  sensitivity01?: number;
  priority?: number;
};
