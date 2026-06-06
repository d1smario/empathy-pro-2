import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedItem,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
} from "@empathy/contracts";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { filterFdcCandidates } from "@/lib/nutrition/v2/fdc-candidate-filter";
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

function sortCandidates(candidates: FdcFoodBrowseHit[], sort: SlotBranchSpec["sort"]): FdcFoodBrowseHit[] {
  const sorted = [...candidates];
  if (sort === "pro") {
    sorted.sort((a, b) => b.proteinPer100g - a.proteinPer100g || b.kcalPer100g - a.kcalPer100g);
  } else if (sort === "veg") {
    sorted.sort((a, b) => a.kcalPer100g - b.kcalPer100g || b.carbsPer100g - a.carbsPer100g);
  } else if (sort === "kcal_low") {
    sorted.sort((a, b) => a.kcalPer100g - b.kcalPer100g || b.carbsPer100g - a.carbsPer100g);
  } else {
    sorted.sort((a, b) => b.carbsPer100g - a.carbsPer100g || b.kcalPer100g - a.kcalPer100g);
  }
  return sorted;
}

function pickFromPool(
  pool: FdcFoodBrowseHit[],
  sort: SlotBranchSpec["sort"],
  usedFdcIds: Set<number>,
  staplePenalty: (description: string) => number,
): FdcFoodBrowseHit | null {
  const sorted = sortCandidates(pool, sort);
  for (const c of sorted) {
    if (usedFdcIds.has(c.fdcId)) continue;
    return c;
  }
  return sorted[0] ?? null;
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
    const pool = filterFdcCandidates(rawPool, denyFragments);
    const pick = pickFromPool(pool, branch.sort, usedFdcIds, staplePenalty);
    if (!pick || pick.kcalPer100g <= 0) continue;

    const grams = Math.max(25, Math.min(400, Math.round((targetKcal / pick.kcalPer100g) * 100)));
    usedFdcIds.add(pick.fdcId);
    items.push({
      fdcId: pick.fdcId,
      description: pick.description,
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
