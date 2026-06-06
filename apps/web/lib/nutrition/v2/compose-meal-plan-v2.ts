import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedItem,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
} from "@empathy/contracts";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { filterFdcCandidates } from "@/lib/nutrition/v2/fdc-candidate-filter";
import { solveFdcMealPortions, type FdcAssemblyLine } from "@/lib/nutrition/v2/fdc-meal-macro-solver";
import { fdcDescriptionToLabelIt } from "@/lib/nutrition/v2/fdc-food-label-it";
import { pickBestFdcForRole, type RolePickContext } from "@/lib/nutrition/v2/fdc-healthy-meal-scoring";
import {
  MEAL_SLOT_ASSEMBLY,
  slotMacroTargetsFromDiet,
  type MealSlotAssemblyRole,
} from "@/lib/nutrition/v2/meal-slot-assembly-spec";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { isMainMealSlot } from "@/lib/nutrition/meal-composition-rules";

export type FdcPoolMap = Map<string, FdcFoodBrowseHit[]>;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function macrosFromHit(c: FdcFoodBrowseHit, grams: number): Omit<MealPlanV2ComposedItem, "fdcId" | "description" | "grams"> {
  const f = grams / 100;
  return {
    kcal: round1(c.kcalPer100g * f),
    choG: round1(c.carbsPer100g * f),
    proG: round1(c.proteinPer100g * f),
    fatG: round1(c.fatPer100g * f) || round1(((c.kcalPer100g - c.carbsPer100g * 4 - c.proteinPer100g * 4) / 9) * f) || 0,
  };
}

function pickFromPool(
  pool: FdcFoodBrowseHit[],
  ctx: RolePickContext,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): FdcFoodBrowseHit | null {
  const filtered = filterFdcCandidates(pool, denyFragments);
  const pick = pickBestFdcForRole(filtered, ctx, denyFragments, usedFdcIds, staplePenalty);
  if (pick) return pick;

  if (isMainMealSlot(ctx.slot) && ctx.spec.foodRole === "cho_complex") {
    for (const hit of filtered) {
      if (usedFdcIds.has(hit.fdcId) || hit.carbsPer100g < 12) continue;
      if (/\b(pasta|rice|riso|potato|quinoa|spaghetti)\b/i.test(hit.description)) return hit;
    }
  }
  return null;
}

export function portionHintIt(label: string, grams: number, spec: MealSlotAssemblyRole): string {
  const g = Math.round(grams);
  if (spec.foodRole === "cho_complex" && /pasta|semola/i.test(label)) {
    return `${g} g pasta di semola (peso a crudo)`;
  }
  if (spec.foodRole === "cho_complex" && /riso/i.test(label)) {
    return `${g} g riso (peso a crudo)`;
  }
  if (spec.foodRole === "protein_primary" && /uov/i.test(label)) {
    return `${Math.max(1, Math.round(g / 50))} uova medie (≈${g} g)`;
  }
  if (spec.foodRole === "fat" && /olio/i.test(label)) {
    return `${g} ml olio EVO`;
  }
  if (/latte/i.test(label)) {
    return `${g} ml latte`;
  }
  return `${g} g ${label}`;
}

function composeSlotFromAssembly(
  slot: MealPlanV2DietSlotBudget,
  pools: FdcPoolMap,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): MealPlanV2ComposedSlot {
  const slotKey = slot.key as MealSlotKey;
  const roles = MEAL_SLOT_ASSEMBLY[slotKey] ?? MEAL_SLOT_ASSEMBLY.snack_am;
  const target = slotMacroTargetsFromDiet(slot);

  const lines: FdcAssemblyLine[] = [];

  for (const spec of roles) {
    const rawPool = pools.get(spec.poolKey) ?? [];
    const ctx: RolePickContext = { slot: slotKey, poolKey: spec.poolKey, spec };
    const hit = pickFromPool(rawPool, ctx, denyFragments, usedFdcIds, staplePenalty);
    if (!hit) continue;
    usedFdcIds.add(hit.fdcId);
    lines.push({ spec, hit });
  }

  if (lines.length === 0) {
    return {
      slot: slot.key,
      labelIt: slot.label,
      targetKcal: slot.kcal,
      items: [],
      totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
    };
  }

  const grams = solveFdcMealPortions(lines, target);
  const items: MealPlanV2ComposedItem[] = [];

  lines.forEach((line, i) => {
    const g = grams[i] ?? 0;
    const minG = line.spec.lever === "fat" ? 4 : 8;
    if (g < minG) return;
    items.push({
      fdcId: line.hit.fdcId,
      description: fdcDescriptionToLabelIt(line.hit.description),
      grams: g,
      ...macrosFromHit(line.hit, g),
    });
  });

  const totals = items.reduce(
    (acc, it) => ({
      kcal: round1(acc.kcal + it.kcal),
      choG: round1(acc.choG + it.choG),
      proG: round1(acc.proG + it.proG),
      fatG: round1(acc.fatG + it.fatG),
    }),
    { kcal: 0, choG: 0, proG: 0, fatG: 0 },
  );

  return {
    slot: slot.key,
    labelIt: slot.label,
    targetKcal: slot.kcal,
    items,
    totals,
  };
}

export function composeMealPlanV2(
  requirements: DailyNutritionRequirementsV2,
  dietSlots: MealPlanV2DietSlotBudget[],
  pools: FdcPoolMap,
  options?: {
    denyFragments?: string[];
    weeklyStapleCounts?: Record<string, number>;
    suppressedSlots?: MealSlotKey[];
  },
): MealPlanV2ComposedSlot[] {
  void requirements;
  const denyFragments = options?.denyFragments ?? [];
  const suppressed = new Set(options?.suppressedSlots ?? []);
  const usedFdcIds = new Set<number>();

  const staplePenalty = (description: string): number => {
    const key = description.slice(0, 40).toLowerCase();
    return options?.weeklyStapleCounts?.[key] ?? 0;
  };

  return dietSlots.map((slot) => {
    if (suppressed.has(slot.key as MealSlotKey)) {
      return {
        slot: slot.key,
        labelIt: slot.label,
        targetKcal: slot.kcal,
        items: [],
        totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
      };
    }
    return composeSlotFromAssembly(slot, pools, denyFragments, usedFdcIds, staplePenalty);
  });
}
