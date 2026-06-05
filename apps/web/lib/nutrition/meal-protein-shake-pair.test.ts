import assert from "node:assert/strict";
import test from "node:test";
import type { IntelligentMealPlanItemOut } from "@/lib/nutrition/intelligent-meal-plan-types";
import { createMediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import {
  appendProteinShakeLiquidIfNeeded,
  mealItemsHaveShakeLiquid,
  mealItemsHaveWhey,
} from "@/lib/nutrition/meal-protein-shake-pair";

test("whey in polvere: aggiunge latte o bevanda vegetale per scioglierla", () => {
  const ctx = createMediterraneanDayContext("2026-06-05", undefined, undefined, "omnivore");
  const items: IntelligentMealPlanItemOut[] = [
    {
      name: "Proteine whey in polvere",
      portionHint: "15 g proteine whey in polvere",
      approxKcal: 60,
      macroRole: "protein",
    },
  ];
  appendProteinShakeLiquidIfNeeded(ctx, 42, items);
  assert.ok(mealItemsHaveWhey(items));
  assert.ok(mealItemsHaveShakeLiquid(items));
  const liquid = items.find((i) => /latte|bevanda/i.test(i.name));
  assert.ok(liquid, `Atteso liquido per shake, got: ${items.map((i) => i.name).join(", ")}`);
});

test("whey + liquido già presente: nessun doppione", () => {
  const ctx = createMediterraneanDayContext("2026-06-05", undefined, undefined, "vegan");
  const items: IntelligentMealPlanItemOut[] = [
    {
      name: "Proteine vegetali in polvere",
      portionHint: "20 g proteine vegetali in polvere",
      approxKcal: 80,
      macroRole: "protein",
    },
    {
      name: "Bevanda mandorla (per shake)",
      portionHint: "200 ml bevanda di mandorla non zuccherata",
      approxKcal: 48,
      macroRole: "protein",
    },
  ];
  const before = items.length;
  appendProteinShakeLiquidIfNeeded(ctx, 7, items);
  assert.equal(items.length, before);
});
