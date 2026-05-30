/**
 * Regressione: la composizione mediterranea deve centrare i MACRO target dello slot
 * (CHO/PRO/FAT), non solo le kcal. Le porzioni (grammi) sono calcolate dal solver e le
 * macro delle voci vengono lette dalla banca canonica (stessa via di
 * `finalizeIntelligentMealPlanCore`): header pasto ⇄ somma voci devono coincidere
 * entro tolleranza, senza ricette fisse.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  composeMediterraneanMeal,
  createMediterraneanDayContext,
  type MealMacroTargets,
  type MediterraneanDietType,
} from "@/lib/nutrition/mediterranean-meal-composer";
import { nutrientsForMealPlanItem } from "@/lib/nutrition/canonical-food-composition";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

/** Somma le macro delle voci usando la STESSA risoluzione canonica del finalize. */
function summedMacros(items: { name: string; portionHint: string; approxKcal: number }[]) {
  return items.reduce(
    (acc, it) => {
      const { nutrients } = nutrientsForMealPlanItem(it);
      return {
        carbsG: acc.carbsG + nutrients.carbsG,
        proteinG: acc.proteinG + nutrients.proteinG,
        fatG: acc.fatG + nutrients.fatG,
      };
    },
    { carbsG: 0, proteinG: 0, fatG: 0 },
  );
}

function assertWithin(label: string, actual: number, target: number, relTol: number, absTol: number) {
  const diff = Math.abs(actual - target);
  const allowed = Math.max(absTol, target * relTol);
  assert.ok(
    diff <= allowed,
    `${label}: atteso ~${target.toFixed(0)} g, ottenuto ${actual.toFixed(0)} g (Δ ${diff.toFixed(0)} > ${allowed.toFixed(0)})`,
  );
}

function runCase(
  slot: MealSlotKey,
  target: MealMacroTargets,
  diet: MediterraneanDietType,
  relCho = 0.15,
  relPro = 0.18,
) {
  const ctx = createMediterraneanDayContext("2026-05-31", undefined, undefined, diet);
  const meal = composeMediterraneanMeal(slot, target, ctx);
  assert.ok(meal.items.length >= 2, `${slot}/${diet}: almeno 2 voci`);
  const sums = summedMacros(meal.items);
  assertWithin(`${slot}/${diet} CHO`, sums.carbsG, target.carbsG, relCho, 12);
  assertWithin(`${slot}/${diet} PRO`, sums.proteinG, target.proteinG, relPro, 10);
  // I grassi sono il macro più piccolo: tolleranza assoluta più ampia.
  assertWithin(`${slot}/${diet} FAT`, sums.fatG, target.fatG, 0.35, 10);
}

test("colazione mediterranea centra i macro (esempio utente: 118 g CHO)", () => {
  runCase("breakfast", { kcal: 634, carbsG: 118, proteinG: 20, fatG: 18 }, "omnivore");
});

test("colazione macro standard", () => {
  runCase("breakfast", { kcal: 560, carbsG: 90, proteinG: 25, fatG: 14 }, "omnivore");
});

test("pranzo principale centra i macro (CHO alto → 2a fonte CHO)", () => {
  runCase("lunch", { kcal: 1050, carbsG: 150, proteinG: 45, fatG: 30 }, "omnivore");
});

test("cena principale vegana centra i macro", () => {
  runCase("dinner", { kcal: 820, carbsG: 110, proteinG: 35, fatG: 22 }, "vegan");
});

test("spuntino centra i macro", () => {
  runCase("snack_pm", { kcal: 240, carbsG: 32, proteinG: 12, fatG: 6 }, "omnivore", 0.2, 0.25);
});
