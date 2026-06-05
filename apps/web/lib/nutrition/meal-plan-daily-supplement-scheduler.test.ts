import assert from "node:assert/strict";
import test from "node:test";
import type { IntelligentMealPlanRequestSlot, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildDailySupplementIntegrationPlan,
  countDailyIntegrationItems,
} from "@/lib/nutrition/meal-plan-daily-supplement-scheduler";

function mockSlots(): IntelligentMealPlanRequestSlot[] {
  const rows: Array<{ slot: MealSlotKey; labelIt: string; time: string }> = [
    { slot: "breakfast", labelIt: "Colazione", time: "07:30" },
    { slot: "snack_am", labelIt: "Spuntino mattina", time: "10:30" },
    { slot: "lunch", labelIt: "Pranzo", time: "13:00" },
    { slot: "snack_pm", labelIt: "Spuntino pomeriggio", time: "16:30" },
    { slot: "dinner", labelIt: "Cena", time: "20:00" },
  ];
  return rows.map((r) => ({
    slot: r.slot,
    labelIt: r.labelIt,
    scheduledTimeLocal: r.time,
    targetKcal: 500,
    targetCarbsG: 50,
    targetProteinG: 25,
    targetFatG: 15,
    functionalFoodGroups: [],
    foodOptions: [],
  }));
}

test("folati: coperti da alimenti pathway → nessuna voce integrazione ripetuta", () => {
  const plan = buildDailySupplementIntegrationPlan({
    boostTargets: [{ nutrientId: "folate_mcg", labelIt: "Folati (B9)" }],
    slots: mockSlots(),
    dietType: "omnivore",
  });
  assert.equal(countDailyIntegrationItems(plan), 0);
});

test("tiamina B1: una sola integrazione giornaliera con timing nel pasto scelto", () => {
  const plan = buildDailySupplementIntegrationPlan({
    boostTargets: [{ nutrientId: "thiamineB1_mg", labelIt: "Tiamina (B1)" }],
    slots: mockSlots(),
    dietType: "omnivore",
  });
  assert.equal(countDailyIntegrationItems(plan), 1);
  const allItems = Object.values(plan).flat();
  assert.equal(allItems.length, 1);
  const item = allItems[0]!;
  assert.match(item.name, /Integrazione giornaliera:.*B1/i);
  assert.match(item.portionHint, /Durante il pasto|Prima del pasto|Dopo il pasto|Lontano dal pasto/i);
  assert.match(item.portionHint, /Colazione|07:30/);
});

test("B1 + B12 + folati: max 2 integrazioni (folati esclusi), mai 5 pasti", () => {
  const plan = buildDailySupplementIntegrationPlan({
    boostTargets: [
      { nutrientId: "thiamineB1_mg", labelIt: "Tiamina (B1)" },
      { nutrientId: "vitB12_mcg", labelIt: "Vitamina B12" },
      { nutrientId: "folate_mcg", labelIt: "Folati (B9)" },
    ],
    slots: mockSlots(),
    dietType: "omnivore",
  });
  const total = countDailyIntegrationItems(plan);
  assert.ok(total <= 2, `Attese <=2 integrazioni, got ${total}`);
  const slotsUsed = Object.keys(plan).length;
  assert.ok(slotsUsed <= 2, `Integrazioni su troppi pasti: ${slotsUsed}`);
  for (const items of Object.values(plan)) {
    for (const it of items ?? []) {
      assert.match(it.name, /^Integrazione giornaliera:/);
      assert.ok(!/Integrazione \(se concordata\)$/i.test(it.name));
    }
  }
});
