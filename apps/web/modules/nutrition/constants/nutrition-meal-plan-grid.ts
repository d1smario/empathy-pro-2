import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

export type MealPlanUiGridKey = MealSlotKey | "pre_sleep";

/** Griglia visiva 3×2: colazione, spuntino, pranzo / merenda, cena, pre-sonno (placeholder). */
export const NUTRITION_MEAL_GRID: { key: MealPlanUiGridKey; labelIt: string }[] = [
  { key: "breakfast", labelIt: "Colazione" },
  { key: "snack_am", labelIt: "Spuntino" },
  { key: "lunch", labelIt: "Pranzo" },
  { key: "snack_pm", labelIt: "Merenda" },
  { key: "dinner", labelIt: "Cena" },
  { key: "pre_sleep", labelIt: "Pre-sonno" },
];
