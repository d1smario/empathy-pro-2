/**
 * Classificatore rule-based USDA description → tassonomia V2 (MVP, no LLM).
 * Usato on-the-fly quando nutrition_fdc_food_tags non è ancora popolata.
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
import { CLASSIFIER_VERSION } from "@/lib/nutrition/v2/fdc-food-taxonomy";

type MacroRow = {
  kcalPer100g: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
};

function has(re: RegExp, text: string): boolean {
  return re.test(text);
}

function inferMacroDominant(row: MacroRow): FdcMacroDominantTag[] {
  const kcal = Math.max(1, row.kcalPer100g);
  const p = (row.proteinG * 4) / kcal;
  const c = (row.carbsG * 4) / kcal;
  const f = (row.fatG * 9) / kcal;
  const fib = row.fiberG ?? 0;
  if (fib >= 4 && c < 0.45) return ["fiber_dense"];
  if (p >= 0.28) return ["protein_dense"];
  if (f >= 0.45) return ["fat_dense"];
  if (c >= 0.55 && row.carbsG >= 15) return row.carbsG >= 40 ? ["cho_complex"] : ["cho_simple"];
  return ["mixed"];
}

function inferFoodFamily(desc: string): FdcFoodFamilyTag[] {
  const d = desc.toLowerCase();
  const out: FdcFoodFamilyTag[] = [];
  if (has(/\b(pasta|spaghetti|rice\b|riso|quinoa|farro|barley|bulgur|couscous|macaroni)\b/i, d)) out.push("pasta_riso");
  if (has(/\b(bread|pane|toast|cracker|bagel|roll)\b/i, d)) out.push("pane", "cereale");
  if (has(/\b(oat|cereal|muesli|granola|corn flakes|bran flakes|wheat, cream|grits)\b/i, d)) out.push("cereale");
  if (has(/\b(chicken|pollo|turkey|beef|pork|lamb|meat|bresaola)\b/i, d)) out.push("carne");
  if (has(/\b(fish|salmon|tuna|cod|sardine|pesce|sgombro)\b/i, d)) out.push("pesce");
  if (has(/\b(egg|uova)\b/i, d)) out.push("uova");
  if (has(/\b(milk|yogurt|cheese|ricotta|mozzarella|latte|formaggio)\b/i, d)) out.push("latticino");
  if (has(/\b(lentil|chickpea|bean|legume|ceci|lenticch|fagiol)\b/i, d)) out.push("legume");
  if (has(/\b(spinach|broccoli|pepper|tomato|lettuce|kale|carrot|vegetable|verdur)\b/i, d)) out.push("verdura");
  if (has(/\b(apple|banana|orange|berry|fruit|kiwi|mela|frutta)\b/i, d)) out.push("frutta");
  if (has(/\b(almond|walnut|seed|nut|mandorl|semi)\b/i, d)) out.push("oleaginoso");
  if (has(/\b(oil|olive|olio)\b/i, d)) out.push("olio");
  if (has(/\b(potato|patat|sweet potato)\b/i, d)) out.push("tuberi");
  if (has(/\b(almond milk|soy milk|oat milk|rice milk|beverage)\b/i, d)) out.push("bevanda_vegetale");
  return [...new Set(out)];
}

function inferMealCourse(desc: string, families: FdcFoodFamilyTag[]): FdcMealCourseTag[] {
  const d = desc.toLowerCase();
  const out: FdcMealCourseTag[] = [];
  if (families.includes("pasta_riso") || families.includes("pane")) out.push("primo_carb");
  if (families.includes("carne") || families.includes("pesce") || families.includes("uova") || families.includes("legume"))
    out.push("secondo_protein");
  if (families.includes("verdura")) out.push("contorno_veg");
  if (families.includes("frutta")) out.push("frutta");
  if (has(/\b(cookie|cake|chocolate|biscuit|dolce|dessert|granola bar)\b/i, d)) out.push("dolce", "snack");
  if (has(/\b(milk|juice|beverage|drink|coffee|tea|latte)\b/i, d)) out.push("bevanda");
  if (families.includes("latticino")) out.push("latticino");
  if (families.includes("legume")) out.push("legume");
  if (has(/\b(sauce|dressing|vinegar|condiment)\b/i, d)) out.push("condimento");
  if (has(/\b(pizza|lasagna|casserole|stew)\b/i, d)) out.push("composite_dish");
  if (has(/\b(powder|whey|protein powder)\b/i, d)) out.push("preparato_polvere");
  if (has(/\b(sport|energy gel|isotonic)\b/i, d)) out.push("energetico_sport");
  return [...new Set(out)];
}

function inferSlotFit(courses: FdcMealCourseTag[], families: FdcFoodFamilyTag[], desc: string): FdcSlotFitTag[] {
  const d = desc.toLowerCase();
  const out: FdcSlotFitTag[] = [];
  const breakfastOnlyCarb =
    families.includes("cereale") &&
    !families.includes("pasta_riso") &&
    has(/\b(oat|cereal|muesli|granola|corn flakes|bran|wheat, cream|grits)\b/i, d);
  const junkSnack = has(/\b(chip|crisp|french fries|pretzel|popcorn|cookie|donut|doughnut|ice cream|candy|snack bar)\b/i, d);

  if (courses.includes("frutta") || courses.includes("bevanda") || courses.includes("preparato_polvere"))
    out.push("breakfast", "snack");
  if (
    (courses.includes("primo_carb") || courses.includes("secondo_protein") || courses.includes("contorno_veg")) &&
    !breakfastOnlyCarb &&
    !junkSnack
  ) {
    out.push("main_meal");
  }
  if (courses.includes("energetico_sport")) out.push("fueling");
  if (courses.includes("dolce") || families.includes("latticino") || breakfastOnlyCarb) out.push("evening", "snack", "breakfast");
  if (out.length === 0 && !junkSnack) out.push("main_meal");
  return [...new Set(out)];
}

function inferDietExclude(desc: string, families: FdcFoodFamilyTag[]): FdcDietExcludeTag[] {
  const d = desc.toLowerCase();
  const out: FdcDietExcludeTag[] = [];
  if (families.includes("carne") || families.includes("pesce") || families.includes("uova") || families.includes("latticino")) {
    out.push("animal");
  }
  if (families.includes("latticino")) out.push("lactose");
  if (
    families.includes("pane") ||
    families.includes("pasta_riso") ||
    families.includes("cereale") ||
    has(/\b(wheat|gluten|barley|rye|spelt|farro|malt|bread|pasta)\b/i, d)
  ) {
    out.push("gluten", "grain");
  }
  if (families.includes("legume")) out.push("legume");
  if (has(/\b(tomato|eggplant|pepper|potato|nightshade)\b/i, d)) out.push("nightshade");
  if (has(/\b(aged cheese|wine|ferment|tuna|canned|salami|vinegar|sauerkraut|soy sauce)\b/i, d)) {
    out.push("high_histamine");
  }
  return [...new Set(out)];
}

function inferMealRole(courses: FdcMealCourseTag[]): FdcMealRoleTag[] {
  const out: FdcMealRoleTag[] = [];
  if (courses.includes("primo_carb")) out.push("primo");
  if (courses.includes("secondo_protein")) out.push("secondo");
  if (courses.includes("contorno_veg")) out.push("contorno");
  if (courses.includes("dolce")) out.push("dolce");
  if (courses.includes("bevanda")) out.push("bevanda");
  if (courses.includes("snack") || courses.includes("frutta")) out.push("snack");
  return [...new Set(out)];
}

function inferDietProfile(desc: string, families: FdcFoodFamilyTag[], exclude: FdcDietExcludeTag[]): FdcDietProfileTag[] {
  const d = desc.toLowerCase();
  const out: FdcDietProfileTag[] = ["omnivore"];

  const isMeat = families.includes("carne");
  const isFish = families.includes("pesce");
  const isDairy = families.includes("latticino");
  const isEgg = families.includes("uova");
  const isLegume = families.includes("legume");
  const isGrain = families.includes("cereale") || families.includes("pasta_riso") || families.includes("pane");
  const hasAnimal = exclude.includes("animal");

  if (!hasAnimal && !has(/\b(honey|gelatin|whey|casein)\b/i, d)) out.push("vegan", "vegetarian", "lactose_free");
  else if (!isMeat && !isFish) out.push("vegetarian");
  if (!isMeat && isFish) out.push("pescatarian");
  if (!isGrain && !exclude.includes("gluten")) out.push("celiac");
  if (!isDairy) out.push("lactose_free");
  if (!exclude.includes("high_histamine")) out.push("low_histamine");
  if (isMeat && !isGrain && !isLegume) out.push("carnivore", "paleo");
  if (
    !isMeat &&
    (isFish ||
      isLegume ||
      isGrain ||
      families.includes("pasta_riso") ||
      families.includes("verdura") ||
      families.includes("olio"))
  ) {
    out.push("mediterranean");
  }
  if (has(/\b(coconut milk|lemongrass|basil|thai|curry paste|fish sauce|rice noodle)\b/i, d)) out.push("thai");

  return [...new Set(out)];
}

function inferAminoProfile(desc: string, row: MacroRow): FdcAminoProfileTag[] {
  const d = desc.toLowerCase();
  const out: FdcAminoProfileTag[] = [];
  if (has(/\b(aged cheese|wine|ferment|tuna|canned|salami|sardine|mackerel|soy sauce|vinegar|sauerkraut|tomato)\b/i, d))
    out.push("histamine_rich");
  else out.push("histamine_low");

  if (has(/\b(whey|casein|beef|chicken|fish|egg|tofu|yogurt)\b/i, d) && row.proteinG >= 15) {
    out.push("leucine_rich", "bcaa_rich");
  }
  if (has(/\b(bone broth|gelatin|collagen)\b/i, d)) out.push("collagen_rich", "glutamine_rich");
  if (has(/\b(cottage|ricotta|turkey|banana)\b/i, d)) out.push("tryptophan_rich");
  if (has(/\b(seafood|shellfish|heart|liver)\b/i, d)) out.push("taurine_rich");
  if (row.proteinG >= 8 && has(/\b(meat|fish|legume|dairy|egg)\b/i, d)) out.push("glutamine_rich");

  return [...new Set(out)];
}

function inferNutrientDensity(desc: string, row: MacroRow): FdcNutrientDensityTag[] {
  const d = desc.toLowerCase();
  const out: FdcNutrientDensityTag[] = [];
  if (has(/\b(spinach|lentil|asparagus|leafy|legume)\b/i, d)) out.push("folate_dense", "iron_dense");
  if (has(/\b(liver|beef|lentil|spinach)\b/i, d)) out.push("iron_dense");
  if (has(/\b(egg|fish|liver|milk|cheese)\b/i, d)) out.push("b12_dense");
  if (has(/\b(oyster|pumpkin seed|beef|chickpea)\b/i, d)) out.push("zinc_dense");
  if (has(/\b(almond|spinach|pumpkin|dark chocolate)\b/i, d)) out.push("magnesium_dense");
  if (has(/\b(pepper|citrus|kiwi|strawber|broccoli)\b/i, d)) out.push("vit_c_dense");
  if (has(/\b(salmon|sardine|mackerel|fish oil)\b/i, d)) out.push("omega3_dense");
  if (has(/\b(banana|potato|bean)\b/i, d) && row.carbsG >= 15) out.push("potassium_dense");
  return [...new Set(out)];
}

export function classifyFdcFoodRow(input: {
  description: string;
  kcalPer100g: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
}): FdcFoodTaxonomy {
  const desc = input.description.trim();
  const macroRow: MacroRow = input;
  const foodFamily = inferFoodFamily(desc);
  const mealCourse = inferMealCourse(desc, foodFamily);
  const macroDominant = inferMacroDominant(macroRow);
  const slotFit = inferSlotFit(mealCourse, foodFamily, desc);
  const dietExclude = inferDietExclude(desc, foodFamily);
  const dietProfile = inferDietProfile(desc, foodFamily, dietExclude);
  const mealRole = inferMealRole(mealCourse);
  const aminoProfile = inferAminoProfile(desc, macroRow);
  const nutrientDensity = inferNutrientDensity(desc, macroRow);

  return {
    mealCourse,
    foodFamily,
    macroDominant,
    slotFit,
    dietProfile,
    dietExclude,
    mealRole,
    aminoProfile,
    nutrientDensity,
    classifierVersion: CLASSIFIER_VERSION,
  };
}

/** Verifica se un alimento è ammesso per il profilo dieta attivo. */
export function dietExcludeForActiveProfile(active: FdcDietProfileTag): FdcDietExcludeTag[] {
  switch (active) {
    case "celiac":
      return ["gluten"];
    case "lactose_free":
      return ["lactose"];
    case "vegan":
      return ["animal"];
    case "vegetarian":
      return [];
    case "paleo":
      return ["grain", "legume"];
    case "low_histamine":
      return ["high_histamine"];
    default:
      return [];
  }
}

