import assert from "node:assert/strict";
import test from "node:test";
import { buildDailySupplementIntegrationPlan } from "@/lib/nutrition/meal-plan-daily-supplement-scheduler";
import type { IntelligentMealPlanRequestSlot, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

test("hint integrazione: nome specifico nutriente (B12, ferro, zinco, B1, B3) — 1×/giorno", () => {
  const slots: IntelligentMealPlanRequestSlot[] = (
    [
      ["breakfast", "Colazione", "07:30"],
      ["lunch", "Pranzo", "13:00"],
      ["dinner", "Cena", "20:00"],
    ] as const
  ).map(([slot, labelIt, time]) => ({
    slot: slot as MealSlotKey,
    labelIt,
    scheduledTimeLocal: time,
    targetKcal: 600,
    targetCarbsG: 60,
    targetProteinG: 30,
    targetFatG: 18,
    functionalFoodGroups: [],
    foodOptions: [],
  }));

  const plan = buildDailySupplementIntegrationPlan({
    boostTargets: [
      { nutrientId: "vitB12_mcg", labelIt: "Vitamina B12" },
      { nutrientId: "fe_mg", labelIt: "Ferro" },
      { nutrientId: "zn_mg", labelIt: "Zinco" },
      { nutrientId: "thiamineB1_mg", labelIt: "Tiamina (B1)" },
      { nutrientId: "niacinB3_mg", labelIt: "Niacina (B3)" },
    ],
    slots,
    dietType: "vegan",
  });

  const items = Object.values(plan).flat();
  assert.ok(items.length >= 1);
  for (const it of items) {
    assert.match(it.name, /^Integrazione giornaliera:/i);
    assert.ok(it.portionHint.length > 20, `Hint troppo corto per ${it.name}`);
    assert.match(it.portionHint, /Durante il pasto|Prima del pasto|Dopo il pasto|Lontano dal pasto/i);
  }
});
