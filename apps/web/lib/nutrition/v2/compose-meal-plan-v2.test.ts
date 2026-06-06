import assert from "node:assert/strict";
import test from "node:test";
import type { DailyNutritionRequirementsV2, MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";

function hit(id: number, desc: string, kcal: number, cho: number, pro: number): FdcFoodBrowseHit {
  return {
    fdcId: id,
    description: desc,
    kcalPer100g: kcal,
    proteinPer100g: pro,
    carbsPer100g: cho,
    fatPer100g: 2,
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

const requirements = {
  energy: { mealsKcal: 2000 },
} as DailyNutritionRequirementsV2;

const lunchSlot: MealPlanV2DietSlotBudget = {
  key: "lunch",
  label: "Pranzo",
  pct: 30,
  kcal: 600,
  carbs: 75,
  protein: 30,
  fat: 15,
};

test("compose lunch: multi-item da branch carb+pro+veg", () => {
  const pools: FdcPoolMap = new Map([
    ["lunch_carb", [hit(1, "Pasta, cooked", 160, 30, 5)]],
    ["lunch_pro", [hit(2, "Chicken breast, roasted", 165, 0, 31)]],
    ["lunch_veg", [hit(3, "Spinach, raw", 23, 4, 3)]],
  ]);
  const out = composeMealPlanV2(requirements, [lunchSlot], pools);
  assert.equal(out.length, 1);
  assert.ok(out[0]!.items.length >= 2, `items ${out[0]!.items.length}`);
  assert.ok(out[0]!.totals.kcal > 200);
});

test("denylist esclude walrus", () => {
  const pools: FdcPoolMap = new Map([
    ["lunch_pro", [hit(9, "Walrus, meat, dried (Alaska Native)", 300, 0, 50), hit(2, "Salmon, Atlantic", 200, 0, 25)]],
  ]);
  const out = composeMealPlanV2(requirements, [lunchSlot], pools, { denyFragments: [] });
  const names = out[0]!.items.map((i) => i.description).join(" ");
  assert.ok(!names.toLowerCase().includes("walrus"));
});
