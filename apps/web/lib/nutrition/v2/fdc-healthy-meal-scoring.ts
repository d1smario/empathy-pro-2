import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { isDeniedFdcDescription } from "@/lib/nutrition/v2/fdc-candidate-filter";
import { isMainMealSlot } from "@/lib/nutrition/meal-composition-rules";
import type { SlotBranchSpec } from "@/lib/nutrition/v2/fdc-pool-specs";

export type BranchPickContext = {
  slot: MealSlotKey;
  poolKey: string;
  branch: SlotBranchSpec;
  targetKcal: number;
};

/** Cibi ultraprocessati / snack — mai in pasti principali. */
const MAIN_MEAL_FORBIDDEN =
  /\b(cereal|corn flakes|bran flakes|muesli|granola|oat,?\s|oats,?\s|instant oat|grits|wheat, cream|crisp|crisps|chip|chips|potato chips|tortilla chip|pretzel|popcorn|snack bar|granola bar|cookie|biscuit|cake|donut|doughnut|pastry|pie,?\s|french fries|fried potato|hash brown|onion rings|pizza,?\s*cheese|fast food|restaurant|babyfood|infant|formula|walrus|navajo|alaska native|gelatin|dry powder|crust|ready-to-eat|prepared from recipe with|mix,?\s*dry|stuffing|breaded|battered|nugget|corn dog|hot dog|sausage roll|luncheon meat|spam|bologna|salami|pepperoni|frankfurter|cornbread|muffin|cupcake|brownie|candy|chocolate bar|ice cream|syrup|pancake|waffle|toaster pastry|fruit snack|fruit leather|energy bar|protein bar)\b/i;

/** Primo piatto sano pranzo/cena — modello mediterraneo V1. */
const MAIN_CARB_PREFERRED =
  /\b(pasta|spaghetti|macaroni|penne|rice\b|riso|quinoa|barley|bulgur|farro|couscous|lentil|lenticch|chickpea|ceci|bean|cooked.*potato|potato.*flesh|potato.*baked|potato.*boiled|sweet potato|patat)\b/i;

const MAIN_PRO_PREFERRED =
  /\b(chicken breast|turkey breast|salmon|tuna|cod|merluzzo|trout|sardine|mackerel|egg|uova|tofu|lean beef|beef.*loin|pork.*loin|white fish|fish,?\s*raw|fish,?\s*baked|fish,?\s*grilled|legume|lentil|chickpea)\b/i;

const MAIN_VEG_PREFERRED =
  /\b(spinach|broccoli|zucchini|pepper|tomato|carrot|lettuce|kale|asparagus|green bean|cabbage|cauliflower|eggplant|cucumber|celery|chard|artichoke|fennel|radish|mushroom|verdur|insalat|salad)\b/i;

const BREAKFAST_CARB_PREFERRED =
  /\b(oats?|oatmeal|avena|bread|pane|muesli|cereal|corn flakes|bran|cracker|biscott|rusk|toast|yogurt|fiocchi)\b/i;

const SNACK_PREFERRED =
  /\b(yogurt|fruit|banana|apple|orange|berry|mirtill|mandorl|walnut|noci|semi|seed|dark chocolate|cioccolat|cracker|biscott|pane|hummus|ricotta|cottage)\b/i;

const PROCESSED_MEAT =
  /\b(sausage|salami|bologna|pepperoni|frankfurter|hot dog|luncheon|corned|pastrami|bacon|ham,?\s*cured|spam|meatball.*frozen|breaded.*chicken|nugget|patty,?\s*fast food)\b/i;

