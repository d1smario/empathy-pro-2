/**
 * Nutrition constraints, plans, fueling (pre/intra/post).
 */

import type { IsoDate, IsoDateTime, ConstraintLevel } from "./common";

export type LifestyleActivityClass = "sedentary" | "moderate" | "active" | "very_active";
export type NutritionBmrMethod = "cunningham_ffm" | "mifflin_st_jeor" | "weight_proxy";

export type NutritionConstraints = {
  athleteId: string;
  /** Hard: no lactose, gluten-free, vegetarian, allergies */
  dietType?: string;
  intolerances?: string[];
  allergies?: string[];
  excludedFoods?: string[];
  excludedSupplements?: string[];
  /** Soft: preferenze */
  preferredFoods?: string[];
  preferredMealCount?: number;
  timingConstraints?: string[];
  /** Adaptive: dipendono da stato (es. low fiber pre-race) — gestiti a runtime */
  updatedAt?: string;
};

export type NutritionDailyEnergyModel = {
  athleteId: string;
  date: IsoDate;
  algorithmVersion: "v1";
  bmrMethod: NutritionBmrMethod;
  bmrKcal: number;
  leanMassKg?: number | null;
  ageYears?: number | null;
  ftpWKg?: number | null;
  vo2maxMlMinKg?: number | null;
  lifestyle: {
    activityClass: LifestyleActivityClass;
    pct: number;
    kcal: number;
  };
  training: {
    sessionsCount: number;
    durationMin: number;
    kcal: number;
    avgIntensityPctFtp?: number | null;
    estimatedAvgPowerW?: number | null;
  };
  totals: {
    dailyKcal: number;
    mealsKcal: number;
    fuelingKcal: number;
  };
  fueling: {
    capabilityTier: "base" | "high" | "elite";
    preKcal: number;
    intraKcal: number;
    postKcal: number;
    preChoG: number;
    intraChoG: number;
    postChoG: number;
    evidenceMinChoGPerHour: number;
    evidenceTargetChoGPerHour: number;
    evidenceMaxChoGPerHour: number;
    energyDrivenChoGPerHour: number;
    adjustedChoGPerHour: number;
  };
  /** Snapshot of cross-layer dials applied to this model (bioenergetics + adaptation + loop + diario reale). */
  performanceIntegration?: {
    trainingEnergyScale: number;
    mealTrainingFraction: number;
    fuelingChoScale: number;
    proteinBiasPctPoints: number;
    hydrationFloorMultiplier: number;
    sessionFluidMultiplier: number;
    rationale: string[];
    diaryInsight?: {
      windowDays: number;
      loggedDays: number;
      avgDailyKcal: number | null;
      energyAdequacyRatio: number | null;
      proteinGPerKg: number | null;
      carbsGPerKg: number | null;
      estimatedMaintenanceKcal: number | null;
      confidence: string;
    } | null;
  };
  notes: string[];
};

export type Meal = {
  id?: string;
  date: IsoDate;
  time?: string; // local time
  type: "breakfast" | "lunch" | "dinner" | "snack" | "pre_workout" | "intra_workout" | "post_workout" | "recovery";
  /** Macro target (g) */
  carbsG?: number;
  proteinG?: number;
  fatG?: number;
  kcal?: number;
  /** Alimenti suggeriti (o IDs da USDA/knowledge) */
  foods?: MealFood[];
  /** Note (es. timing rispetto a workout) */
  notes?: string;
};

export type MealFood = {
  name: string;
  amountG?: number;
  amountUnit?: string;
  carbsG?: number;
  proteinG?: number;
  fatG?: number;
  externalId?: string; // e.g. USDA FDC ID
};

export type NutritionPlan = {
  id: string;
  athleteId: string;
  /** Intervallo validità */
  fromDate: IsoDate;
  toDate?: IsoDate;
  meals: Meal[];
  /** Obiettivo (es. supporto adattamento, fueling lungo) */
  goal?: string;
  /** Vincoli applicati (snapshot) */
  constraintsSnapshot?: NutritionConstraints;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
};

export type FuelingPlan = {
  athleteId: string;
  workoutId: string;
  /** Pre / intra / post in funzione di carico e pathway */
  preWorkout?: Meal;
  intraWorkout?: Meal;
  postWorkout?: Meal;
  /** Regole usate (es. TSS > 100 → carbs intra X g/h) */
  rulesApplied?: string[];
  updatedAt?: IsoDateTime;
};