export function foodMatchesDietProfile(taxonomy: FdcFoodTaxonomy, active: FdcDietProfileTag): boolean {
  const mustExclude = dietExcludeForActiveProfile(active);
  if (mustExclude.some((t) => taxonomy.dietExclude.includes(t))) return false;

  if (active === "omnivore") return true;
  if (taxonomy.dietProfile.includes(active)) return true;
  if (active === "vegetarian" && taxonomy.dietProfile.includes("vegan")) return true;
  if (active === "pescatarian") {
    if (taxonomy.foodFamily.includes("carne")) return false;
    return taxonomy.dietProfile.includes("pescatarian") || taxonomy.dietProfile.includes("vegetarian") || taxonomy.dietProfile.includes("vegan");
  }
  if (active === "mediterranean") return taxonomy.dietProfile.includes("mediterranean") || taxonomy.dietProfile.includes("omnivore");
  if (active === "celiac") return !taxonomy.dietExclude.includes("gluten");
  if (active === "vegan") return taxonomy.dietProfile.includes("vegan") && !taxonomy.dietExclude.includes("animal");
  if (active === "vegetarian") {
    if (taxonomy.foodFamily.includes("carne") || taxonomy.foodFamily.includes("pesce")) return false;
    return taxonomy.dietProfile.includes("vegetarian") || taxonomy.dietProfile.includes("vegan");
  }
  return false;
}

