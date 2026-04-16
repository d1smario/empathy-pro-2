import type { AthleteKnowledgeMemory } from "./knowledge";
import type { AthleteProfile } from "./athlete";
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
  audit: {
    computedAt: IsoDateTime;
    sources: AthleteMemoryPatchSource[];
  };
};
