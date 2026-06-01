import assert from "node:assert/strict";
import test from "node:test";
import { inferCanonicalFoodKey } from "@/lib/nutrition/canonical-food-composition";
import {
  listNutrientPathwaySwapsForSlot,
  uncoveredNutrientTargetsForSlot,
} from "@/lib/nutrition/nutrient-pathway-slot-registry";

test("folato colazione: nessun alimento in pool → integrazione", () => {
  assert.equal(listNutrientPathwaySwapsForSlot("folate_mcg", "breakfast", "omnivore").length, 0);
  const uncovered = uncoveredNutrientTargetsForSlot(["folate_mcg"], "breakfast", "omnivore");
  assert.equal(uncovered.length, 1);
  assert.equal(uncovered[0]?.nutrientId, "folate_mcg");
});

test("folato pranzo: verdure + legumi ammessi", () => {
  const pool = listNutrientPathwaySwapsForSlot("folate_mcg", "lunch", "omnivore");
  const keys = pool.map((p) => p.canonicalKey);
  assert.ok(keys.includes("spinach_raw"));
  assert.ok(keys.includes("chickpeas_cooked"));
  assert.ok(keys.includes("legumes_cooked"));
});

test("infer canonical: spinaci e kiwi risolvono a chiavi distinte", () => {
  assert.equal(inferCanonicalFoodKey("Spinaci freschi 150 g"), "spinach_raw");
  assert.equal(inferCanonicalFoodKey("Kiwi maturo"), "kiwi_raw");
  assert.equal(inferCanonicalFoodKey("Peperone rosso crudo"), "bell_pepper_red");
});

test("vit C spuntino: solo frutta ammessa", () => {
  const pool = listNutrientPathwaySwapsForSlot("vitC_mg", "snack_am", "omnivore");
  const fruitKeys = new Set(["kiwi_raw", "orange_raw", "strawberries_raw", "mixed_fruit"]);
  assert.ok(pool.length > 0);
  assert.ok(pool.every((p) => fruitKeys.has(p.canonicalKey)));
  assert.ok(pool.every((p) => !p.name.toLowerCase().includes("legum")));
});
