import assert from "node:assert/strict";
import test from "node:test";
import { solveFdcMealPortions } from "@/lib/nutrition/v2/fdc-meal-macro-solver";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";

const hit = (cho: number, pro: number, fat: number): FdcFoodBrowseHit => ({
  fdcId: 1,
  description: "Pasta, cooked",
  kcalPer100g: 160,
  proteinPer100g: pro,
  carbsPer100g: cho,
  fatPer100g: fat,
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

test("solveFdcMealPortions hits Diet slot macros", () => {
  const roles = MEAL_SLOT_ASSEMBLY.lunch;
  const lines = [
    { spec: roles[0]!, hit: hit(30, 5, 1) },
    { spec: roles[1]!, hit: hit(0, 31, 3) },
    { spec: roles[2]!, hit: hit(4, 3, 0) },
  ];
  const grams = solveFdcMealPortions(lines, { kcal: 900, carbsG: 115, proteinG: 57, fatG: 26 });
  const cho = lines.reduce((a, l, i) => a + (grams[i]! / 100) * l.hit.carbsPer100g, 0);
  assert.ok(cho >= 108, `cho ${cho}`);
});
