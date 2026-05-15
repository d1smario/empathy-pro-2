import test from "node:test";
import assert from "node:assert/strict";
import {
  GLUCOSE_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  LACTATE_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  PRED_GLUCOSE_STIMULI_LITERATURE_MANIFEST_V1,
  PRED_LACTATE_STIMULI_LITERATURE_MANIFEST_V1,
  buildGlucoseStimulusPredictorSubhourlyV1,
  buildLactateStimulusPredictorSubhourlyV1,
  glucoseStimulusPredictorSourceV1,
  lactateStimulusPredictorSourceV1,
} from "./day-simulator-v1";

const kernel = {
  insulinDemandScore: 40,
  anabolicSuppressionScore: 20,
  glucoseHandlingScore: 50,
  oxidationDriveScore: 50,
  pathwayState: "supportive" as const,
};

test("contratto predittore glucosio v1 + manifest letteratura (placeholder refs)", () => {
  assert.equal(GLUCOSE_STIMULUS_PREDICTOR_CONTRACT_VERSION, 1);
  assert.equal(PRED_GLUCOSE_STIMULI_LITERATURE_MANIFEST_V1.length, 4);
  assert.ok(PRED_GLUCOSE_STIMULI_LITERATURE_MANIFEST_V1.every((e) => Array.isArray(e.refs)));
});

test("buildGlucoseStimulusPredictorSubhourlyV1: deterministico e sorgente versionata", () => {
  const a = buildGlucoseStimulusPredictorSubhourlyV1("2026-05-10", kernel, [], {}, 5);
  const b = buildGlucoseStimulusPredictorSubhourlyV1("2026-05-10", kernel, [], {}, 5);
  assert.deepEqual(a, b);
  assert.equal(a.length, 288);
  const src = glucoseStimulusPredictorSourceV1(5);
  assert.ok(a.every((p) => p.source === src));
});

test("predittore 5m: pasto 07:30 alza il massimo glicemico nella finestra post-prandiale vs baseline", () => {
  const date = "2026-05-10";
  const mealTl = [
    { ts: "2026-05-10T07:30:00", type: "meal" as const, payload: { carbsG: 80, kcal: 420, glycemicIndex: 75 } },
  ];
  const base = buildGlucoseStimulusPredictorSubhourlyV1(date, kernel, [], {}, 5);
  const withMeal = buildGlucoseStimulusPredictorSubhourlyV1(date, kernel, mealTl, { mealResponseScale01: 1 }, 5);
  const i0 = Math.floor((7 * 60 + 25) / 5);
  const i1 = Math.floor((10 * 60) / 5);
  const maxBase = Math.max(...base.slice(i0, i1 + 1).map((p) => p.value));
  const maxMeal = Math.max(...withMeal.slice(i0, i1 + 1).map((p) => p.value));
  assert.ok(maxMeal > maxBase + 0.08, "picco post-prandiale atteso sopra baseline nella stessa finestra oraria");
});

test("predittore 5m: blocco endurance abbassa glucosio vs baseline nella finestra attività", () => {
  const date = "2026-05-10";
  const tl = [{ ts: "2026-05-10T09:00:00", type: "executed_session" as const, payload: { durationMinutes: 240, tss: 95 } }];
  const base = buildGlucoseStimulusPredictorSubhourlyV1(date, kernel, [], {}, 5);
  const withAct = buildGlucoseStimulusPredictorSubhourlyV1(date, kernel, tl, { activityResponseScale01: 1 }, 5);
  const i0 = Math.floor((9 * 60 + 30) / 5);
  const i1 = Math.floor((11 * 60) / 5);
  const meanBase = base.slice(i0, i1 + 1).reduce((s, p) => s + p.value, 0) / (i1 - i0 + 1);
  const meanAct = withAct.slice(i0, i1 + 1).reduce((s, p) => s + p.value, 0) / (i1 - i0 + 1);
  assert.ok(meanAct < meanBase - 0.04, "attività sostenuta deve abbassare la media glicemica locale");
});

test("contratto predittore lattato v1 + manifest letteratura (placeholder refs)", () => {
  assert.equal(LACTATE_STIMULUS_PREDICTOR_CONTRACT_VERSION, 1);
  assert.equal(PRED_LACTATE_STIMULI_LITERATURE_MANIFEST_V1.length, 3);
  assert.ok(PRED_LACTATE_STIMULI_LITERATURE_MANIFEST_V1.every((e) => Array.isArray(e.refs)));
});

test("buildLactateStimulusPredictorSubhourlyV1: deterministico e sorgente versionata", () => {
  const a = buildLactateStimulusPredictorSubhourlyV1("2026-05-10", kernel, [], {}, 5);
  const b = buildLactateStimulusPredictorSubhourlyV1("2026-05-10", kernel, [], {}, 5);
  assert.deepEqual(a, b);
  assert.equal(a.length, 288);
  const src = lactateStimulusPredictorSourceV1(5);
  assert.ok(a.every((p) => p.source === src));
});

test("predittore lattato 5m: blocco endurance alza lattato vs baseline nella finestra attività", () => {
  const date = "2026-05-10";
  const tl = [{ ts: "2026-05-10T09:00:00", type: "executed_session" as const, payload: { durationMinutes: 240, tss: 95 } }];
  const base = buildLactateStimulusPredictorSubhourlyV1(date, kernel, [], {}, 5);
  const withAct = buildLactateStimulusPredictorSubhourlyV1(date, kernel, tl, { activityResponseScale01: 1 }, 5);
  const i0 = Math.floor((9 * 60 + 30) / 5);
  const i1 = Math.floor((11 * 60) / 5);
  const meanBase = base.slice(i0, i1 + 1).reduce((s, p) => s + p.value, 0) / (i1 - i0 + 1);
  const meanAct = withAct.slice(i0, i1 + 1).reduce((s, p) => s + p.value, 0) / (i1 - i0 + 1);
  assert.ok(meanAct > meanBase + 0.06, "endurance deve alzare il lattato medio locale");
});

test("predittore lattato 5m: pasto 07:30 abbassa la media locale vs baseline (dip post-prandiale modello)", () => {
  const date = "2026-05-10";
  const mealTl = [
    { ts: "2026-05-10T07:30:00", type: "meal" as const, payload: { carbsG: 80, kcal: 420, glycemicIndex: 75 } },
  ];
  const base = buildLactateStimulusPredictorSubhourlyV1(date, kernel, [], {}, 5);
  const withMeal = buildLactateStimulusPredictorSubhourlyV1(date, kernel, mealTl, { mealResponseScale01: 1 }, 5);
  const i0 = Math.floor((7 * 60 + 25) / 5);
  const i1 = Math.floor((10 * 60) / 5);
  const meanBase = base.slice(i0, i1 + 1).reduce((s, p) => s + p.value, 0) / (i1 - i0 + 1);
  const meanMeal = withMeal.slice(i0, i1 + 1).reduce((s, p) => s + p.value, 0) / (i1 - i0 + 1);
  assert.ok(meanMeal < meanBase - 0.02, "pasto con impulso glicemico deve abbassare leggermente il lattato medio locale");
});
