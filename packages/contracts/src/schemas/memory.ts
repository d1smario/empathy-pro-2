import type { AthleteKnowledgeMemory } from "./knowledge";
import type { AerodynamicsTwinSnapshotV1 } from "./aerodynamics";
import type { AthleteProfile } from "./athlete";
import type { BiomechanicsTwinSnapshotV1 } from "./biomechanics";
import type { IsoDateTime } from "./common";
import type { NutritionConstraints } from "./nutrition";
import type { PhysiologyState } from "./physiology";
import type { RealityIngestionRecord } from "./reality";
import type { TwinState } from "./twin";

export type AthleteMemoryPatchSource = {
  domain: string;
  source: string;
  sourceId?: string;
  confidence?: number;
  updatedAt: IsoDateTime;
};

export type AthleteIdentityMemory = {
  athleteId: string;
  ownerUserId?: string | null;
  coachUserIds: string[];
  roleMode: "private" | "coach_managed" | "shared" | "unassigned";
};

/** L8: righe `systemic_modulation_snapshots` — separato da `biomarker_panels`. */
export type AthleteSystemicModulationSnapshot = {
  id: string;
  athleteId: string;
  capturedAt: IsoDateTime;
  algorithmVersion: string;
  source: string;
  axes: string[];
  payload: Record<string, unknown>;
  createdAt?: IsoDateTime;
};

export type AthleteHealthMemory = {
  blood?: Record<string, unknown> | null;
  microbiota?: Record<string, unknown> | null;
  epigenetics?: Record<string, unknown> | null;
  panels: Array<Record<string, unknown>>;
  normalizedObservations?: {
    lab: Array<Record<string, unknown>>;
    microbiota: Array<Record<string, unknown>>;
    epigenetic: Array<Record<string, unknown>>;
    hormones: Array<Record<string, unknown>>;
  };
  systemGraph?: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    bioenergeticsResponses: Array<Record<string, unknown>>;
  };
  systemicModulationSnapshots: AthleteSystemicModulationSnapshot[];
};

export type AthleteNutritionMemory = {
  constraints?: NutritionConstraints | null;
  profileConfig?: Record<string, unknown> | null;
  fuelingConfig?: Record<string, unknown> | null;
  diary?: Array<Record<string, unknown>>;
};

export type AthleteEvidenceMemoryItem = {
  id?: string;
  source?: string;
  query?: string;
  title?: string;
  summary?: string;
  url?: string;
  relevanceScore?: number;
  module?: string;
  domain?: string;
  adaptationTarget?: string;
  sessionDate?: string;
  plannedWorkoutId?: string;
  mechanismTags?: string[];
  nutritionTags?: string[];
  recoveryTags?: string[];
  evidenceClass?: string;
  confidence?: number;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
};

export type AthleteRealityMemory = {
  recentIngestions: RealityIngestionRecord[];
};

export type AthleteWorkoutArchetypeTraceMemoryItem = {
  id: string;
  archetypeKey: string;
  libraryItemId?: string | null;
  plannedTss: number;
  executedTss: number;
  adherencePct: number;
  responseSignal: "positive" | "neutral" | "negative";
  source: string;
  observedAt: string;
  metadata?: Record<string, unknown>;
};

/** Read spine opzionale — library traces + tag preferiti (default []). */
export type AthleteTrainingMemory = {
  libraryArchetypeTraces: AthleteWorkoutArchetypeTraceMemoryItem[];
  preferredTags: string[];
};

export type AthleteBiomechanicsMemory = {
  latestSnapshot?: BiomechanicsTwinSnapshotV1 | null;
  historicalEvolution?: Array<Pick<BiomechanicsTwinSnapshotV1, "computedAt" | "efficiencyScores" | "riskScores" | "confidence01">>;
};

export type AthleteAerodynamicsMemory = {
  latestSnapshot?: AerodynamicsTwinSnapshotV1 | null;
  historicalEvolution?: Array<Pick<AerodynamicsTwinSnapshotV1, "computedAt" | "currentCdaM2" | "optimizedCdaM2" | "scores" | "confidence01">>;
};

export type AthleteHumanEfficiencyMemory = {
  globalHumanEfficiency01?: number;
  physiologicalEfficiency01?: number;
  mechanicalEfficiency01?: number;
  aerodynamicEfficiency01?: number;
  confidence01?: number;
  algorithmVersion?: string;
  computedAt?: IsoDateTime;
};

export type AthleteMemory = {
  athleteId: string;
  identity: AthleteIdentityMemory;
  profile: AthleteProfile | null;
  physiology: PhysiologyState | null;
  nutrition: AthleteNutritionMemory;
  health: AthleteHealthMemory;
  twin: TwinState | null;
  reality: AthleteRealityMemory;
  evidenceMemory: {
    items: AthleteEvidenceMemoryItem[];
  };
  knowledge?: AthleteKnowledgeMemory;
  training?: AthleteTrainingMemory;
  biomechanics?: AthleteBiomechanicsMemory;
  aerodynamics?: AthleteAerodynamicsMemory;
  humanEfficiency?: AthleteHumanEfficiencyMemory;
  audit: {
    computedAt: IsoDateTime;
    sources: AthleteMemoryPatchSource[];
  };
};
