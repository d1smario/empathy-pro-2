/**
 * Allowlist enum tassonomia V2 — single source per prompt AI + sanitize output.
 */

import type {
  FdcAminoProfileTag,
  FdcDietExcludeTag,
  FdcDietProfileTag,
  FdcFoodFamilyTag,
  FdcMacroDominantTag,
  FdcMealCourseTag,
  FdcMealRoleTag,
  FdcNutrientDensityTag,
  FdcSlotFitTag,
} from "@empathy/contracts";

export const ALLOWED_MEAL_COURSE: readonly FdcMealCourseTag[] = [
  "primo_carb",
  "secondo_protein",
  "contorno_veg",
  "frutta",
  "dolce",
  "snack",
  "bevanda",
  "latticino",
  "legume",
  "condimento",
  "composite_dish",
  "preparato_polvere",
  "energetico_sport",
] as const;

export const ALLOWED_FOOD_FAMILY: readonly FdcFoodFamilyTag[] = [
  "cereale",
  "pasta_riso",
  "pane",
  "verdura",
  "frutta",
  "legume",
  "pesce",
  "carne",
  "uova",
  "latticino",
  "oleaginoso",
  "olio",
  "bevanda_vegetale",
  "tuberi",
] as const;

export const ALLOWED_MACRO_DOMINANT: readonly FdcMacroDominantTag[] = [
  "cho_complex",
  "cho_simple",
  "protein_dense",
  "fat_dense",
  "fiber_dense",
  "mixed",
] as const;

export const ALLOWED_SLOT_FIT: readonly FdcSlotFitTag[] = [
  "breakfast",
  "snack",
  "main_meal",
  "fueling",
  "evening",
] as const;

export const ALLOWED_DIET_PROFILE: readonly FdcDietProfileTag[] = [
  "mediterranean",
  "vegetarian",
  "vegan",
  "pescatarian",
  "thai",
  "carnivore",
  "paleo",
  "celiac",
  "lactose_free",
  "low_histamine",
  "omnivore",
] as const;

export const ALLOWED_DIET_EXCLUDE: readonly FdcDietExcludeTag[] = [
  "gluten",
  "lactose",
  "animal",
  "grain",
  "legume",
  "high_histamine",
  "nightshade",
] as const;

export const ALLOWED_MEAL_ROLE: readonly FdcMealRoleTag[] = [
  "primo",
  "secondo",
  "contorno",
  "dolce",
  "bevanda",
  "snack",
] as const;

export const ALLOWED_AMINO_PROFILE: readonly FdcAminoProfileTag[] = [
  "histamine_rich",
  "histamine_low",
  "glutamine_rich",
  "leucine_rich",
  "bcaa_rich",
  "tryptophan_rich",
  "taurine_rich",
  "collagen_rich",
] as const;

export const ALLOWED_NUTRIENT_DENSITY: readonly FdcNutrientDensityTag[] = [
  "folate_dense",
  "iron_dense",
  "b12_dense",
  "zinc_dense",
  "magnesium_dense",
  "vit_c_dense",
  "omega3_dense",
  "potassium_dense",
] as const;

export function sanitizeTagArray<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(allowed);
  return [...new Set(raw.map((v) => String(v).trim()).filter((v): v is T => set.has(v as T)))];
}

export function taxonomyAllowlistsForPrompt(): string {
  return JSON.stringify(
    {
      meal_course: ALLOWED_MEAL_COURSE,
      food_family: ALLOWED_FOOD_FAMILY,
      macro_dominant: ALLOWED_MACRO_DOMINANT,
      slot_fit: ALLOWED_SLOT_FIT,
      diet_profile: ALLOWED_DIET_PROFILE,
      diet_exclude: ALLOWED_DIET_EXCLUDE,
      meal_role: ALLOWED_MEAL_ROLE,
      amino_profile: ALLOWED_AMINO_PROFILE,
      nutrient_density: ALLOWED_NUTRIENT_DENSITY,
    },
    null,
    0,
  );
}
