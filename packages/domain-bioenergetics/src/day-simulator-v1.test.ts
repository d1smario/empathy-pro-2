import test from "node:test";
import assert from "node:assert/strict";
import {
  SIM_LAB_TILE_PARTIAL_SCALE_V1,
  buildNominalCortisolActhHourly24,
  buildSimulatedGluLacDiurnalSubHourly,
  scaleSimulatedLabNumericForSkeletonPartialV1,
  simulatedLabNumeric,
} from "./day-simulator-v1";

const kernel = {
  insulinDemandScore: 40,
  anabolicSuppressionScore: 20,
  glucoseHandlingScore: 50,
  oxidationDriveScore: 50,
  pathwayState: "supportive" as const,
};

test("scaleSimulatedLabNumericForSkeletonPartialV1 applica coefficiente v1 fisso", () => {
  assert.equal(SIM_LAB_TILE_PARTIAL_SCALE_V1, 0.82);
  assert.equal(scaleSimulatedLabNumericForSkeletonPartialV1(100), 82);
  assert.equal(scaleSimulatedLabNumericForSkeletonPartialV1(1.234), 1.012);
});

test("simulatedLabNumeric ghrelin coerente con stress/pathway (golden regressione)", () => {
  const g = simulatedLabNumeric("ghrelin", kernel);
  assert.ok(typeof g === "number" && g > 400 && g < 500);
});

test("buildSimulatedGluLacDiurnalSubHourly (10m) emette 144 punti e sorgente sim_diurnal_v1_10m", () => {
  const { glucose, lactate } = buildSimulatedGluLacDiurnalSubHourly("2026-05-10", kernel, [], {}, 10);
  assert.equal(glucose.length, 144);
  assert.equal(lactate.length, 144);
  assert.ok(glucose.every((p) => p.source === "sim_diurnal_v1_10m"));
  assert.ok(glucose.every((p) => p.value >= 3.9 && p.value <= 9.8));
});

test("buildNominalCortisolActhHourly24: mealLoad01 aumenta cortisolo pomeridiano vs baseline", () => {
  const k = {
    insulinDemandScore: 38,
    anabolicSuppressionScore: 22,
    glucoseHandlingScore: 55,
    oxidationDriveScore: 46,
    pathwayState: "mixed" as const,
  };
  const base = buildNominalCortisolActhHourly24(k);
  const mod = buildNominalCortisolActhHourly24(k, { postprandialMealLoad01: 1 });
  assert.ok(mod.cortisolUgdL[15]! > base.cortisolUgdL[15]!);
  assert.ok(mod.acthPgMl.some((v, h) => h <= 5 && v !== base.acthPgMl[h]), "ACTH modulata nelle ore centrali con mealLoad");
});
