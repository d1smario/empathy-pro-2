/**
 * Catalogo unificato post-pipeline (data/exercises/final/exercise-library.json).
 * Separato da ExerciseLibraryItem del motore V1 ma convertibile.
 */

export type LactateOrLoadLevel = "low" | "medium" | "high";

export type UnifiedPhysiology = {
  primarySystem: string;
  secondarySystem?: string;
  energySystem: string;
  lactateImpact: LactateOrLoadLevel;
  cnsLoad: LactateOrLoadLevel;
};

export type UnifiedSkills = {
  coordination: string;
  balance: string;
  technique: string;
};

export type UnifiedExercisePurpose = {
  functionalGoals: string[];
  metabolicGoals: string[];
  technicalScope: "generic" | "sport_specific";
  technicalSports: string[];
  technicalTags: string[];
};

export type UnifiedExerciseRecord = {
  id: string;
  slug: string;
  name: string;
  category: string;
  sportTags: string[];
  movementPattern: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | "unknown";
  physiology: UnifiedPhysiology;
  skills: UnifiedSkills;
  purpose?: UnifiedExercisePurpose;
  /** Sorgenti e id esterni (no duplicati logici nel builder) */
  provenance: Array<{ source: string; externalId?: string }>;
  media?: {
    /** Asset locale proprietario EMPATHY importato nel progetto/bucket. */
    localAssetPath?: string;
    /** Chiave stabile per la libreria visuale EMPATHY / authoring esterno (es. Spline). */
    assetKey?: string;
    /** Strumento di authoring del visual master, non usato a runtime. */
    authoringSource?: "spline" | "ai_generated" | "manual" | "imported";
    gifUrl?: string;
    thumbnailUrl?: string;
  };
};

export type ExerciseCatalogFile = {
  version: number;
  generatedAt: string;
  count: number;
  exercises: UnifiedExerciseRecord[];
};

export type ExerciseSelectorQuery = {
  primarySystem?: string;
  energySystem?: string;
  movementPattern?: string;
  /** Match su equipment (substring o esatto) */
  equipmentIncludes?: string;
  sportTag?: string;
  limit?: number;
};

/** Preset filtro muscolo per builder Blocco 1 (match su tassonomia distretti). */
export type Block1MusclePreset =
  | ""
  | "lower"
  | "upper_push"
  | "upper_pull"
  | "quadriceps"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "chest"
  | "lats"
  | "upper_back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "hip_flexors"
  | "posterior_chain"
  | "full";
