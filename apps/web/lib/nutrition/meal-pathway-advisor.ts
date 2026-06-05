import { CANONICAL_FOOD_TABLE, inferCanonicalFoodKeyPreferName } from "@/lib/nutrition/canonical-food-composition";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  isFruitCanonicalKey,
  isMainMealSlot,
  isVegCanonicalKey,
  MAIN_ROLE_CAPS,
} from "@/lib/nutrition/meal-composition-rules";
import { canUseCanonicalKey } from "@/lib/nutrition/meal-rotation-guard";
import type {
  MediterraneanComposedMeal,
  MediterraneanDayContext,
} from "@/lib/nutrition/mediterranean-meal-composer";
import {
  listNutrientPathwaySwapsForSlot,
  type NutrientPathwaySwapSpec,
} from "@/lib/nutrition/nutrient-pathway-slot-registry";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";

export type PathwayAdviceResult = {
  meal: MediterraneanComposedMeal;
  adviceNotes: string[];
};

function mealHasCanonicalKey(meal: MediterraneanComposedMeal, canonicalKey: string): boolean {
  return meal.items.some((it) => inferCanonicalFoodKeyPreferName(it.name, it.portionHint) === canonicalKey);
}

function countVegInMeal(meal: MediterraneanComposedMeal): number {
  return meal.items.filter((it) => isVegCanonicalKey(inferCanonicalFoodKeyPreferName(it.name, it.portionHint))).length;
}

function countFruitInMeal(meal: MediterraneanComposedMeal): number {
  return meal.items.filter((it) => isFruitCanonicalKey(inferCanonicalFoodKeyPreferName(it.name, it.portionHint))).length;
}

function applyAddSpec(meal: MediterraneanComposedMeal, spec: NutrientPathwaySwapSpec): MediterraneanComposedMeal | null {
  if (mealHasCanonicalKey(meal, spec.canonicalKey)) return null;
  const toRow = CANONICAL_FOOD_TABLE[spec.canonicalKey];
  if (!toRow) return null;
  const grams = spec.defaultGrams;
  const approxKcal = Math.max(15, Math.round((toRow.kcalPer100g * grams) / 100));
  const portion = `${grams} g ${spec.noun}`.slice(0, 160);
  const newItem = {
    name: spec.name,
    portionHint: portion,
    approxKcal,
    macroRole: spec.macroRole,
    functionalBridge: spec.bridge.slice(0, 500),
  };
  const items = [...meal.items, newItem];
  return {
    ...meal,
    items,
    lines: [...meal.lines, portion],
    totalApproxKcal: items.reduce((a, i) => a + i.approxKcal, 0),
  };
}

function pickRotatedSpec(
  specs: NutrientPathwaySwapSpec[],
  ctx: MediterraneanDayContext | undefined,
): NutrientPathwaySwapSpec | null {
  for (const spec of specs) {
    if (!ctx || !canUseCanonicalKey(ctx, spec.canonicalKey, { allowWeekException: true })) continue;
    return spec;
  }
  return null;
}

/**
 * Pathway: pranzo/cena = solo note (sostituzione/integrazione), niente stack.
 * Colazione/spuntini: max 1 add; mai replace CHO; no frutta duplicata.
 */
export function applyPathwayAdvice(
  meal: MediterraneanComposedMeal,
  slot: MealSlotKey,
  targetIds: readonly NutrientTargetId[],
  ctx?: MediterraneanDayContext,
): PathwayAdviceResult {
  const adviceNotes: string[] = [];
  if (!targetIds.length || ctx?.suppressedSlots?.includes(slot)) {
    return { meal, adviceNotes };
  }

  if (isMainMealSlot(slot)) {
    const vegCount = countVegInMeal(meal);
    for (const id of targetIds) {
      const specs = listNutrientPathwaySwapsForSlot(id, slot, ctx?.dietType);
      if (!specs.length) continue;
      const head = specs[0]!;
      if (isFruitCanonicalKey(head.canonicalKey)) {
        adviceNotes.push("Micronutriente: preferisci frutta a colazione o spuntino, non a pranzo/cena.");
        continue;
      }
      if (vegCount >= MAIN_ROLE_CAPS.veg_condiment) {
        adviceNotes.push(
          `Pasto già con ${vegCount} verdure: valuta sostituzione contorno con ${head.noun} o integrazione mirata.`,
        );
        continue;
      }
      adviceNotes.push(`Suggerimento pathway: ${head.noun} come alternativa contorno (non aggiunto automaticamente).`);
    }
    return { meal, adviceNotes };
  }

  let current = meal;
  let addsApplied = 0;
  for (const id of targetIds) {
    if (addsApplied >= 1) break;
    const specs = listNutrientPathwaySwapsForSlot(id, slot, ctx?.dietType).filter((s) => s.mode === "add");
    const spec = pickRotatedSpec(specs, ctx);
    if (!spec) {
      adviceNotes.push(`Integrazione consigliata per ${id} (rotazione o pasto già completo).`);
      continue;
    }
    if (isFruitCanonicalKey(spec.canonicalKey) && countFruitInMeal(current) >= 1) continue;
    const next = applyAddSpec(current, spec);
    if (!next) continue;
    current = next;
    addsApplied += 1;
  }

  return { meal: current, adviceNotes };
}

/** Compat con chiamate esistenti. */
export function applyNutrientBoostSwaps(
  meal: MediterraneanComposedMeal,
  slot: MealSlotKey,
  targetIds: readonly NutrientTargetId[],
  ctx?: MediterraneanDayContext,
): MediterraneanComposedMeal {
  return applyPathwayAdvice(meal, slot, targetIds, ctx).meal;
}
