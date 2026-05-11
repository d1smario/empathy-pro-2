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

test("buildSimulatedGluLacDiurnalSubHourly (5m) emette 288 punti e sorgente sim_diurnal_v1_5m", () => {
  const { glucose, lactate } = buildSimulatedGluLacDiurnalSubHourly("2026-05-10", kernel, [], {}, 5);
  assert.equal(glucose.length, 288);
  assert.equal(lactate.length, 288);
  assert.ok(glucose.every((p) => p.source === "sim_diurnal_v1_5m"));
  assert.ok(glucose.every((p) => p.value >= 3.9 && p.value <= 9.8));
});

test("buildSimulatedGluLacDiurnalSubHourly 5m: pasto 7:30 + allenamento 9–13 modulano glucosio vs baseline", () => {
  const tl = [
    { ts: "2026-05-10T07:30:00", type: "meal", payload: { carbsG: 80, kcal: 420, glycemicIndex: 75 } },
    { ts: "2026-05-10T09:00:00", type: "executed_session", payload: { durationMinutes: 240, tss: 95 } },
  ];
  const empty = buildSimulatedGluLacDiurnalSubHourly("2026-05-10", kernel, [], {}, 5);
  const withCtx = buildSimulatedGluLacDiurnalSubHourly("2026-05-10", kernel, tl, { mealResponseScale01: 1, activityResponseScale01: 1 }, 5);
  const maxEmpty = Math.max(...empty.glucose.map((p) => p.value));
  const maxCtx = Math.max(...withCtx.glucose.map((p) => p.value));
  assert.ok(maxCtx > maxEmpty + 0.12, "pasti+seduta devono alzare il picco glucosio rispetto a baseline");
  const idx10h = 10 * 12;
  assert.ok(withCtx.lactate[idx10h]!.value > empty.lactate[idx10h]!.value + 0.08, "lattato durante blocco endurance > baseline");
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
