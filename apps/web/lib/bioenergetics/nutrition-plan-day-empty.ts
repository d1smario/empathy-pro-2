import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

/** Shared shape for bioenergetics day nutrition plan (no Supabase imports). */
export type BioPlannedMealRow = {
  slot: MealSlotKey;
  entry_time: string;
  food_label: string;
  carbs_g: number;
  protein_g: number;
  fat_g: number;
  kcal: number;
  insulin_load: number;
  glycemic_load: number;
};

export type NutritionPlanDayContext = {
  planSource: "nutrition_plans" | "calendar_training_solver" | "none";
  dailyCarbsG: number;
  dailyKcal: number;
  plannedMeals: BioPlannedMealRow[];
};

export const EMPTY_NUTRITION_PLAN_DAY: NutritionPlanDayContext = {
  planSource: "none",
  dailyCarbsG: 0,
  dailyKcal: 0,
  plannedMeals: [],
};
