/**
 * Nutrition Meal Plan V2 — contratti (requirements, tassonomia USDA, strategia).
 * Pipeline parallela a V1; cutover dopo validazione.
 */

import type { IsoDate } from "./common";

/** Asse 1 — ruolo nel pasto (non "primo/secondo" menu, ma leva composizione). */
export type FdcMealCourseTag =
  | "primo_carb"
  | "secondo_protein"
  | "contorno_veg"
  | "frutta"
  | "dolce"
  | "snack"
  | "bevanda"
  | "latticino"
  | "legume"
  | "condimento"
  | "composite_dish"
  | "preparato_polvere"
  | "energetico_sport";

/** Asse 2 — famiglia alimentare. */
export type FdcFoodFamilyTag =
  | "cereale"
  | "pasta_riso"
  | "pane"
  | "verdura"
  | "frutta"
  | "legume"
  | "pesce"
  | "carne"
  | "uova"
  | "latticino"
  | "oleaginoso"
  | "olio"
  | "bevanda_vegetale"
  | "tuberi";

/** Asse 3 — dominanza macro / fibre. */
export type FdcMacroDominantTag =
  | "cho_complex"
  | "cho_simple"
  | "protein_dense"
  | "fat_dense"
  | "fiber_dense"
  | "mixed";

/** Asse 3b — slot operativo Empathy. */
export type FdcSlotFitTag =
  | "breakfast"
  | "snack"
  | "main_meal"
  | "fueling"
  | "evening";

/**
 * Asse 4 — profilo dieta / restrizioni (filtro selezione efficiente).
 * Un alimento può avere più tag (es. mediterranean + vegetarian + lactose_free).
 */
export type FdcDietProfileTag =
  | "mediterranean"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "thai"
  | "carnivore"
  | "paleo"
  | "celiac"
  | "lactose_free"
  | "low_histamine"
  | "omnivore";

/** Profili aminoacidi / composti bioattivi per scelta mirata. */
export type FdcAminoProfileTag =
  | "histamine_rich"
  | "histamine_low"
  | "glutamine_rich"
  | "leucine_rich"
  | "bcaa_rich"
  | "tryptophan_rich"
  | "taurine_rich"
  | "collagen_rich";

/** Esclusioni esplicite (celiaco → gluten; vegano → animal; paleo → grain/legume). */
export type FdcDietExcludeTag =
  | "gluten"
  | "lactose"
  | "animal"
  | "grain"
  | "legume"
  | "high_histamine"
  | "nightshade";

/** Ruolo menu italiano — complemento a meal_course. */
export type FdcMealRoleTag = "primo" | "secondo" | "contorno" | "dolce" | "bevanda" | "snack";

/** Densità micronutrienti pre-calcolata (pathway / integrazione). */
export type FdcNutrientDensityTag =
  | "folate_dense"
  | "iron_dense"
  | "b12_dense"
  | "zinc_dense"
  | "magnesium_dense"
  | "vit_c_dense"
  | "omega3_dense"
  | "potassium_dense";

export type FdcFoodTaxonomy = {
  mealCourse: FdcMealCourseTag[];
  foodFamily: FdcFoodFamilyTag[];
  macroDominant: FdcMacroDominantTag[];
  slotFit: FdcSlotFitTag[];
  dietProfile: FdcDietProfileTag[];
  dietExclude: FdcDietExcludeTag[];
  mealRole: FdcMealRoleTag[];
  aminoProfile: FdcAminoProfileTag[];
  nutrientDensity: FdcNutrientDensityTag[];
  classifierVersion: string;
};

export type EmpathyNutritionStrategyKind =
  | "maintenance"
  | "load"
  | "deload"
  | "recovery"
  | "race"
  | "custom";

export type EmpathyNeuroHormonalAxis =
  | "glycogen_supercomp"
  | "fat_oxidation"
  | "mtor_anabolic"
  | "autophagy_deload"
  | "redox_support"
  | "neuromuscular";

export type MacroGPerKgTemplate = {
  choMinGPerKg: number;
  choMaxGPerKg: number;
  proGPerKg: number;
  fatGPerKg: number;
};

