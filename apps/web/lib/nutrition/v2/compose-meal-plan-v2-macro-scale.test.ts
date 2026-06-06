import assert from "node:assert/strict";
import test from "node:test";
import { branchMacroTargets, gramsForBranchTarget } from "@/lib/nutrition/v2/compose-meal-plan-v2-macro-scale";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";

const hit = (cho: number, pro: number, kcal: number): FdcFoodBrowseHit => ({
  fdcId: 1,
  description: "Pasta, cooked",
  kcalPer100g: kcal,
  proteinPer100g: pro,
  carbsPer100g: cho,
  fatPer100g: 1,
  tags: {
    mealCourse: [],
    foodFamily: [],
    macroDominant: [],
    slotFit: [],
    dietProfile: [],
    dietExclude: [],
    mealRole: [],
    aminoProfile: [],
    nutrientDensity: [],
    classifierVersion: "t",
  },
  tagSource: "db",
});

test("gramsForBranchTarget: 115g CHO target → ~190g pasta cooked", () => {
  const slot = { kcal: 900, carbs: 115, protein: 57, fat: 26 };
  const branch = { poolKey: "l", kcalShare: 0.4, macroRole: "cho_heavy" as const, sort: "cho" as const };
  const targets = branchMacroTargets(slot, branch);
  assert.ok(targets.choG > 60, `cho target branch ${targets.choG}`);
  const g = gramsForBranchTarget(hit(30, 5, 160), branch, targets);
  assert.ok(g >= 100, `grams ${g}`);
  const choDelivered = (g / 100) * 30;
  assert.ok(choDelivered >= targets.choG * 0.85, `cho ${choDelivered} vs ${targets.choG}`);
});
