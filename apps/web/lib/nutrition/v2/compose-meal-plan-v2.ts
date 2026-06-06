import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedItem,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
} from "@empathy/contracts";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { filterFdcCandidates } from "@/lib/nutrition/v2/fdc-candidate-filter";
import { fdcDescriptionToLabelIt } from "@/lib/nutrition/v2/fdc-food-label-it";
import { pickBestFdcCandidate, type BranchPickContext } from "@/lib/nutrition/v2/fdc-healthy-meal-scoring";
import { V2_SLOT_BRANCHES, type SlotBranchSpec } from "@/lib/nutrition/v2/fdc-pool-specs";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

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
  return pickBestFdcCandidate(filtered, ctx, denyFragments, usedFdcIds, staplePenalty);
}

function composeSlotMultiBranch(
  slot: MealPlanV2DietSlotBudget,
  pools: FdcPoolMap,
  denyFragments: string[],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
  choTargetG?: number,
): MealPlanV2ComposedSlot {
  const branches = V2_SLOT_BRANCHES[slot.key as MealSlotKey] ?? [
    { poolKey: "snack", kcalShare: 1, macroRole: "mixed" as const, sort: "kcal_low" as const },
  ];

  const items: MealPlanV2ComposedItem[] = [];
  const isBreakfast = slot.key === "breakfast";
  const dualCho = isBreakfast && (choTargetG ?? slot.carbs) >= 130;

  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i]!;
    let share = branch.kcalShare;
    if (dualCho && branch.sort === "cho" && i === 0) share *= 0.55;

    const targetKcal = Math.max(40, Math.round(slot.kcal * share));
    const rawPool = pools.get(branch.poolKey) ?? [];
    const pickCtx: BranchPickContext = {
      slot: slot.key as MealSlotKey,
      poolKey: branch.poolKey,
      branch,
      targetKcal,
    };
    const pick = pickFromPool(rawPool, pickCtx, denyFragments, usedFdcIds, staplePenalty);
    if (!pick || pick.kcalPer100g <= 0) continue;

    const grams = Math.max(25, Math.min(400, Math.round((targetKcal / pick.kcalPer100g) * 100)));
    usedFdcIds.add(pick.fdcId);
    items.push({
      fdcId: pick.fdcId,
      description: fdcDescriptionToLabelIt(pick.description),
      grams,
      ...macrosFromHit(pick, grams),
    });
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
    out.push(
      composeSlotMultiBranch(slot, pools, denyFragments, usedFdcIds, staplePenalty, slot.carbs),
    );
  }

  return out;
}
