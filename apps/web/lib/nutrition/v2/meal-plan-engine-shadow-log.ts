import type { IntelligentMealPlanAssembledCore } from "@/lib/nutrition/intelligent-meal-plan-types";

export type MealPlanEngineShadowDiff = {
  v1SlotCount: number;
  v2SlotCount: number;
  v1TotalApproxKcal: number;
  v2TotalApproxKcal: number;
  v1EmptySlots: string[];
  v2EmptySlots: string[];
  kcalDelta: number;
};

function sumApproxKcal(plan: IntelligentMealPlanAssembledCore): number {
  let sum = 0;
  for (const slot of plan.slots) {
    for (const item of slot.items) {
      sum += Number.isFinite(item.approxKcal) ? item.approxKcal : 0;
    }
  }
  return Math.round(sum);
}

export function diffMealPlanEngines(
  v1: IntelligentMealPlanAssembledCore,
  v2: IntelligentMealPlanAssembledCore,
): MealPlanEngineShadowDiff {
  const v1Empty = v1.slots.filter((s) => s.items.length === 0).map((s) => s.slot);
  const v2Empty = v2.slots.filter((s) => s.items.length === 0).map((s) => s.slot);
  const v1K = sumApproxKcal(v1);
  const v2K = sumApproxKcal(v2);
  return {
    v1SlotCount: v1.slots.length,
    v2SlotCount: v2.slots.length,
    v1TotalApproxKcal: v1K,
    v2TotalApproxKcal: v2K,
    v1EmptySlots: v1Empty,
    v2EmptySlots: v2Empty,
    kcalDelta: v2K - v1K,
  };
}

export function logMealPlanEngineShadowDiff(diff: MealPlanEngineShadowDiff, athleteId: string, planDate: string): void {
  if (process.env.NODE_ENV === "production" && process.env.NUTRITION_MEAL_PLAN_SHADOW_LOG !== "1") return;
  console.info(
    `[nutrition-meal-plan-shadow] athlete=${athleteId} date=${planDate} v1_kcal=${diff.v1TotalApproxKcal} v2_kcal=${diff.v2TotalApproxKcal} delta=${diff.kcalDelta} v2_empty=${diff.v2EmptySlots.join(",") || "none"}`,
  );
}
