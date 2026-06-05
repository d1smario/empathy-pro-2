import assert from "node:assert/strict";
import test from "node:test";
import { inferCanonicalFoodKeyPreferName } from "@/lib/nutrition/canonical-food-composition";
import {
  isFruitCanonicalKey,
  isMainMealSlot,
  SLOT_ITEM_CAPS,
} from "@/lib/nutrition/meal-composition-rules";
import { registerMealCanonicalKeys } from "@/lib/nutrition/meal-rotation-guard";
import {
  composeMediterraneanMeal,
  createMediterraneanDayContext,
} from "@/lib/nutrition/mediterranean-meal-composer";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

const ALL_SLOTS: MealSlotKey[] = [
  "breakfast",
  "snack_am",
  "lunch",
  "snack_pm",
  "dinner",
  "snack_evening",
];

const DIETS = ["omnivore", "vegetarian", "pescatarian", "vegan"] as const;

test("main meals: nessuna frutta in pranzo/cena", () => {
  const ctx = createMediterraneanDayContext("2026-06-03", undefined, undefined, "omnivore");
  const macros = { kcal: 850, carbsG: 100, proteinG: 42, fatG: 26 };
  for (const slot of ["lunch", "dinner"] as const) {
    const meal = composeMediterraneanMeal(slot, macros, ctx);
    registerMealCanonicalKeys(ctx, meal);
    const fruitKeys = meal.items
      .map((i) => inferCanonicalFoodKeyPreferName(i.name, i.portionHint))
      .filter((k) => isFruitCanonicalKey(k));
    assert.equal(fruitKeys.length, 0, `${slot}: frutta vietata, got ${fruitKeys.join(", ")}`);
  }
});

test("giornata completa: nessuna chiave canonica ripetuta nello stesso giorno", () => {
  const ctx = createMediterraneanDayContext("2026-06-03", undefined, undefined, "omnivore");
  const seen = new Set<string>();
  const macrosBySlot: Record<MealSlotKey, { kcal: number; carbsG: number; proteinG: number; fatG: number }> = {
    breakfast: { kcal: 520, carbsG: 65, proteinG: 24, fatG: 16 },
    snack_am: { kcal: 180, carbsG: 22, proteinG: 8, fatG: 6 },
    lunch: { kcal: 820, carbsG: 95, proteinG: 40, fatG: 24 },
    snack_pm: { kcal: 200, carbsG: 24, proteinG: 10, fatG: 7 },
    dinner: { kcal: 750, carbsG: 85, proteinG: 38, fatG: 22 },
    snack_evening: { kcal: 150, carbsG: 18, proteinG: 8, fatG: 5 },
  };
  for (const slot of ALL_SLOTS) {
    const meal = composeMediterraneanMeal(slot, macrosBySlot[slot], ctx);
    for (const it of meal.items) {
      const key = inferCanonicalFoodKeyPreferName(it.name, it.portionHint);
      if (!key) continue;
      assert.ok(!seen.has(key), `Chiave ${key} ripetuta nello stesso giorno (slot ${slot})`);
      seen.add(key);
    }
    registerMealCanonicalKeys(ctx, meal);
  }
});

test("cap voci per slot rispettato su campione diete", () => {
  for (const diet of DIETS) {
    const ctx = createMediterraneanDayContext("2026-06-04", undefined, undefined, diet);
    const macros = { kcal: 800, carbsG: 90, proteinG: 38, fatG: 22 };
    for (const slot of ALL_SLOTS) {
      const meal = composeMediterraneanMeal(slot, macros, ctx);
      registerMealCanonicalKeys(ctx, meal);
      const cap = SLOT_ITEM_CAPS[slot];
      assert.ok(
        meal.items.length <= cap,
        `[${diet}/${slot}] ${meal.items.length} voci > cap ${cap}`,
      );
      if (isMainMealSlot(slot)) {
        const vegCount = meal.items.filter((i) =>
          ["veg", "fiber"].includes(i.macroRole ?? ""),
        ).length;
        assert.ok(vegCount >= 2, `[${diet}/${slot}] attese >=2 verdure, got ${vegCount}`);
        assert.ok(vegCount <= 2, `[${diet}/${slot}] max 2 verdure, got ${vegCount}`);
        assert.ok(
          !meal.items.some((i) => /condimento/i.test(i.name)),
          `[${diet}/${slot}] verdure non devono essere etichettate Condimento`,
        );
        const verduraNamed = meal.items.filter((i) => /^Verdura:/i.test(i.name));
        assert.ok(verduraNamed.length <= 2, `[${diet}/${slot}] max 2 voci Verdura:, got ${verduraNamed.length}`);
      }
    }
  }
});
