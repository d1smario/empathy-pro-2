import assert from "node:assert/strict";
import test from "node:test";
import { diffMealPlanEngines } from "@/lib/nutrition/v2/meal-plan-engine-shadow-log";
import type { IntelligentMealPlanAssembledCore } from "@/lib/nutrition/intelligent-meal-plan-types";

function stubPlan(kcal: number): IntelligentMealPlanAssembledCore {
  return {
    layer: "deterministic_meal_assembly_v1",
    disclaimer: "",
    slots: [
      {
        slot: "lunch",
        targetKcalEcho: kcal,
        items: [{ name: "Riso", portionHint: "80g", approxKcal: kcal, macroRole: "cho_heavy" }],
        slotCoherence: "",
        slotTimingRationale: "",
      },
    ],
    dayInteractionSummary: "",
    mealRotationStaples: [],
  };
}

test("diffMealPlanEngines: kcal delta within tolerance band", () => {
  const diff = diffMealPlanEngines(stubPlan(900), stubPlan(950));
  assert.equal(diff.kcalDelta, 50);
  const pct = Math.abs(diff.kcalDelta) / 900;
  assert.ok(pct < 0.12);
});
