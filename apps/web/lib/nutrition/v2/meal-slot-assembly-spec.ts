/**
 * Assemblaggio deterministico pasto: target macro da Diet → 1 alimento per ruolo → solver grammi.
 * L’interpretazione intelligente (pathway, integrazioni) resta a valle — non compone il pasto base.
 */

import type { MealFoodRole } from "@/lib/nutrition/meal-composition-rules";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

export type AssemblyLever = "cho" | "protein" | "fat" | "fixed";

export type MealSlotAssemblyRole = {
  foodRole: MealFoodRole;
  lever: AssemblyLever;
  poolKey: string;
  minG: number;
  maxG: number;
  stepG: number;
  /** Porzione fissa (verdura contorno; non mossa dal solver). */
  fixedG?: number;
};

/** Schema pasto per slot — allineato a meal-composition-rules + composer mediterraneo V1. */
export const MEAL_SLOT_ASSEMBLY: Record<MealSlotKey, MealSlotAssemblyRole[]> = {
  breakfast: [
    {
      foodRole: "cho_complex",
      lever: "cho",
      poolKey: "breakfast_cho",
      minG: 30,
      maxG: 200,
      stepG: 5,
    },
    {
      foodRole: "protein_primary",
      lever: "protein",
      poolKey: "breakfast_pro",
      minG: 80,
      maxG: 350,
      stepG: 10,
    },
    {
      foodRole: "fat",
      lever: "fat",
      poolKey: "breakfast_fat",
      minG: 5,
      maxG: 45,
      stepG: 2,
    },
  ],
  snack_am: [
    { foodRole: "cho_simple", lever: "cho", poolKey: "snack_cho", minG: 25, maxG: 180, stepG: 5 },
    { foodRole: "protein_secondary", lever: "protein", poolKey: "snack_pro", minG: 40, maxG: 200, stepG: 10 },
  ],
  lunch: [
    { foodRole: "cho_complex", lever: "cho", poolKey: "lunch_carb", minG: 45, maxG: 400, stepG: 5 },
    { foodRole: "protein_primary", lever: "protein", poolKey: "lunch_pro", minG: 80, maxG: 320, stepG: 5 },
    {
      foodRole: "veg_condiment",
      lever: "fixed",
      poolKey: "lunch_veg",
      minG: 80,
      maxG: 220,
      stepG: 10,
      fixedG: 120,
    },
  ],
  snack_pm: [
    { foodRole: "cho_simple", lever: "cho", poolKey: "snack_cho", minG: 25, maxG: 180, stepG: 5 },
    { foodRole: "protein_secondary", lever: "protein", poolKey: "snack_pro", minG: 40, maxG: 200, stepG: 10 },
  ],
  dinner: [
    { foodRole: "cho_complex", lever: "cho", poolKey: "dinner_carb", minG: 45, maxG: 400, stepG: 5 },
    { foodRole: "protein_primary", lever: "protein", poolKey: "dinner_pro", minG: 80, maxG: 320, stepG: 5 },
    {
      foodRole: "veg_condiment",
      lever: "fixed",
      poolKey: "dinner_veg",
      minG: 80,
      maxG: 220,
      stepG: 10,
      fixedG: 120,
    },
  ],
  snack_evening: [
    { foodRole: "cho_simple", lever: "cho", poolKey: "snack_cho", minG: 20, maxG: 150, stepG: 5 },
    { foodRole: "protein_secondary", lever: "protein", poolKey: "snack_pro", minG: 40, maxG: 180, stepG: 10 },
  ],
};

export type SlotMacroTargets = {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

/** Target pasto = budget Diet (unica fonte % pasti). */
export function slotMacroTargetsFromDiet(slot: {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}): SlotMacroTargets {
  return {
    kcal: slot.kcal,
    carbsG: slot.carbs,
    proteinG: slot.protein,
    fatG: slot.fat,
  };
}
