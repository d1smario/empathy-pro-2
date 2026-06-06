/**
 * Tassonomia USDA Empathy V2 — 4 assi + profili aminoacidi e densità micronutrienti.
 */

import type {
  FdcAminoProfileTag,
  FdcDietExcludeTag,
  FdcDietProfileTag,
  FdcFoodFamilyTag,
  FdcFoodTaxonomy,
  FdcMacroDominantTag,
  FdcMealCourseTag,
  FdcMealRoleTag,
  FdcNutrientDensityTag,
  FdcSlotFitTag,
} from "@empathy/contracts";

export const CLASSIFIER_VERSION = "empathy_v2_rules_v1";

export const ALL_DIET_PROFILE_TAGS: readonly FdcDietProfileTag[] = [
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

export const ALL_AMINO_PROFILE_TAGS: readonly FdcAminoProfileTag[] = [
  "histamine_rich",
  "histamine_low",
  "glutamine_rich",
  "leucine_rich",
  "bcaa_rich",
  "tryptophan_rich",
  "taurine_rich",
  "collagen_rich",
] as const;

/** Mappa diet_type profilo atleta → tag filtro V2. */
export function dietProfileFromAthleteDietType(raw: string | null | undefined): FdcDietProfileTag {
  const d = (raw ?? "").trim().toLowerCase();
  if (!d || d === "omnivore" || d === "other") return "omnivore";
  if (d.includes("vegan")) return "vegan";
  if (d.includes("veget")) return "vegetarian";
  if (d.includes("pesc")) return "pescatarian";
  if (d.includes("carniv")) return "carnivore";
  if (d.includes("paleo")) return "paleo";
  if (d.includes("mediterr")) return "mediterranean";
  if (d.includes("thai")) return "thai";
  if (d.includes("celiac") || d.includes("gluten")) return "celiac";
  if (d.includes("lactose") || d.includes("lattosio")) return "lactose_free";
  if (d.includes("histamin")) return "low_histamine";
  return "mediterranean";
}

export function mergeTaxonomyArrays<T extends string>(...lists: readonly T[][]): T[] {
  return [...new Set(lists.flat())];
}

export function emptyTaxonomy(): FdcFoodTaxonomy {
  return {
    mealCourse: [],
    foodFamily: [],
    macroDominant: [],
    slotFit: [],
    dietProfile: [],
    dietExclude: [],
    mealRole: [],
    aminoProfile: [],
    nutrientDensity: [],
    classifierVersion: CLASSIFIER_VERSION,
  };
}

export type FdcFoodBrowseFilter = {
  dietProfile: FdcDietProfileTag;
  slotFit?: FdcSlotFitTag;
  mealCourse?: FdcMealCourseTag;
  mealRole?: FdcMealRoleTag;
  macroDominant?: FdcMacroDominantTag;
  foodFamily?: FdcFoodFamilyTag;
  aminoProfile?: FdcAminoProfileTag;
  nutrientDensity?: FdcNutrientDensityTag;
  /** Escludi alimenti con questi tag diet_exclude (es. gluten per celiaco). */
  requireDietExcludeAbsent?: FdcDietExcludeTag[];
  excludeAminoProfile?: FdcAminoProfileTag[];
  limit?: number;
};

export function filterSummaryIt(filter: FdcFoodBrowseFilter): string {
  const parts = [`dieta:${filter.dietProfile}`];
  if (filter.slotFit) parts.push(`slot:${filter.slotFit}`);
  if (filter.mealCourse) parts.push(`corso:${filter.mealCourse}`);
  if (filter.macroDominant) parts.push(`macro:${filter.macroDominant}`);
  if (filter.aminoProfile) parts.push(`amino:${filter.aminoProfile}`);
  if (filter.excludeAminoProfile?.length) parts.push(`no:${filter.excludeAminoProfile.join(",")}`);
  return parts.join(" · ");
}