export function taxonomyMatchesFilter(
  taxonomy: FdcFoodTaxonomy,
  filter: {
    dietProfile: FdcDietProfileTag;
    slotFit?: FdcSlotFitTag;
    mealCourse?: FdcMealCourseTag;
    mealRole?: FdcMealRoleTag;
    macroDominant?: FdcMacroDominantTag;
    foodFamily?: FdcFoodFamilyTag;
    aminoProfile?: FdcAminoProfileTag;
    nutrientDensity?: FdcNutrientDensityTag;
    requireDietExcludeAbsent?: FdcDietExcludeTag[];
    excludeAminoProfile?: FdcAminoProfileTag[];
  },
): boolean {
  if (!foodMatchesDietProfile(taxonomy, filter.dietProfile)) return false;
  if (filter.slotFit && !taxonomy.slotFit.includes(filter.slotFit)) return false;
  if (filter.mealCourse && !taxonomy.mealCourse.includes(filter.mealCourse)) return false;
  if (filter.mealRole && !taxonomy.mealRole.includes(filter.mealRole)) return false;
  if (filter.macroDominant && !taxonomy.macroDominant.includes(filter.macroDominant)) return false;
  if (filter.foodFamily && !taxonomy.foodFamily.includes(filter.foodFamily)) return false;
  if (filter.nutrientDensity && !taxonomy.nutrientDensity.includes(filter.nutrientDensity)) return false;
  if (filter.aminoProfile && !taxonomy.aminoProfile.includes(filter.aminoProfile)) return false;
  const absent = filter.requireDietExcludeAbsent ?? dietExcludeForActiveProfile(filter.dietProfile);
  if (absent.some((t) => taxonomy.dietExclude.includes(t))) return false;
  if (filter.excludeAminoProfile?.some((t) => taxonomy.aminoProfile.includes(t))) return false;
  if (filter.dietProfile === "low_histamine" && taxonomy.aminoProfile.includes("histamine_rich")) return false;
  return true;
}

export function taxonomyToDbArrays(t: FdcFoodTaxonomy) {
  return {
    meal_course: t.mealCourse,
    food_family: t.foodFamily,
    macro_dominant: t.macroDominant,
    slot_fit: t.slotFit,
    diet_profile: t.dietProfile,
    diet_exclude: t.dietExclude,
    meal_role: t.mealRole,
    amino_profile: t.aminoProfile,
    nutrient_density: t.nutrientDensity,
    classifier_version: t.classifierVersion,
  };
}
