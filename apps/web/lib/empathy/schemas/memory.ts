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

/** L8: righe `systemic_modulation_snapshots` — meta-modulazione, non duplica `biomarker_panels` / `panels`. */
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
  /** Righe grezze `biomarker_panels` (come da DB). */
  panels: Array<Record<string, unknown>>;
  /** Osservazioni atomiche normalizzate (MVP): marker clinici, microbiota, epigenetica, ormoni. */
  normalizedObservations?: {
    lab: Array<Record<string, unknown>>;
    microbiota: Array<Record<string, unknown>>;
    epigenetic: Array<Record<string, unknown>>;
    hormones: Array<Record<string, unknown>>;
  };
  /** Grafo causale operativo atleta (nodi/archi) + risposte bioenergetiche. */
  systemGraph?: {
    nodes: Array<Record<string, unknown>>;
    edges: Array<Record<string, unknown>>;
    bioenergeticsResponses: Array<Record<string, unknown>>;
  };
  /** Ultimi snapshot L8; separato da `panels` per evitare doppioni concettuali. */
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
