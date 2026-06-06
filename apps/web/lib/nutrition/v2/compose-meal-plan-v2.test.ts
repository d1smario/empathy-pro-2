import assert from "node:assert/strict";
import test from "node:test";
import type { DailyNutritionRequirementsV2, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { solveFdcMealPortions } from "@/lib/nutrition/v2/fdc-meal-macro-solver";
import { MEAL_SLOT_ASSEMBLY } from "@/lib/nutrition/v2/meal-slot-assembly-spec";

function hit(id: number, desc: string, kcal: number, cho: number, pro: number, fat = 2): FdcFoodBrowseHit {
  return {
    fdcId: id,
    description: desc,
    kcalPer100g: kcal,
    proteinPer100g: pro,
    carbsPer100g: cho,
    fatPer100g: fat,
    tags: {
      mealCourse: [],
      foodFamily: [],
      macroDominant: [],
      slotFit: [],
      dietProfile: ["mediterranean"],
      dietExclude: [],
      mealRole: [],
      aminoProfile: [],
      nutrientDensity: [],
      classifierVersion: "test",
    },
    tagSource: "db",
  };
}

const requirements = { energy: { mealsKcal: 2000 } } as DailyNutritionRequirementsV2;

const lunchSlot: MealPlanV2DietSlotBudget = {
  key: "lunch",
  label: "Pranzo",
  pct: 30,
  kcal: 900,
  carbs: 115,
  protein: 57,
  fat: 26,
};

test("solver: pranzo 115g CHO + 57g PRO da tre leve", () => {
  const roles = MEAL_SLOT_ASSEMBLY.lunch;
  const lines = [
    { spec: roles[0]!, hit: hit(1, "Pasta, cooked", 160, 30, 5) },
    { spec: roles[1]!, hit: hit(2, "Chicken breast", 165, 0, 31) },
    { spec: roles[2]!, hit: hit(3, "Spinach, raw", 23, 4, 3) },
  ];
  const grams = solveFdcMealPortions(lines, { kcal: 900, carbsG: 115, proteinG: 57, fatG: 26 });
  const cho = lines.reduce((a, l, i) => a + (grams[i]! / 100) * l.hit.carbsPer100g, 0);
  const pro = lines.reduce((a, l, i) => a + (grams[i]! / 100) * l.hit.proteinPer100g, 0);
  assert.ok(cho >= 100, `cho ${cho}`);
  assert.ok(pro >= 48, `pro ${pro}`);
});

test("compose lunch: carb + pro + veg, no junk", () => {
  const pools: FdcPoolMap = new Map([
    [
      "lunch_carb",
      [
        hit(10, "Snacks, potato chips", 536, 53, 7),
        hit(1, "Pasta, cooked", 160, 30, 5),
      ],
    ],
    ["lunch_pro", [hit(2, "Chicken breast, roasted", 165, 0, 31)]],
    ["lunch_veg", [hit(3, "Spinach, raw", 23, 4, 3)]],
  ]);
  const out = composeMealPlanV2(requirements, [lunchSlot], pools);
  assert.equal(out[0]!.items.length, 3);
  assert.ok(!out[0]!.items.some((i) => /chip/i.test(i.description)));
  assert.ok(out[0]!.totals.choG >= lunchSlot.carbs * 0.85, `cho ${out[0]!.totals.choG}`);
});

test("compose breakfast: cho + pro + fat (3 ruoli)", () => {
  const breakfastSlot: MealPlanV2DietSlotBudget = {
    key: "breakfast",
    label: "Colazione",
    pct: 25,
    kcal: 989,
    carbs: 124,
    protein: 62,
    fat: 27,
  };
  const pools: FdcPoolMap = new Map([
    ["breakfast_cho", [hit(4, "Cereals, oats", 379, 68, 13, 7)]],
    ["breakfast_pro", [hit(5, "Yogurt, Greek", 97, 4, 9, 5)]],
    ["breakfast_fat", [hit(6, "Nuts, almonds", 579, 22, 21, 50)]],
  ]);
  const out = composeMealPlanV2(requirements, [breakfastSlot], pools);
  assert.equal(out[0]!.items.length, 3);
  assert.ok(out[0]!.totals.choG >= breakfastSlot.carbs * 0.8);
});
