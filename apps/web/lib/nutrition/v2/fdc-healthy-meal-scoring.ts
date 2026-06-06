import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MealSlotAssemblyRole } from "@/lib/nutrition/v2/meal-slot-assembly-spec";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { isDeniedFdcDescription } from "@/lib/nutrition/v2/fdc-candidate-filter";
import { isMainMealSlot } from "@/lib/nutrition/meal-composition-rules";

export type RolePickContext = {
  slot: MealSlotKey;
  poolKey: string;
  spec: MealSlotAssemblyRole;
};

const MAIN_MEAL_FORBIDDEN =
  /\b(cereal|corn flakes|bran flakes|muesli|granola|oat,?\s|oats,?\s|crisp|crisps|chip|chips|potato chips|french fries|snack bar|granola bar|cookie|babyfood|walrus|kraft foods|fast foods|rice cake|crackers?)\b/i;

const MAIN_CARB_PREFERRED =
  /\b(pasta|spaghetti|macaroni|riso\b|quinoa|barley|lentil|chickpea|potato.*flesh|potato.*baked|sweet potato|rice,?\s+(white|brown|long-grain|cooked))\b/i;

const BREAKFAST_CHO_PREFERRED =
  /\b(oats?|oatmeal|avena|bread|pane|muesli|cereal|corn flakes|bran|cracker|biscott|rusk|toast)\b/i;

const PROTEIN_PREFERRED =
  /\b(chicken breast|turkey|salmon|tuna|cod|egg|uova|yogurt|tofu|lean beef|fish|legume|lentil|chickpea|cottage|ricotta)\b/i;

const FAT_PREFERRED = /\b(almond|mandorl|walnut|noci|olive oil|olio|avocado|peanut|seed|semi)\b/i;

const VEG_PREFERRED =
  /\b(spinach|broccoli|zucchini|pepper|tomato|carrot|lettuce|kale|asparagus|green bean|salad|insalat|verdur)\b/i;

export function isForbiddenForRole(hit: FdcFoodBrowseHit, ctx: RolePickContext, denyFragments: string[]): boolean {
  const d = hit.description;
  if (isDeniedFdcDescription(d, denyFragments)) return true;
  if (/\b(kraft foods|general mills)\b/i.test(d)) return true;

  if (ctx.slot === "breakfast" && ctx.spec.foodRole === "cho_complex") {
    if (/\b(pasta|spaghetti|rice\b|riso|potato|lentil|chickpea|salmon|chicken)\b/i.test(d)) return true;
  }

  if (isMainMealSlot(ctx.slot)) {
    if (MAIN_MEAL_FORBIDDEN.test(d)) return true;
    if (/\b(rice cake|crackers?,?\s|mini rice cakes)\b/i.test(d)) return true;
    if (ctx.spec.foodRole === "cho_complex" && /\b(cereal|oat|muesli|bread,?\s*white)\b/i.test(d)) return true;
  }

  return false;
}

function macroBonus(hit: FdcFoodBrowseHit, spec: MealSlotAssemblyRole): number {
  if (spec.lever === "cho") return hit.carbsPer100g * 0.5;
  if (spec.lever === "protein") return hit.proteinPer100g * 0.55;
  if (spec.lever === "fat") return hit.fatPer100g * 0.6;
  return 100 - hit.kcalPer100g;
}

export function scoreFdcForRole(
  hit: FdcFoodBrowseHit,
  ctx: RolePickContext,
  denyFragments: string[],
  staplePenalty: (description: string) => number,
): number {
  if (isForbiddenForRole(hit, ctx, denyFragments)) return -10_000;

  let score = macroBonus(hit, ctx.spec);
  const d = hit.description;

  if (ctx.spec.foodRole === "cho_complex") {
    if (isMainMealSlot(ctx.slot) && MAIN_CARB_PREFERRED.test(d) && !/\brice cake\b/i.test(d)) score += 200;
    if (ctx.slot === "breakfast" && BREAKFAST_CHO_PREFERRED.test(d)) score += 200;
  }
  if (ctx.spec.foodRole === "protein_primary" || ctx.spec.foodRole === "protein_secondary") {
    if (PROTEIN_PREFERRED.test(d)) score += 180;
  }
  if (ctx.spec.foodRole === "fat" && FAT_PREFERRED.test(d)) score += 160;
  if (ctx.spec.foodRole === "veg_condiment" && VEG_PREFERRED.test(d)) score += 160;

  score -= staplePenalty(d) * 40;
  return score;
}

export function pickBestFdcForRole(
  pool: FdcFoodBrowseHit[],
  ctx: RolePickContext,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): FdcFoodBrowseHit | null {
  let best: FdcFoodBrowseHit | null = null;
  let bestScore = -Infinity;

  for (const hit of pool) {
    if (usedFdcIds.has(hit.fdcId) || hit.kcalPer100g <= 0) continue;
    if (ctx.spec.lever === "cho" && hit.carbsPer100g < 8) continue;
    if (ctx.spec.lever === "protein" && hit.proteinPer100g < 6) continue;
    if (ctx.spec.lever === "fat" && hit.fatPer100g < 3) continue;

    const score = scoreFdcForRole(hit, ctx, denyFragments, staplePenalty);
    if (score <= -5000) continue;
    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }

  return best;
}
