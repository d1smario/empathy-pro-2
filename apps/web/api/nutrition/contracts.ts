import type { PlannedWorkout } from "@empathy/domain-training";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
export type { NutritionPerformanceIntegrationDials };
import type { AthleteMemory, PhysiologyState } from "@/lib/empathy/schemas";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { CanonicalTwinState } from "@/lib/twin/athlete-state-resolver";
import type {
  TrainingAdaptationLoopViewModel,
  TrainingBioenergeticModulationViewModel,
} from "@/api/training/contracts";

export type NutritionPlanVm = {
  date: string;
  calories: number;
  carbsG: number;
  proteinsG: number;
  fatsG: number;
  hydrationMl: number;
};

export type NutritionPlanSource = "nutrition_plans" | "calendar_training_solver" | "none";

export type NutritionViewModel = {
  athleteId: string;
  plan: NutritionPlanVm;
  adherenceScore: number;
  error?: string | null;
  /** Da dove arrivano i target giornalieri (piano DB esplicito vs allenamenti in calendario). */
  planSource?: NutritionPlanSource;
  /** Sessioni `planned_workouts` per la data richiesta. */
  plannedSessionsCount?: number;
};

export type NutritionPlannedWorkoutRow = Record<string, unknown> & {
  builderSession?: Pro2BuilderSessionContract | null;
  canonicalPlannedWorkout?: PlannedWorkout | null;
  plannedDiscipline?: string | null;
  plannedFamily?: string | null;
  plannedSessionName?: string | null;
  plannedAdaptationTarget?: string | null;
};

export type NutritionPathwayPhaseKind =
  | "pre_acute"
  | "peri_workout"
  | "early_recovery"
  | "late_recovery"
  | "daily_support";

/** Qualitative classes — not individual molecular PK. */
export type NutritionPathwayHalfLifeClass = "minutes_acute" | "hours_signal" | "hours_extended" | "circadian";

export type NutritionPathwaySystemLevel = "biochemical" | "genetic" | "hormonal" | "neurologic" | "microbiota";

export type NutritionPathwayTimingPhase = {
  phase: NutritionPathwayPhaseKind;
  windowLabel: string;
  halfLifeClass: NutritionPathwayHalfLifeClass;
  actions: string[];
};

/** One metabolic “pathway context” nutrition can amplify (substrates, cofactors, inhibitors, timing). */
export type NutritionPathwaySupportItem = {
  id: string;
  pathwayLabel: string;
  stimulatedBy: string[];
  substrates: string[];
  cofactors: string[];
  inhibitorsToAvoid: string[];
  phases: NutritionPathwayTimingPhase[];
  systemLevels: NutritionPathwaySystemLevel[];
  confidence: "proxy" | "session_knowledge" | "engine_derived";
};

/** Multilevel view of stimulated routes (for analysis UI, not a full reactome simulation). */
export type NutritionPathwayModulationViewModel = {
  modelVersion: number;
  layer: "deterministic_pathway_template";
  sessionDate: string;
  pathways: NutritionPathwaySupportItem[];
  aggregateInhibitors: string[];
  multiLevelSummary: Record<NutritionPathwaySystemLevel, string[]>;
  notes: string[];
};

export type FunctionalNutrientKind = "vitamin" | "mineral" | "amino_acid" | "fatty_acid" | "other";

export type FunctionalFoodCuratedExample = {
  name: string;
  why: string;
};

/** USDA FDC POST /foods/search — filter by minimum nutrient per 100 g + text queries (Foundation / SR Legacy). */
export type UsdaRichFoodSearchSpecViewModel = {
  fdcNutrientId: number;
  /** Short label for UI (e.g. "Magnesio (mg/100 g)") */
  nutrientShortLabel: string;
  minimumPer100g: number;
  /** One USDA call per string; merged server-side */
  queries: string[];
  dataTypes: string[];
};

