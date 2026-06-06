import assert from "node:assert/strict";
import test from "node:test";
import type { IntelligentMealPlanAssembledCore } from "@/lib/nutrition/intelligent-meal-plan-types";
import { diffMealPlanEngines } from "@/lib/nutrition/v2/meal-plan-engine-shadow-log";

function stubPlan(kcal: number): IntelligentMealPlanAssembledCore {
  return {
    layer: "deterministic_meal_assembly_v1",
    disclaimer: "",
    slots: [
      {
        slot: "lunch",
        targetKcalEcho: kcal,
        items: [{ name: "x", portionHint: "100g", functionalBridge: "", approxKcal: kcal, macroRole: "mixed" }],
        slotCoherence: "",
        slotTimingRationale: "",
      },
    ],
    dayInteractionSummary: "",
  };
}

test("diffMealPlanEngines calcola delta kcal", () => {
  const d = diffMealPlanEngines(stubPlan(500), stubPlan(620));
  assert.equal(d.kcalDelta, 120);
  assert.equal(d.v1TotalApproxKcal, 500);
  assert.equal(d.v2TotalApproxKcal, 620);
});
