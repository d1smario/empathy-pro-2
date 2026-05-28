/**
 * Regression: composer breakfast generava item come
 *   "Smoothie colazione" portionHint = "200 ml latte + 1 mela media + 80 g frutti di bosco (frullato)"
 *   approxKcal = 320
 *
 * Il display mostrava 80 g / 71 kcal: il parser becca il primo `\d+ g` del portionHint e scala
 * i nutrienti come se l'intero compose fosse 80 g di un singolo ingrediente. Stessa cosa con
 * "Proteine in polvere" (plurale): la regex `whey_powder` matchava solo "proteina" → cadeva in
 * `generic_mixed` → 0 kcal / 0 g.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inferCanonicalFoodKey,
  looksLikeMultiIngredientPortionHint,
  nutrientsForMealPlanItem,
} from "@/lib/nutrition/canonical-food-composition";

test("inferCanonicalFoodKey: 'Proteine in polvere' (plurale) → whey_powder", () => {
  assert.equal(inferCanonicalFoodKey("Proteine in polvere"), "whey_powder");
  assert.equal(inferCanonicalFoodKey("Proteina in polvere"), "whey_powder");
  assert.equal(inferCanonicalFoodKey("Protein powder"), "whey_powder");
  assert.equal(inferCanonicalFoodKey("Whey 25 g"), "whey_powder");
});

test("looksLikeMultiIngredientPortionHint: compose con separatore '+' o piu' quantita'", () => {
  assert.equal(
    looksLikeMultiIngredientPortionHint("200 ml latte parzialmente scremato + 1 mela media + 80 g frutti di bosco (frullato)"),
    true,
  );
  assert.equal(looksLikeMultiIngredientPortionHint("200 ml latte + 30 g avena"), true);
  assert.equal(looksLikeMultiIngredientPortionHint("80 g frutti di bosco"), false);
  assert.equal(looksLikeMultiIngredientPortionHint("28 g proteine in polvere"), false);
  assert.equal(looksLikeMultiIngredientPortionHint(""), false);
});

test("nutrientsForMealPlanItem: Smoothie colazione (compose) scala per kcal, non per 80 g del primo ingrediente", () => {
  const res = nutrientsForMealPlanItem({
    name: "Smoothie colazione",
    portionHint: "200 ml latte parzialmente scremato + 1 mela media + 80 g frutti di bosco (frullato)",
    approxKcal: 320,
  });
  assert.equal(res.compositionStatus, "canonical_estimate");
  assert.ok(
    res.nutrients.kcal >= 250 && res.nutrients.kcal <= 360,
    `kcal atteso ~320, trovato ${res.nutrients.kcal} (regression: prima 71 kcal per parser del primo 'g')`,
  );
  assert.ok(res.nutrients.carbsG >= 30, `carbs attesi >=30 g, trovati ${res.nutrients.carbsG}`);
});

test("nutrientsForMealPlanItem: 'Proteine in polvere' 28 g produce kcal/PRO non-zero", () => {
  const res = nutrientsForMealPlanItem({
    name: "Proteine in polvere",
    portionHint: "28 g proteine in polvere",
    approxKcal: 110,
  });
  assert.equal(res.compositionKey, "whey_powder");
  assert.ok(res.nutrients.kcal > 80, `kcal attesi >80, trovati ${res.nutrients.kcal} (regression: prima 0)`);
  assert.ok(res.nutrients.proteinG >= 18, `PRO attesi >=18 g, trovati ${res.nutrients.proteinG} (regression: prima 0)`);
});
