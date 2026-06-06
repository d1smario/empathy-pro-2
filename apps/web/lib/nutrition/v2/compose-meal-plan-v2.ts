import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedItem,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
} from "@empathy/contracts";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { filterFdcCandidates } from "@/lib/nutrition/v2/fdc-candidate-filter";
import {
  branchMacroTargets,
  gramsForBranchTarget,
} from "@/lib/nutrition/v2/compose-meal-plan-v2-macro-scale";
import { fdcDescriptionToLabelIt } from "@/lib/nutrition/v2/fdc-food-label-it";
import { pickBestFdcCandidate, type BranchPickContext } from "@/lib/nutrition/v2/fdc-healthy-meal-scoring";
import { V2_SLOT_BRANCHES, type SlotBranchSpec } from "@/lib/nutrition/v2/fdc-pool-specs";
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
  ctx: BranchPickContext,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): FdcFoodBrowseHit | null {
  const filtered = filterFdcCandidates(pool, denyFragments);
  const pick = pickBestFdcCandidate(filtered, ctx, denyFragments, usedFdcIds, staplePenalty);
  if (pick) return pick;

  // Fallback: pool grezzo con solo denylist profilo (main meal carb obbligatorio).
  if (isMainMealSlot(ctx.slot) && ctx.branch.macroRole === "cho_heavy") {
    for (const hit of filtered) {
      if (usedFdcIds.has(hit.fdcId) || hit.kcalPer100g <= 0 || hit.carbsPer100g < 12) continue;
      if (/\b(pasta|rice|riso|potato|quinoa|barley|lentil|chickpea|spaghetti)\b/i.test(hit.description)) {
        return hit;
      }
    }
  }
  return null;
}

function portionHintIt(label: string, grams: number, branch: SlotBranchSpec): string {
  const g = Math.round(grams);
  if (branch.macroRole === "cho_heavy" && /pasta|semola/i.test(label)) {
    return `${g} g pasta di semola (peso a crudo)`;
  }
  if (branch.macroRole === "cho_heavy" && /riso/i.test(label)) {
    return `${g} g riso (peso a crudo)`;
  }
  if (branch.macroRole === "protein" && /uov/i.test(label)) {
    return `${Math.max(2, Math.round(g / 50))} uova medie (≈${g} g)`;
  }
  if (/latte/i.test(label)) {
    return `${g} ml latte`;
  }
  return `${g} g ${label}`;
}

function composeSlotMultiBranch(
  slot: MealPlanV2DietSlotBudget,
  pools: FdcPoolMap,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): MealPlanV2ComposedSlot {
  const branches = V2_SLOT_BRANCHES[slot.key as MealSlotKey] ?? [
    { poolKey: "snack", kcalShare: 1, macroRole: "mixed" as const, sort: "kcal_low" as const },
  ];

  const items: MealPlanV2ComposedItem[] = [];

  for (const branch of branches) {
    const targets = branchMacroTargets(slot, branch);
    const rawPool = pools.get(branch.poolKey) ?? [];
    const pickCtx: BranchPickContext = {
      slot: slot.key as MealSlotKey,
      poolKey: branch.poolKey,
      branch,
      targetKcal: Math.max(40, Math.round(targets.kcal)),
    };
    const pick = pickFromPool(rawPool, pickCtx, denyFragments, usedFdcIds, staplePenalty);
    if (!pick || pick.kcalPer100g <= 0) continue;

    const grams = gramsForBranchTarget(pick, branch, targets);
    usedFdcIds.add(pick.fdcId);
    const label = fdcDescriptionToLabelIt(pick.description);
    items.push({
      fdcId: pick.fdcId,
      description: label,
      grams,
      ...macrosFromHit(pick, grams),
    });
  }

  // Main meal senza primo carb → errore composizione: forza riso/pasta dal pool lunch/dinner carb.
  if (isMainMealSlot(slot.key as MealSlotKey)) {
    const hasCarb = items.some((it) => it.choG >= slot.carbs * 0.25);
    if (!hasCarb) {
      const carbPool = pools.get(`${slot.key === "lunch" ? "lunch" : "dinner"}_carb`) ?? [];
      for (const hit of filterFdcCandidates(carbPool, denyFragments)) {
        if (usedFdcIds.has(hit.fdcId) || hit.carbsPer100g < 12) continue;
        const branch: SlotBranchSpec = { poolKey: "carb_rescue", kcalShare: 0.4, macroRole: "cho_heavy", sort: "cho" };
        const targets = branchMacroTargets(slot, branch);
        const grams = gramsForBranchTarget(hit, branch, targets);
        usedFdcIds.add(hit.fdcId);
        items.unshift({
          fdcId: hit.fdcId,
          description: fdcDescriptionToLabelIt(hit.description),
          grams,
          ...macrosFromHit(hit, grams),
        });
        break;
      }
    }
  }

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

  const out: MealPlanV2ComposedSlot[] = [];

  for (const slot of dietSlots) {
    if (suppressed.has(slot.key as MealSlotKey)) {
      out.push({
        slot: slot.key,
        labelIt: slot.label,
        targetKcal: slot.kcal,
        items: [],
        totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
      });
      continue;
    }
    out.push(composeSlotMultiBranch(slot, pools, denyFragments, usedFdcIds, staplePenalty));
  }

  return out;
}

// Re-export for tests / map layer
export { portionHintIt };
