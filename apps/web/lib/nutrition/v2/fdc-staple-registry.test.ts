import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_FOOD_TABLE } from "@/lib/nutrition/canonical-food-composition";
import { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";
import {
  pickStapleForPool,
  STAPLE_ALLOWLIST_BY_POOL,
  stapleRegistryKeysForPool,
} from "@/lib/nutrition/v2/fdc-staple-registry";

test("staple registry: ogni pool principale ha almeno 3 chiavi", () => {
  for (const key of ["breakfast_cho", "lunch_carb", "lunch_pro", "dinner_carb", "dinner_pro"]) {
    assert.ok(stapleRegistryKeysForPool(key).length >= 3, key);
  }
});

test("staple registry: macro plausibili per ogni entry", () => {
  for (const list of Object.values(STAPLE_ALLOWLIST_BY_POOL)) {
    for (const e of list) {
      const row = CANONICAL_FOOD_TABLE[e.canonicalKey];
      assert.ok(row?.kcalPer100g, e.canonicalKey);
      assert.ok(
        isPlausiblePer100gMacros({
          kcal_100: row.kcalPer100g,
          carbs_100: row.carbsG,
          protein_100: row.proteinG,
          fat_100: row.fatG,
        }),
        e.canonicalKey,
      );
    }
  }
});

test("pickStapleForPool: lunch carb non sceglie junk", () => {
  const pick = pickStapleForPool({ poolKey: "lunch_carb", seed: 42 });
  assert.ok(pick);
  assert.ok(!/chip|snack|beverage/i.test(pick.entry.labelIt));
  assert.ok(["pasta_dry", "rice_dry", "potato_cooked", "farro_dry", "quinoa_dry"].includes(pick.entry.canonicalKey));
});

test("pickStapleForPool: dedupe stesso carb (riso) pranzo+cena; pasta pranzo non blocca riso cena", () => {
  const usedRiso = new Set<string>(["carb:riso"]);
  const noRice = pickStapleForPool({
    poolKey: "dinner_carb",
    seed: 1,
    usedCarbFamilies: usedRiso,
  });
  assert.ok(!noRice || noRice.entry.canonicalKey !== "rice_dry");

  const usedPasta = new Set<string>(["carb:pasta"]);
  const dinnerAfterPastaLunch = pickStapleForPool({
    poolKey: "dinner_carb",
    seed: 1,
    usedCarbFamilies: usedPasta,
  });
  assert.ok(dinnerAfterPastaLunch);
  assert.equal(dinnerAfterPastaLunch!.entry.canonicalKey, "rice_dry");
});
