import type { FdcFoodBrowseFilter } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

export type FdcPoolSpec = {
  poolKey: string;
  labelIt: string;
  filter: FdcFoodBrowseFilter;
};

export const FDC_BRANCH_POOL_SPECS: FdcPoolSpec[] = [
  { poolKey: "breakfast", labelIt: "Colazione — carb", filter: { dietProfile: "omnivore", slotFit: "breakfast", mealCourse: "primo_carb", limit: 20 } },
  { poolKey: "breakfast_pro", labelIt: "Colazione — proteina", filter: { dietProfile: "omnivore", slotFit: "breakfast", macroDominant: "protein_dense", limit: 16 } },
  { poolKey: "breakfast_fruit", labelIt: "Colazione — frutta", filter: { dietProfile: "omnivore", slotFit: "breakfast", mealCourse: "frutta", limit: 16 } },
  { poolKey: "lunch_carb", labelIt: "Pranzo — carb", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "primo_carb", limit: 20 } },
  { poolKey: "lunch_pro", labelIt: "Pranzo — proteina", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "secondo_protein", limit: 20 } },
  { poolKey: "lunch_veg", labelIt: "Pranzo — verdura", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "contorno_veg", limit: 16 } },
  { poolKey: "dinner_carb", labelIt: "Cena — carb", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "primo_carb", limit: 20 } },
  { poolKey: "dinner_pro", labelIt: "Cena — proteina", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "secondo_protein", limit: 20 } },
  { poolKey: "dinner_veg", labelIt: "Cena — verdura", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "contorno_veg", limit: 16 } },
  { poolKey: "snack", labelIt: "Spuntino", filter: { dietProfile: "omnivore", slotFit: "snack", limit: 16 } },
  { poolKey: "fueling", labelIt: "Fueling sport", filter: { dietProfile: "omnivore", slotFit: "fueling", mealCourse: "energetico_sport", limit: 12 } },
];

export type SlotBranchSpec = {
  poolKey: string;
  kcalShare: number;
  macroRole: "cho_heavy" | "protein" | "veg" | "mixed";
  sort: "cho" | "pro" | "veg" | "kcal_low";
};

export const V2_SLOT_BRANCHES: Record<MealSlotKey, SlotBranchSpec[]> = {
  breakfast: [
    { poolKey: "breakfast", kcalShare: 0.42, macroRole: "cho_heavy", sort: "cho" },
    { poolKey: "breakfast_pro", kcalShare: 0.28, macroRole: "protein", sort: "pro" },
    { poolKey: "breakfast_fruit", kcalShare: 0.18, macroRole: "mixed", sort: "kcal_low" },
  ],
  snack_am: [{ poolKey: "snack", kcalShare: 1, macroRole: "mixed", sort: "kcal_low" }],
  lunch: [
    { poolKey: "lunch_carb", kcalShare: 0.4, macroRole: "cho_heavy", sort: "cho" },
    { poolKey: "lunch_pro", kcalShare: 0.35, macroRole: "protein", sort: "pro" },
    { poolKey: "lunch_veg", kcalShare: 0.15, macroRole: "veg", sort: "veg" },
  ],
  snack_pm: [{ poolKey: "snack", kcalShare: 1, macroRole: "mixed", sort: "kcal_low" }],
  dinner: [
    { poolKey: "dinner_carb", kcalShare: 0.38, macroRole: "cho_heavy", sort: "cho" },
    { poolKey: "dinner_pro", kcalShare: 0.37, macroRole: "protein", sort: "pro" },
    { poolKey: "dinner_veg", kcalShare: 0.15, macroRole: "veg", sort: "veg" },
  ],
  snack_evening: [{ poolKey: "snack", kcalShare: 1, macroRole: "mixed", sort: "kcal_low" }],
};