export type DailyMacroGrams = {
  choG: number;
  proG: number;
  fatG: number;
};

export type SubstrateFuelingSessionV2 = {
  sessionLabel: string;
  avgPowerW: number;
  durationH: number;
  choBurnedG: number;
  fatBurnedG: number;
  choEnergyShare: number;
  intraChoReplaceFraction: number;
  preChoG: number;
  intraChoG: number;
  postChoG: number;
  intraChoGPerH: number;
};

export type SubstrateFuelingPlanV2 = {
  algorithmVersion: "substrate_fueling_v1";
  sessions: SubstrateFuelingSessionV2[];
  totals: {
    preChoG: number;
    intraChoG: number;
    postChoG: number;
    fuelingKcal: number;
    endogenousFatKcal: number;
  };
};

export type DailyMacroGPerKgTargets = {
  choMinGPerKg: number;
  choMaxGPerKg: number;
  proGPerKg: number;
  fatGPerKg: number;
};

export type DailyNutritionRequirementsV2 = {
  athleteId: string;
  planDate: IsoDate;
  algorithmVersion: "nutrition_requirements_v2_preview" | "nutrition_requirements_v2_production";
  weightKg: number;
  strategyKind: EmpathyNutritionStrategyKind;
  dietProfileActive: FdcDietProfileTag;
  /** Strategia giornaliera substrati (g/kg) — target pasti, non fueling intra. */
  dailyMacroTargetsGPerKg: DailyMacroGPerKgTargets;
  energy: {
    bmrKcal: number;
    lifestyleKcal: number;
    trainingKcal: number;
    dailyKcal: number;
    mealsKcal: number;
    fuelingKcal: number;
    palMultiplier: number;
    /** kcal training non reintegrate oralmente (grassi endogeni + CHO residuo). */
    endogenousTrainingKcal?: number;
  };
  /** Fueling pre/intra/post da consumo CHO seduta (V2). */
  substrateFueling?: SubstrateFuelingPlanV2;
  macros: {
    basal: DailyMacroGrams;
    training: DailyMacroGrams;
    total: DailyMacroGrams;
  };
  substrateRates: Array<{
    sessionLabel: string;
    avgPowerW: number;
    durationH: number;
    choGPerH: number;
    fatGPerH: number;
    proGPerH: number;
  }>;
  provenance: string[];
};

export type MealPlanV2FoodPoolPreview = {
  slot: string;
  labelIt: string;
  filterSummary: string;
  candidates: Array<{
    fdcId: number;
    description: string;
    kcalPer100g: number;
    proteinPer100g: number;
    carbsPer100g: number;
    tags: Partial<FdcFoodTaxonomy>;
  }>;
};

export type MealPlanV2ServingBasis = "dry_grams" | "cooked_grams" | "ml";

export type MealPlanV2ComposedItem = {
  fdcId: number;
  description: string;
  grams: number;
  kcal: number;
  choG: number;
  proG: number;
  fatG: number;
  /** Chiave banca canonica (es. rice_dry) — fonte preferita nutrienti. */
  canonicalKey?: string;
  /** Base porzione per scaling USDA (allineato a portionHint). */
  servingBasis?: MealPlanV2ServingBasis;
};

export type MealPlanV2ComposedSlot = {
  slot: string;
  labelIt: string;
  targetKcal: number;
  items: MealPlanV2ComposedItem[];
  totals: { kcal: number; choG: number; proG: number; fatG: number };
};

export type MealPlanV2DietSlotBudget = {
  key: string;
  label: string;
  pct: number;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

export type IntelligentMealPlanV2Preview = {
  layer: "nutrition_meal_plan_v2_preview";
  requirements: DailyNutritionRequirementsV2;
  taxonomyVersion: string;
  /** Slot pasti da Profile Diet (% kcal) — unica fonte ripartizione pasti. */
  dietMealSlotBudgets?: MealPlanV2DietSlotBudget[];
  foodPoolsBySlot: MealPlanV2FoodPoolPreview[];
  /** Bozza deterministica da pool USDA (beta) — non sostituisce solver V1. */
  composedMealPlan?: MealPlanV2ComposedSlot[];
  disclaimer: string;
};
