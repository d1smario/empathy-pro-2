import type { FdcFoodBrowseFilter } from "@/lib/nutrition/v2/fdc-food-taxonomy";

export type FdcPoolSpec = {
  poolKey: string;
  labelIt: string;
  filter: FdcFoodBrowseFilter;
};

/** Pool USDA taggati per ruolo alimentare (assemblaggio → meal-slot-assembly-spec). */
export const FDC_BRANCH_POOL_SPECS: FdcPoolSpec[] = [
  {
    poolKey: "breakfast_cho",
    labelIt: "Colazione — carboidrato complesso",
    filter: { dietProfile: "omnivore", slotFit: "breakfast", macroDominant: "cho_complex", limit: 24 },
  },
  {
    poolKey: "breakfast_pro",
    labelIt: "Colazione — proteina",
    filter: { dietProfile: "omnivore", slotFit: "breakfast", macroDominant: "protein_dense", limit: 20 },
  },
  {
    poolKey: "breakfast_fat",
    labelIt: "Colazione — grasso",
    filter: { dietProfile: "omnivore", slotFit: "breakfast", macroDominant: "fat_dense", limit: 16 },
  },
  { poolKey: "lunch_carb", labelIt: "Pranzo — primo (carb)", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "primo_carb", limit: 24 } },
  { poolKey: "lunch_pro", labelIt: "Pranzo — secondo (proteina)", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "secondo_protein", limit: 24 } },
  { poolKey: "lunch_veg", labelIt: "Pranzo — contorno verdura", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "contorno_veg", limit: 20 } },
  { poolKey: "dinner_carb", labelIt: "Cena — primo (carb)", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "primo_carb", limit: 24 } },
  { poolKey: "dinner_pro", labelIt: "Cena — secondo (proteina)", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "secondo_protein", limit: 24 } },
  { poolKey: "dinner_veg", labelIt: "Cena — contorno verdura", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "contorno_veg", limit: 20 } },
  {
    poolKey: "snack_cho",
    labelIt: "Spuntino — carb (frutta / CHO leggero)",
    filter: { dietProfile: "omnivore", slotFit: "snack", macroDominant: "cho_simple", limit: 20 },
  },
  {
    poolKey: "snack_pro",
    labelIt: "Spuntino — proteina",
    filter: { dietProfile: "omnivore", slotFit: "snack", macroDominant: "protein_dense", limit: 16 },
  },
  { poolKey: "fueling", labelIt: "Fueling sport", filter: { dietProfile: "omnivore", slotFit: "fueling", mealCourse: "energetico_sport", limit: 12 } },
];
