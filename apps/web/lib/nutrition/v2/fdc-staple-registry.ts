/**
 * Registry staple sportivi — allowlist canonica per ruolo assembly V2.
 * Fonte primaria: CANONICAL_FOOD_TABLE + CANONICAL_FOOD_TO_FDC_ID (allineato V1 Mediterranean).
 */

import type { MealPlanV2ServingBasis } from "@empathy/contracts";
import {
  CANONICAL_FOOD_TABLE,
  type CanonicalFoodNutrients,
} from "@/lib/nutrition/canonical-food-composition";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";
import type { MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import { canUseCanonicalKey } from "@/lib/nutrition/meal-rotation-guard";
import type { MediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";

export type StapleRegistryEntry = {
  canonicalKey: string;
  labelIt: string;
  servingBasis: MealPlanV2ServingBasis;
  /** Chiave rotazione settimanale (es. carb:pasta). */
  rotationKey?: string;
  /** Famiglia carb — no duplicato pranzo+cena stesso giorno. */
  carbFamily?: string;
};

const LABEL_IT: Record<string, string> = {
  oat_dry: "Fiocchi d'avena",
  bread_white: "Pane integrale",
  pasta_dry: "Pasta di semola",
  rice_dry: "Riso",
  potato_cooked: "Patate",
  farro_dry: "Farro",
  quinoa_dry: "Quinoa",
  egg_whole: "Uova",
  yogurt_plain: "Yogurt greco",
  chicken_breast: "Petto di pollo",
  fish_white: "Salmone",
  beef_lean: "Manzo magro",
  legumes_cooked: "Legumi",
  tofu_firm: "Tofu",
  tempeh: "Tempeh",
  seitan: "Seitan",
  ricotta_cheese: "Ricotta",
  cottage_cheese: "Ricotta magra",
  milk_2pct: "Latte",
  milk_goat: "Latte di capra",
  olive_oil: "Olio EVO",
  almonds_raw: "Mandorle",
  avocado: "Avocado",
  spinach_raw: "Spinaci",
  broccoli_raw: "Broccoli",
  zucchini_raw: "Zucchine",
  mixed_veg: "Insalata mista",
  tomato_raw: "Pomodori",
  carrot_raw: "Carote",
  banana: "Banana",
  apple_raw: "Mela",
  orange_raw: "Arancia",
  blueberries_raw: "Mirtilli",
  mixed_fruit: "Frutta mista",
  cheese_hard: "Grana Padano",
};

function entry(
  canonicalKey: string,
  servingBasis: MealPlanV2ServingBasis,
  opts?: { rotationKey?: string; carbFamily?: string; labelIt?: string },
): StapleRegistryEntry {
  return {
    canonicalKey,
    labelIt: opts?.labelIt ?? LABEL_IT[canonicalKey] ?? canonicalKey.replace(/_/g, " "),
    servingBasis,
    rotationKey: opts?.rotationKey,
    carbFamily: opts?.carbFamily,
  };
}

/** Allowlist ordinata per poolKey — mirror CARB_ORDER / stapleProt V1. */
export const STAPLE_ALLOWLIST_BY_POOL: Record<string, StapleRegistryEntry[]> = {
  breakfast_cho: [
    entry("oat_dry", "dry_grams", { rotationKey: "breakfast:oat" }),
    entry("bread_white", "dry_grams", { rotationKey: "breakfast:bread" }),
    entry("crackers_whole", "dry_grams", { rotationKey: "breakfast:crackers" }),
  ],
  breakfast_pro: [
    entry("yogurt_plain", "dry_grams", { rotationKey: "breakfast:yogurt" }),
    entry("egg_whole", "dry_grams", { rotationKey: "breakfast:egg" }),
    entry("ricotta_cheese", "dry_grams"),
    entry("cottage_cheese", "dry_grams"),
  ],
  breakfast_fat: [
    entry("almonds_raw", "dry_grams"),
    entry("olive_oil", "ml"),
    entry("avocado", "dry_grams"),
  ],
  lunch_carb: [
    entry("pasta_dry", "dry_grams", { rotationKey: "carb:pasta", carbFamily: "carb_starch" }),
    entry("rice_dry", "dry_grams", { rotationKey: "carb:riso", carbFamily: "carb_starch" }),
    entry("potato_cooked", "cooked_grams", { rotationKey: "carb:patate", carbFamily: "carb_starch" }),
    entry("farro_dry", "dry_grams", { rotationKey: "carb:farro", carbFamily: "carb_starch" }),
    entry("quinoa_dry", "dry_grams", { rotationKey: "carb:quinoa", carbFamily: "carb_starch" }),
  ],
  dinner_carb: [
    entry("rice_dry", "dry_grams", { rotationKey: "carb:riso", carbFamily: "carb_starch" }),
    entry("pasta_dry", "dry_grams", { rotationKey: "carb:pasta", carbFamily: "carb_starch" }),
    entry("potato_cooked", "cooked_grams", { rotationKey: "carb:patate", carbFamily: "carb_starch" }),
    entry("farro_dry", "dry_grams", { rotationKey: "carb:farro", carbFamily: "carb_starch" }),
    entry("quinoa_dry", "dry_grams", { rotationKey: "carb:quinoa", carbFamily: "carb_starch" }),
  ],
  lunch_pro: [
    entry("chicken_breast", "dry_grams", { rotationKey: "prot:pollo" }),
    entry("fish_white", "dry_grams", { rotationKey: "prot:pesce" }),
    entry("beef_lean", "dry_grams", { rotationKey: "prot:manzo" }),
    entry("legumes_cooked", "cooked_grams", { rotationKey: "prot:legumi" }),
    entry("egg_whole", "dry_grams"),
    entry("tofu_firm", "dry_grams"),
  ],
  dinner_pro: [
    entry("fish_white", "dry_grams", { rotationKey: "prot:pesce" }),
    entry("chicken_breast", "dry_grams", { rotationKey: "prot:pollo" }),
    entry("beef_lean", "dry_grams", { rotationKey: "prot:manzo" }),
    entry("legumes_cooked", "cooked_grams", { rotationKey: "prot:legumi" }),
    entry("tofu_firm", "dry_grams"),
    entry("tempeh", "dry_grams"),
  ],
  lunch_veg: [
    entry("mixed_veg", "dry_grams"),
    entry("spinach_raw", "dry_grams"),
    entry("broccoli_raw", "dry_grams"),
    entry("zucchini_raw", "dry_grams"),
    entry("tomato_raw", "dry_grams"),
  ],
  dinner_veg: [
    entry("spinach_raw", "dry_grams"),
    entry("broccoli_raw", "dry_grams"),
    entry("zucchini_raw", "dry_grams"),
    entry("mixed_veg", "dry_grams"),
    entry("carrot_raw", "dry_grams"),
  ],
  snack_cho: [
    entry("banana", "dry_grams"),
    entry("apple_raw", "dry_grams"),
    entry("orange_raw", "dry_grams"),
    entry("blueberries_raw", "dry_grams"),
    entry("mixed_fruit", "dry_grams"),
  ],
  snack_pro: [
    entry("yogurt_plain", "dry_grams"),
    entry("cottage_cheese", "dry_grams"),
    entry("almonds_raw", "dry_grams"),
    entry("egg_whole", "dry_grams"),
  ],
};

function filterByDiet(entries: StapleRegistryEntry[], dietType?: MediterraneanDietType): StapleRegistryEntry[] {
  if (!dietType || dietType === "omnivore" || dietType === "pescatarian") {
    if (dietType === "pescatarian") {
      return entries.filter((e) => !["chicken_breast", "beef_lean"].includes(e.canonicalKey));
    }
    return entries;
  }
  if (dietType === "vegetarian") {
    return entries.filter((e) => !["chicken_breast", "beef_lean", "fish_white"].includes(e.canonicalKey));
  }
  if (dietType === "vegan") {
    return entries.filter(
      (e) =>
        !["chicken_breast", "beef_lean", "fish_white", "egg_whole", "yogurt_plain", "ricotta_cheese", "cottage_cheese", "cheese_hard", "milk_2pct", "milk_goat"].includes(
          e.canonicalKey,
        ),
    );
  }
  return entries;
}

function canonicalToHit(entry: StapleRegistryEntry): FdcFoodBrowseHit | null {
  const row: CanonicalFoodNutrients | undefined = CANONICAL_FOOD_TABLE[entry.canonicalKey];
  if (!row?.kcalPer100g) return null;
  const fdcId = fdcIdForCanonicalKey(entry.canonicalKey) ?? 0;
  if (
    !isPlausiblePer100gMacros({
      kcal_100: row.kcalPer100g,
      carbs_100: row.carbsG,
      protein_100: row.proteinG,
      fat_100: row.fatG,
    })
  ) {
    return null;
  }
  return {
    fdcId,
    description: entry.labelIt,
    kcalPer100g: row.kcalPer100g,
    proteinPer100g: row.proteinG,
    carbsPer100g: row.carbsG,
    fatPer100g: row.fatG,
    tags: {
      mealCourse: [],
      foodFamily: [],
      macroDominant: [],
      slotFit: [],
      dietProfile: ["omnivore"],
      dietExclude: [],
      mealRole: [],
      aminoProfile: [],
      nutrientDensity: [],
      classifierVersion: "staple_registry",
    },
    tagSource: "db",
  };
}

export type StaplePickContext = {
  poolKey: string;
  seed: number;
  dietType?: MediterraneanDietType;
  denyFragments?: string[];
  dayCtx?: Pick<MediterraneanDayContext, "weekStapleCounts" | "dayUsedCanonicalKeys">;
  usedCarbFamilies?: Set<string>;
  usedFdcIds?: Set<number>;
};

function denyHit(key: string, denyFragments: string[]): boolean {
  const d = key.toLowerCase();
  return denyFragments.some((f) => f && d.includes(f.toLowerCase()));
}

export function pickStapleForPool(ctx: StaplePickContext): { entry: StapleRegistryEntry; hit: FdcFoodBrowseHit } | null {
  const raw = STAPLE_ALLOWLIST_BY_POOL[ctx.poolKey] ?? [];
  const entries = filterByDiet(raw, ctx.dietType);
  const deny = ctx.denyFragments ?? [];

  const scored = entries
    .map((e, idx) => {
      if (denyHit(e.labelIt, deny) || denyHit(e.canonicalKey, deny)) return { e, score: -10_000, idx };
      if (ctx.dayCtx && !canUseCanonicalKey(ctx.dayCtx as MediterraneanDayContext, e.canonicalKey, { allowWeekException: true })) {
        return { e, score: -5000, idx };
      }
      if (e.carbFamily && ctx.usedCarbFamilies?.has(e.carbFamily)) return { e, score: -3000, idx };
      const hit = canonicalToHit(e);
      if (!hit) return { e, score: -8000, idx };
      if (ctx.usedFdcIds?.has(hit.fdcId) && hit.fdcId > 0) return { e, score: -4000, idx };
      let score = 1000 - idx * 10;
      if (e.rotationKey) {
        const weekUses = ctx.dayCtx?.weekStapleCounts?.[e.rotationKey] ?? 0;
        score -= weekUses * 80;
      }
      score += (ctx.seed + idx * 7) % 11;
      return { e, score, idx, hit };
    })
    .filter((x) => x.score > 0 && "hit" in x && x.hit)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || !("hit" in best) || !best.hit) return null;
  return { entry: best.e, hit: best.hit as FdcFoodBrowseHit };
}

export function stapleRegistryKeysForPool(poolKey: string): string[] {
  return (STAPLE_ALLOWLIST_BY_POOL[poolKey] ?? []).map((e) => e.canonicalKey);
}

export function labelItForStaple(canonicalKey: string): string {
  return LABEL_IT[canonicalKey] ?? canonicalKey.replace(/_/g, " ");
}

export function servingBasisForCanonical(canonicalKey: string): MealPlanV2ServingBasis {
  for (const list of Object.values(STAPLE_ALLOWLIST_BY_POOL)) {
    const found = list.find((e) => e.canonicalKey === canonicalKey);
    if (found) return found.servingBasis;
  }
  if (/_cooked$/.test(canonicalKey)) return "cooked_grams";
  if (/oil|milk|drink/.test(canonicalKey)) return "ml";
  return "dry_grams";
}