export function isForbiddenForBranch(hit: FdcFoodBrowseHit, ctx: BranchPickContext, denyFragments: string[]): boolean {
  const d = hit.description;
  if (isDeniedFdcDescription(d, denyFragments)) return true;
  if (PROCESSED_MEAT.test(d)) return true;

  const main = isMainMealSlot(ctx.slot);

  if (main && MAIN_MEAL_FORBIDDEN.test(d)) return true;

  if (main && ctx.branch.macroRole === "cho_heavy") {
    if (/\b(bread|pane|cracker|toast|bagel|roll,?\s*white|bun,?\s*hamburger)\b/i.test(d) && !/\b(whole wheat|integrale|whole-grain)\b/i.test(d)) {
      return true;
    }
    if (/\b(cereal|oat|muesli|granola|corn flakes|bran)\b/i.test(d)) return true;
    if (/\b(french fries|fried|chips|crisp)\b/i.test(d)) return true;
  }

  if (ctx.slot === "breakfast" && ctx.branch.macroRole === "cho_heavy") {
    if (/\b(pasta|spaghetti|rice\b|riso|potato|patat|lentil|chickpea)\b/i.test(d)) return true;
  }

  if (/snack/.test(ctx.poolKey) || ctx.slot.startsWith("snack")) {
    if (/\b(pasta|spaghetti|rice\b|riso|potato|chicken breast|salmon|beef)\b/i.test(d) && !SNACK_PREFERRED.test(d)) {
      return true;
    }
    if (MAIN_MEAL_FORBIDDEN.test(d)) return true;
  }

  return false;
}

function macroBonus(hit: FdcFoodBrowseHit, ctx: BranchPickContext): number {
  const sort = ctx.branch.sort;
  if (sort === "cho") return hit.carbsPer100g * 0.4 + hit.kcalPer100g * 0.05;
  if (sort === "pro") return hit.proteinPer100g * 0.5 + hit.kcalPer100g * 0.03;
  if (sort === "veg") return 120 - hit.kcalPer100g + hit.carbsPer100g * 0.2;
  return 80 - hit.kcalPer100g;
}

export function scoreFdcCandidate(
  hit: FdcFoodBrowseHit,
  ctx: BranchPickContext,
  denyFragments: string[],
  staplePenalty: (description: string) => number,
): number {
  if (isForbiddenForBranch(hit, ctx, denyFragments)) return -10_000;

  const d = hit.description;
  let score = macroBonus(hit, ctx);

  if (isMainMealSlot(ctx.slot)) {
    if (ctx.branch.macroRole === "cho_heavy" && MAIN_CARB_PREFERRED.test(d)) score += 180;
    if (ctx.branch.macroRole === "protein" && MAIN_PRO_PREFERRED.test(d)) score += 180;
    if (ctx.branch.macroRole === "veg" && MAIN_VEG_PREFERRED.test(d)) score += 160;
    if (ctx.branch.macroRole === "cho_heavy" && /\b(bread|cracker|bagel)\b/i.test(d)) score -= 120;
  }

  if (ctx.slot === "breakfast") {
    if (ctx.branch.macroRole === "cho_heavy" && BREAKFAST_CARB_PREFERRED.test(d)) score += 140;
    if (ctx.branch.macroRole === "mixed" && /\b(frutta|fruit|banana|apple|berry|mirtill)\b/i.test(d)) score += 100;
  }

  if (ctx.slot.startsWith("snack") && SNACK_PREFERRED.test(d)) score += 100;

  if (hit.tags.nutrientDensity?.length) score += 15;
  if (hit.tags.macroDominant?.includes("fiber_dense")) score += 20;

  score -= staplePenalty(d) * 45;
  return score;
}

export function pickBestFdcCandidate(
  pool: FdcFoodBrowseHit[],
  ctx: BranchPickContext,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): FdcFoodBrowseHit | null {
  let best: FdcFoodBrowseHit | null = null;
  let bestScore = -Infinity;

  for (const hit of pool) {
    if (usedFdcIds.has(hit.fdcId) || hit.kcalPer100g <= 0) continue;
    const score = scoreFdcCandidate(hit, ctx, denyFragments, staplePenalty);
    if (score <= -5000) continue;
    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }

  return best;
}
