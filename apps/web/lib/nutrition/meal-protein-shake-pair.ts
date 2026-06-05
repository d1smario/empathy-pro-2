import { inferCanonicalFoodKeyPreferName } from "@/lib/nutrition/canonical-food-composition";
import type { IntelligentMealPlanItemOut } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";

const LIQUID_KEYS = new Set([
  "milk_2pct",
  "milk_goat",
  "plant_drink_almond",
  "plant_drink_rice",
  "plant_drink_oat",
  "plant_drink_generic",
]);

function denyHit(keywords: readonly string[], deny: readonly string[] | undefined): boolean {
  if (!deny?.length) return false;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    for (const d of deny) {
      if (!d) continue;
      if (k.includes(d) || d.includes(k)) return true;
    }
  }
  return false;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function pickShakeLiquid(
  ctx: MediterraneanDayContext,
  seed: number,
): { name: string; portionHint: string; canonicalKey: string; approxKcal: number } {
  const deny = ctx.denyFragments;
  const isVegan = ctx.dietType === "vegan";
  const denyDairy = isVegan || denyHit(["latte", "lattosio", "latticino", "yogurt", "milk"], deny);
  const ml = clamp(180 + (seed % 4) * 20, 150, 260);

  if (!denyDairy && !denyHit(["lattosio"], deny)) {
    return {
      name: "Latte vaccino (per shake)",
      portionHint: `${ml} ml latte vaccino parzialmente scremato`,
      canonicalKey: "milk_2pct",
      approxKcal: Math.round(ml * 0.64),
    };
  }
  if (!denyHit(["mandorl", "frutta a guscio", "noci"], deny)) {
    return {
      name: "Bevanda mandorla (per shake)",
      portionHint: `${ml} ml bevanda di mandorla non zuccherata`,
      canonicalKey: "plant_drink_almond",
      approxKcal: Math.round(ml * 0.24),
    };
  }
  if (!denyHit(["riso"], deny)) {
    return {
      name: "Bevanda riso (per shake)",
      portionHint: `${ml} ml bevanda di riso non zuccherata`,
      canonicalKey: "plant_drink_rice",
      approxKcal: Math.round(ml * 0.5),
    };
  }
  return {
    name: "Bevanda vegetale (per shake)",
    portionHint: `${ml} ml bevanda vegetale non zuccherata (soia/cocco)`,
    canonicalKey: "plant_drink_generic",
    approxKcal: Math.round(ml * 0.35),
  };
}

export function mealItemsHaveWhey(items: readonly IntelligentMealPlanItemOut[]): boolean {
  return items.some((it) => inferCanonicalFoodKeyPreferName(it.name, it.portionHint) === "whey_powder");
}

export function mealItemsHaveShakeLiquid(items: readonly IntelligentMealPlanItemOut[]): boolean {
  return items.some((it) => {
    const key = inferCanonicalFoodKeyPreferName(it.name, it.portionHint);
    return key != null && LIQUID_KEYS.has(key);
  });
}

/** Aggiunge latte/bevanda vegetale quando c'è whey in polvere (shake). */
export function appendProteinShakeLiquidIfNeeded(
  ctx: MediterraneanDayContext,
  seed: number,
  items: IntelligentMealPlanItemOut[],
  lines?: string[],
): void {
  if (!mealItemsHaveWhey(items) || mealItemsHaveShakeLiquid(items)) return;
  const liquid = pickShakeLiquid(ctx, seed);
  items.push({
    name: liquid.name,
    portionHint: liquid.portionHint.slice(0, 160),
    approxKcal: liquid.approxKcal,
    macroRole: "protein",
    functionalBridge: "Liquido per sciogliere le proteine in polvere (latte o bevanda vegetale in base ad allergie/intolleranze).",
  });
  lines?.push(liquid.portionHint);
}
