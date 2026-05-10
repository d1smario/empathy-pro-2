import test from "node:test";
import assert from "node:assert/strict";
import {
  SIM_BANK_VERSION,
  activitySupportHours,
  buildInsulinProxyHourly24,
  buildMetabolicEndocrineInteractionReportV1,
  buildNominalCortisolActhHourly24,
  buildSimulatedGluLacDiurnal,
  mealGlycemicHourWeights24,
  simulatedLabNumeric,
} from "@empathy/domain-bioenergetics";

test("buildSimulatedGluLacDiurnal emette 24 punti in range e source sim_diurnal_v1", () => {
  const kernel = {
    insulinDemandScore: 40,
    anabolicSuppressionScore: 25,
    glucoseHandlingScore: 55,
    oxidationDriveScore: 45,
    pathwayState: "mixed" as const,
  };
  const { glucose, lactate } = buildSimulatedGluLacDiurnal("2026-05-10", kernel, []);
  assert.equal(glucose.length, 24);
  assert.equal(lactate.length, 24);
  for (const p of glucose) {
    assert.ok(p.value >= 3.9 && p.value <= 9.8);
    assert.equal(p.source, "sim_diurnal_v1");
  }
  for (const p of lactate) {
    assert.ok(p.value >= 0.75 && p.value <= 5.2);
  }
});

test("simulatedLabNumeric supporta tile note e null per id sconosciuto", () => {
  const k = {
    insulinDemandScore: 30,
    anabolicSuppressionScore: 20,
    glucoseHandlingScore: 60,
    oxidationDriveScore: 50,
    pathwayState: "supportive" as const,
  };
  assert.ok(simulatedLabNumeric("crp", k) != null);
  assert.equal(simulatedLabNumeric("unknown_tile_xyz", k), null);
});

test("SIM_BANK_VERSION è 1", () => {
  assert.equal(SIM_BANK_VERSION, 1);
});

test("metabolic interaction skeleton: senza pasti ghrelina blocked", () => {
  const r = buildMetabolicEndocrineInteractionReportV1({
    mealEntryCount: 0,
    mealWithMacroCount: 0,
    executedSessionCount: 0,
    plannedSessionCount: 0,
    stress01: 0.35,
    longestInterMealGapHours: null,
  });
  const ghrelin = r.nodes.find((n) => n.nodeId === "ghrelin");
  assert.equal(ghrelin?.observability, "blocked");
});

test("mealGlycemicHourWeights24 e glucosio sim rispondono a pasto con CHO/kcal", () => {
  const kernel = {
    insulinDemandScore: 40,
    anabolicSuppressionScore: 25,
    glucoseHandlingScore: 55,
    oxidationDriveScore: 45,
    pathwayState: "mixed" as const,
  };
  const meal = [{ ts: "2026-05-10T12:30:00", type: "meal", payload: { carbsG: 55, kcal: 520 } }];
  const w = mealGlycemicHourWeights24(meal);
  assert.ok(w[12] > 0.12 && w[13] > 0.05, "peso post-prandiale su h12–13");
  const baseline = buildSimulatedGluLacDiurnal("2026-05-10", kernel, []);
  const withMeal = buildSimulatedGluLacDiurnal("2026-05-10", kernel, meal);
  assert.ok(withMeal.glucose[12].value > baseline.glucose[12].value);
  assert.ok(withMeal.glucose[13].value >= baseline.glucose[13].value);
});

test("activitySupportHours copre start-1 e span da durationMinutes", () => {
  const tl = [{ ts: "2026-05-10T08:00:00", type: "executed_session", payload: { durationMinutes: 90 } }];
  const s = activitySupportHours(tl);
  assert.ok(s.has(7) && s.has(8) && s.has(9));
});

test("buildInsulinProxyHourly24 ha 24 punti e reagisce a pasto con CHO/insulin_load", () => {
  const kernel = {
    insulinDemandScore: 32,
    anabolicSuppressionScore: 18,
    glucoseHandlingScore: 55,
    oxidationDriveScore: 42,
    pathwayState: "mixed" as const,
  };
  const empty = buildInsulinProxyHourly24(kernel, []);
  assert.equal(empty.length, 24);
  const withMeal = buildInsulinProxyHourly24(kernel, [
    { ts: "2026-05-01T08:15:00", type: "meal", payload: { carbsG: 70, insulinLoad: 22 } },
  ]);
  assert.ok(withMeal[8] > empty[8]);
});

test("buildNominalCortisolActhHourly24 produce 24 punti per cortisolo e ACTH", () => {
  const k = {
    insulinDemandScore: 35,
    anabolicSuppressionScore: 22,
    glucoseHandlingScore: 58,
    oxidationDriveScore: 46,
    pathwayState: "mixed" as const,
  };
  const { cortisolUgdL, acthPgMl } = buildNominalCortisolActhHourly24(k);
  assert.equal(cortisolUgdL.length, 24);
  assert.equal(acthPgMl.length, 24);
  assert.ok(cortisolUgdL.every((v) => v >= 2 && v <= 26));
  assert.ok(acthPgMl.every((v) => v >= 5 && v <= 55));
  const imax = (arr: number[]) => arr.indexOf(Math.max(...arr));
  assert.ok(
    Math.abs(imax(cortisolUgdL) - imax(acthPgMl)) >= 2,
    "picco cortisolo ritardato rispetto ad ACTH (forme non sovrapposte)",
  );
});
