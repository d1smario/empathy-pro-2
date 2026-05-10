/**
 * Read-model types aligned to `public.bioenergetic_evidence_*` (migration 051).
 * Link curati: assi fisiologici / neuroendocrini ↔ processi fluidi ↔ documenti.
 */

import type { KnowledgeDocumentRef } from "./knowledge";

export type BioenergeticEvidenceAxisFamilyV1 =
  | "endocrine"
  | "neuroendocrine"
  | "renal_fluid"
  | "autonomic"
  | "other";

export type BioenergeticEvidenceFluidCategoryV1 =
  | "plasma_volume"
  | "ecw_shift"
  | "transcapillary_filtration"
  | "gi_water_handling"
  | "sweat_loss"
  | "other";

export type BioenergeticEvidenceLinkRelationKindV1 =
  | "promotes"
  | "inhibits"
  | "modulates"
  | "context_dependent";

export type BioenergeticEvidenceLinkStrengthV1 =
  | "hypothesis"
  | "supported"
  | "strong_consensus";

export type BioenergeticEvidenceAxisRowV1 = {
  id: string;
  code: string;
  labelIt: string;
  family: BioenergeticEvidenceAxisFamilyV1;
  notesIt?: string | null;
};

export type BioenergeticEvidenceFluidProcessRowV1 = {
  id: string;
  code: string;
  labelIt: string;
  category: BioenergeticEvidenceFluidCategoryV1;
  notesIt?: string | null;
};

/** Join denormalizzato per API / synthesizer (asse + fluido + documenti). */
export type BioenergeticAxisFluidEvidenceLinkV1 = {
  linkId: string;
  relationKind: BioenergeticEvidenceLinkRelationKindV1;
  strength: BioenergeticEvidenceLinkStrengthV1;
  narrativeIt: string;
  curatedAt: string;
  axis: BioenergeticEvidenceAxisRowV1;
  fluidProcess: BioenergeticEvidenceFluidProcessRowV1;
  documents: KnowledgeDocumentRef[];
  ontologyRefs?: Array<{ system: string; id: string }>;
};
