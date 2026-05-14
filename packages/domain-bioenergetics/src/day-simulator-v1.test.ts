import test from "node:test";
import assert from "node:assert/strict";
import {
  SIM_LAB_TILE_PARTIAL_SCALE_V1,
  buildNominalCortisolActhHourly24,
  buildNominalGhGhrelinHourly24,
  buildNominalIgf1LeptinHourly24,
  buildNominalThyroidTshFt4Hourly24,
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

test("buildSimulatedGluLacDiurnalSubHourly (10m) emette 144 punti: glucosio, lattato e insulin proxy da predittori stimoli v1", () => {
  const { glucose, lactate, insulinProxy } = buildSimulatedGluLacDiurnalSubHourly("2026-05-10", kernel, [], {}, 10);
  assert.equal(glucose.length, 144);
  assert.equal(lactate.length, 144);
  assert.equal(insulinProxy.length, 144);
  assert.ok(glucose.every((p) => p.source === "glucose_stimulus_predictor_v1_10m"));
  assert.ok(lactate.every((p) => p.source === "lactate_stimulus_predictor_v1_10m"));
  assert.ok(insulinProxy.every((p) => p.source === "insulin_stimulus_predictor_v1_10m"));
  assert.ok(glucose.every((p) => p.value >= 3.9 && p.value <= 9.8));
  assert.ok(insulinProxy.every((p) => p.value >= 0 && p.value <= 100));
});

test("buildSimulatedGluLacDiurnalSubHourly (5m) emette 288 punti: glucosio, lattato e insulin proxy da predittori stimoli v1", () => {
  const { glucose, lactate, insulinProxy } = buildSimulatedGluLacDiurnalSubHourly("2026-05-10", kernel, [], {}, 5);
  assert.equal(glucose.length, 288);
  assert.equal(lactate.length, 288);
  assert.equal(insulinProxy.length, 288);
  assert.ok(glucose.every((p) => p.source === "glucose_stimulus_predictor_v1_5m"));
  assert.ok(lactate.every((p) => p.source === "lactate_stimulus_predictor_v1_5m"));
  assert.ok(insulinProxy.every((p) => p.source === "insulin_stimulus_predictor_v1_5m"));
  assert.ok(glucose.every((p) => p.value >= 3.9 && p.value <= 9.8));
  assert.ok(insulinProxy.every((p) => p.value >= 0 && p.value <= 100));
});

test("glucosio sim senza pasti: notte non sta sopra il plateau diurno (no rampa artificiale 22→4)", () => {
  const empty = buildSimulatedGluLacDiurnalSubHourly("2026-05-10", kernel, [], {}, 5);
  const nightVals = empty.glucose
    .filter((_, i) => {
      const fh = (i * 5 + 2.5) / 60;
      return fh >= 23 || fh <= 4;
    })
    .map((p) => p.value);
  const dayVals = empty.glucose
    .filter((_, i) => {
      const fh = (i * 5 + 2.5) / 60;
      return fh >= 10 && fh <= 13;
    })
    .map((p) => p.value);
  const maxNight = Math.max(...nightVals);
  const maxDay = Math.max(...dayVals);
  assert.ok(maxNight <= maxDay + 0.08, "notte senza stimoli non deve essere più alta del giorno");
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

test("buildNominalGhGhrelinHourly24: pasto macro riduce ghrelina nell’ora prandiale vs baseline vuota", () => {
  const k = {
    insulinDemandScore: 38,
    anabolicSuppressionScore: 22,
    glucoseHandlingScore: 55,
    oxidationDriveScore: 46,
    pathwayState: "mixed" as const,
  };
  const empty = buildNominalGhGhrelinHourly24(k, []);
  const mealTl = [{ ts: "2026-05-01T12:00:00", type: "meal", payload: { carbsG: 80, kcal: 400 } }];
  const withMeal = buildNominalGhGhrelinHourly24(k, mealTl);
  assert.equal(empty.ghNgMl.length, 24);
  assert.equal(empty.ghrelinPgMl.length, 24);
  assert.ok(withMeal.ghrelinPgMl[12]! < empty.ghrelinPgMl[12]! - 2);
  assert.ok(Math.min(...empty.ghNgMl) !== Math.max(...empty.ghNgMl));
});

test("buildNominalIgf1LeptinHourly24: pasto macro alza leptina nell’ora prandiale; IGF-1 in range", () => {
  const k = {
    insulinDemandScore: 38,
    anabolicSuppressionScore: 22,
    glucoseHandlingScore: 55,
    oxidationDriveScore: 46,
    pathwayState: "mixed" as const,
  };
  const empty = buildNominalIgf1LeptinHourly24(k, []);
  const mealTl = [{ ts: "2026-05-01T12:00:00", type: "meal", payload: { carbsG: 80, kcal: 400 } }];
  const withMeal = buildNominalIgf1LeptinHourly24(k, mealTl);
  assert.equal(empty.igf1NgMl.length, 24);
  assert.equal(empty.leptinNgMl.length, 24);
  assert.ok(withMeal.leptinNgMl[12]! > empty.leptinNgMl[12]! + 0.02);
  assert.ok(empty.igf1NgMl.every((v) => v >= 48 && v <= 340));
  assert.ok(empty.leptinNgMl.every((v) => v >= 0.35 && v <= 6.2));
});

test("buildNominalThyroidTshFt4Hourly24: 24 punti, range plausibile, variazione diurna vs hold costante", () => {
  const k = {
    insulinDemandScore: 38,
    anabolicSuppressionScore: 22,
    glucoseHandlingScore: 55,
    oxidationDriveScore: 46,
    pathwayState: "mixed" as const,
  };
  const { tshMiuL, ft4NgDl } = buildNominalThyroidTshFt4Hourly24(k);
  assert.equal(tshMiuL.length, 24);
  assert.equal(ft4NgDl.length, 24);
  assert.ok(tshMiuL.every((v) => v >= 0.2 && v <= 10));
  assert.ok(ft4NgDl.every((v) => v >= 0.35 && v <= 3.5));
  assert.ok(Math.min(...tshMiuL) !== Math.max(...tshMiuL));
  assert.ok(Math.min(...ft4NgDl) !== Math.max(...ft4NgDl));
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
