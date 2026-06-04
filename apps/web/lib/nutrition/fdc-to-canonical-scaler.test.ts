import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFdcCanonicalSnapshotFromFoods,
  fdcCachedFoodToCanonical,
} from "./fdc-canonical-map";
import type { FdcCachedFood } from "./fdc-food-cache";

function mockFdcFood(overrides: Partial<FdcCachedFood> = {}): FdcCachedFood {
  return {
    fdcId: 171077,
    description: "Chicken, breast, meat only, raw",
    dataType: "SR Legacy",
    publicationDate: null,
    foodCategory: null,
    kcalPer100g: 120,
    carbsPer100g: 0,
    proteinPer100g: 22.5,
    fatPer100g: 2.6,
    fiberPer100g: 0,
    sugarsPer100g: 0,
    sodiumMgPer100g: 77,
    glycemicIndexEstimate: 30,
    insulinIndexEstimate: 35,
    glycemicLoadPer100g: 0,
    insulinLoadPer100g: 0,
    metabolicIndices: {},
    vitamins: [{ nutrientId: 1162, name: "Vitamin C, total ascorbic acid", amountPer100g: 0, unit: "mg" }],
    minerals: [{ nutrientId: 1087, name: "Calcium, Ca", amountPer100g: 11, unit: "mg" }],
    aminoAcids: [{ nutrientId: 1213, name: "Leucine", amountPer100g: 1.9, unit: "g" }],
    fattyAcids: [],
    otherNutrients: [],
    ...overrides,
  };
}

test("fdcCachedFoodToCanonical maps macros and micro buckets", () => {
  const canonical = fdcCachedFoodToCanonical(mockFdcFood());
  assert.equal(canonical.kcalPer100g, 120);
  assert.equal(canonical.proteinG, 22.5);
  assert.equal(canonical.ca_mg, 11);
  assert.equal(canonical.eaa_leu, 1.9);
});

test("buildFdcCanonicalSnapshotFromFoods: una query logica, skip key senza cache", () => {
  const food = mockFdcFood();
  const map = new Map<number, FdcCachedFood>([[171077, food]]);
  const snap = buildFdcCanonicalSnapshotFromFoods(["chicken_breast", "bread_white"], map);
  assert.ok(snap.chicken_breast);
  assert.equal(snap.chicken_breast.fdcId, 171077);
  assert.equal(snap.chicken_breast.canonical.proteinG, 22.5);
  assert.equal(snap.bread_white, undefined);
});