/** Nutrient / molecule target → curated foods + lookup queries for OFF/USDA. */
export type FunctionalFoodTargetViewModel = {
  nutrientId: string;
  kind: FunctionalNutrientKind;
  displayNameIt: string;
  rationaleIt: string;
  pathwayIds: string[];
  pathwayLabel: string;
  searchQueries: string[];
  curatedExamples: FunctionalFoodCuratedExample[];
  /** When set, `/api/nutrition/usda-by-nutrient?catalogId=` returns foods sorted by this nutrient density */
  usdaRichSearch?: UsdaRichFoodSearchSpecViewModel | null;
};

/** One row from USDA rich-nutrient merge (per 100 g where available). */
export type UsdaRichFoodItemViewModel = {
  fdcId: number;
  description: string;
  dataType: string;
  targetNutrientId: number;
  targetAmountPer100g: number | null;
  targetUnitName: string | null;
  energyKcal100: number | null;
  proteinG100: number | null;
  carbsG100: number | null;
  fatG100: number | null;
};

export type FunctionalFoodRecommendationsViewModel = {
  modelVersion: number;
  layer: "deterministic_food_bridge";
  targets: FunctionalFoodTargetViewModel[];
  notes: string[];
};

export type NutritionMetabolicEfficiencyBand = "low" | "moderate" | "high";

/** Interpretation-only synthesis over deterministic engines + knowledge traces (not an LLM output). */
export type NutritionMetabolicEfficiencyGenerativeViewModel = {
  modelVersion: number;
  layer: "interpretation";
  headline: string;
  narrative: string;
  metabolicEfficiencyIndex: number;
  bands: {
    substrateAvailability: NutritionMetabolicEfficiencyBand;
    mitochondrialSupport: NutritionMetabolicEfficiencyBand;
    adaptiveAlignment: NutritionMetabolicEfficiencyBand;
  };
  levers: Array<{
    domain: "nutrition" | "training" | "recovery";
    priority: number;
    title: string;
    detail: string;
  }>;
  knowledgeAmplification: string | null;
  inputsUsed: string[];
};

/** Voce diario persistita — nutrienti da USDA FDC o scala deterministica da valori /100g. */
export type FoodDiaryEntryViewModel = {
  id: string;
  athleteId: string;
  entryDate: string;
  entryTime: string | null;
  mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  provenance: "usda_fdc" | "scaled_reference";
  fdcId: number | null;
  foodLabel: string;
  quantityG: number;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  sodiumMg: number | null;
  referenceSourceTag: string | null;
  notes: string | null;
  supplements: string | null;
  createdAt: string;
};

export type FoodDiaryDayTotalsViewModel = {
  date: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  entryCount: number;
};

export type FoodDiaryListViewModel = {
  athleteId: string;
  from: string;
  to: string;
  entries: FoodDiaryEntryViewModel[];
  dayTotals: FoodDiaryDayTotalsViewModel[];
};

export type NutritionModuleViewModel = {
  athleteId: string;
  from: string;
  to: string;
  profile: Record<string, unknown> | null;
  physio: Record<string, unknown> | null;
  physiologyState?: PhysiologyState | null;
  twinState?: CanonicalTwinState | null;
  recoverySummary?: RecoverySummary | null;
  adaptationGuidance?: Record<string, unknown> | null;
  operationalContext?: TrainingDayOperationalContext | null;
  adaptationLoop?: TrainingAdaptationLoopViewModel | null;
  bioenergeticModulation?: TrainingBioenergeticModulationViewModel | null;
  nutritionPerformanceIntegration?: NutritionPerformanceIntegrationDials | null;
  metabolicEfficiencyGenerativeModel?: NutritionMetabolicEfficiencyGenerativeViewModel | null;
  /** Present when `pathwayDate` query is set and falls within `from`…`to` (stesso modello del client). */
  pathwayModulation?: NutritionPathwayModulationViewModel | null;
  functionalFoodRecommendations?: FunctionalFoodRecommendationsViewModel | null;
  athleteMemory?: AthleteMemory | null;
  executed: Array<Record<string, unknown>>;
  planned: NutritionPlannedWorkoutRow[];
  researchTraceSummaries?: KnowledgeResearchTraceSummary[];
  error?: string | null;
};

