import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_FOOD_TABLE,
  scaleCanonicalNutrientsToGrams,
  scaleCanonicalNutrientsToKcal,
} from "@/lib/nutrition/canonical-food-composition";
import { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";

function reconcileKcal(scaledKcal: number, approxKcal: number): number {
  if (approxKcal <= 0) return scaledKcal;
  const deviation = Math.abs(scaledKcal - approxKcal) / Math.max(approxKcal, 1);
  return deviation > 0.2 ? approxKcal : scaledKcal;
}

test("nutrient coherence: riso 120g dry ~440 kcal (TS canonical)", () => {
  const row = CANONICAL_FOOD_TABLE.rice_dry!;
  const scaled = scaleCanonicalNutrientsToGrams(row, 120);
  assert.ok(scaled.kcal >= 400 && scaled.kcal <= 480, `kcal ${scaled.kcal}`);
  assert.ok(scaled.carbsG >= 90, `cho ${scaled.carbsG}`);
});

test("nutrient coherence: fallback approxKcal se deviazione >20%", () => {
  const row = CANONICAL_FOOD_TABLE.rice_dry!;
  const badScaled = scaleCanonicalNutrientsToGrams({ ...row, kcalPer100g: 900 }, 120);
  const finalKcal = reconcileKcal(badScaled.kcal, 438);
  const fixed = scaleCanonicalNutrientsToKcal(row, finalKcal);
  assert.ok(Math.abs(fixed.kcal - 438) <= 50, `kcal ${fixed.kcal}`);
});

test("staple rice macro plausibility", () => {
  const row = CANONICAL_FOOD_TABLE.rice_dry!;
  assert.ok(
    isPlausiblePer100gMacros({
      kcal_100: row.kcalPer100g,
      carbs_100: row.carbsG,
      protein_100: row.proteinG,
      fat_100: row.fatG,
    }),
  );
});

test("no single item >1500 kcal in pasta 120g dry fixture", () => {
  const row = CANONICAL_FOOD_TABLE.pasta_dry!;
  const scaled = scaleCanonicalNutrientsToGrams(row, 120);
  assert.ok(scaled.kcal < 1500);
});
