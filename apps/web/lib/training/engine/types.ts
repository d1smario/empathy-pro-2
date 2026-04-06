export type TrainingDomain =
  | "endurance"
  | "gym"
  | "crossfit"
  | "hyrox"
  | "team_sport"
  | "combat"
  | "mind_body";

export type PrimaryPhysiologySystem =
  | "aerobic"
  | "anaerobic_alactic"
  | "anaerobic_lactic"
  | "neuromuscular_strength"
  | "neuromuscular_power"
  | "coordination"
  | "proprioception"
  | "mobility"
  | "stability"
  | "skill";

export type AdaptationTarget =
  | "mitochondrial_density"
  | "vo2_max_support"
  | "lactate_tolerance"
  | "lactate_clearance"
  | "max_strength"
  | "power_output"
  /** Ipertrofia “massa” generale (V1 `massa`): volume moderato, tensione + stress metabolico bilanciati */
  | "hypertrophy_mixed"
  /** EMPATHY: alta intensità, volume contenuto — potenza / misti aerobici-anaerobici senza ipertrofia volumetrica eccessiva */
  | "hypertrophy_myofibrillar"
  /** EMPATHY: alto volume, sfinimento — culturistica, pesistica, forza in atletica; meno peso/potenza “da misto” */
  | "hypertrophy_sarcoplasmic"
  /** V1 `neuromuscolare`: qualità d’innervazione, intento velocità, RFD senza massimizzare 1RM */
  | "neuromuscular_adaptation"
  | "movement_quality"
  | "mobility_capacity"
  | "skill_transfer"
  | "recovery";

/** Canale attrezzatura per filtro deterministico esercizi gym (non sostituisce `equipment` grezzo). */
export type GymEquipmentChannel = "free_weight" | "bodyweight" | "cable" | "elastic" | "machine";

/** Enfasi contrattile — incrocia V1 `EXECUTION_STYLES` + letteratura (eccentric, ISO, plio). */
export type GymContractionEmphasis = "standard" | "eccentric" | "isometric" | "plyometric";

/**
 * Profilo opzionale gym: stessi input del motore, arricchiscono solo scoring esercizi + cue di sessione.
 * Nessun secondo generatore.
 */
export type GymGenerationProfile = {
  equipmentChannels?: GymEquipmentChannel[];
  contraction?: GymContractionEmphasis;
};

export type SessionMethod =
  | "steady"
  | "interval"
  | "repeated_sprint"
  | "strength_sets"
  | "power_sets"
  | "mixed_circuit"
  | "technical_drill"
  | "flow_recovery";

export type LoadBand = "low" | "moderate" | "high" | "very_high";

export type ExerciseLibraryItem = {
  id: string;
  name: string;
  domain: TrainingDomain;
  sportTags: string[];
  movementPattern: string;
  muscleGroups: string[];
  equipment: string[];
  /** Meta opzionale per matching `GymGenerationProfile` quando la riga è ambigua. */
  gymMeta?: {
    channels?: GymEquipmentChannel[];
    contractions?: GymContractionEmphasis[];
  };
  physiology: {
    primarySystem: PrimaryPhysiologySystem;
    secondarySystems: PrimaryPhysiologySystem[];
    adaptationTargets: AdaptationTarget[];
    loadBand: LoadBand;
    lactateImpact: "low" | "medium" | "high";
    cnsLoad: "low" | "medium" | "high";
  };
  skills: {
    coordination: "low" | "medium" | "high";
    balance: "low" | "medium" | "high";
    techniqueLevel: "low" | "medium" | "high";
  };
};

export type AthleteMetabolicState = {
  ftpW: number | null;
  vo2maxMlKgMin: number | null;
  vLamax: number | null;
  lactateThresholdPowerW: number | null;
  fatigueScore: number; // 0..100
  readinessScore: number; // 0..100
};

/** Macro C — moduli tecnico-tattici (parità concettuale V1 Virya + builder). */
export type TechnicalWorkPhase = "technique" | "tactics";

/** Fase di gioco / contesto operativo (squadra e situazioni 1v1). */
export type TechnicalGameContext = "defensive" | "build_up" | "offensive";

export type TechnicalAthleticQualityId =
  | "strength"
  | "neuromuscular"
  | "visual_perception"
  | "proprioception"
  | "coordination"
  | "spatial_awareness"
  | "game_vision"
  | "rhythm_timing"
  | "reactive_agility";

export type TechnicalModuleFocus = {
  workPhase: TechnicalWorkPhase;
  gameContext: TechnicalGameContext;
  athleticQualities: TechnicalAthleticQualityId[];
};

export type SessionGoalRequest = {
  sport: string;
  domain: TrainingDomain;
  goalLabel: string;
  adaptationTarget: AdaptationTarget;
  sessionMinutes: number;
  phase: "base" | "build" | "peak" | "taper";
  tssTargetHint?: number;
  intensityHint?: string;
  objectiveDetail?: string;
  /** Solo dominio gym / macro forza: filtro attrezzi + enfasi contrattile. */
  gymProfile?: GymGenerationProfile;
  /**
   * Macro C: struttura generativa modulare (fase lavoro, contesto, qualità atletica).
   * Arricchisce solo testo motore / rationale; il TSS resta dal profilo di carico + hint opzionale.
   */
  technicalModuleFocus?: TechnicalModuleFocus;
};

export type SessionBlock = {
  order: number;
  label: string;
  method: SessionMethod;
  targetSystem: PrimaryPhysiologySystem;
  durationMinutes: number;
  intensityCue: string;
  expectedAdaptation: AdaptationTarget;
  exerciseIds: string[];
};

export type GeneratedSession = {
  sport: string;
  domain: TrainingDomain;
  goalLabel: string;
  physiologicalTarget: AdaptationTarget;
  expectedLoad: {
    loadBand: LoadBand;
    tssHint: number | null;
  };
  blocks: SessionBlock[];
  rationale: string[];
};
