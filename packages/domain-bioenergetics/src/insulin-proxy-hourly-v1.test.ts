import test from "node:test";
import assert from "node:assert/strict";
import {
  INSULIN_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  PRED_INSULIN_STIMULI_LITERATURE_MANIFEST_V1,
  buildInsulinProxyHourly24,
  buildInsulinStimulusPredictorSubhourlyV1,
  insulinStimulusPredictorSourceV1,
} from "./insulin-proxy-hourly-v1";

const kernel = {
  insulinDemandScore: 32,
  anabolicSuppressionScore: 18,
  glucoseHandlingScore: 55,
  oxidationDriveScore: 42,
  pathwayState: "mixed" as const,
};

test("contratto predittore insulinico v1 + manifest", () => {
  assert.equal(INSULIN_STIMULUS_PREDICTOR_CONTRACT_VERSION, 1);
  assert.equal(PRED_INSULIN_STIMULI_LITERATURE_MANIFEST_V1.length, 3);
});

test("buildInsulinStimulusPredictorSubhourlyV1: 288 punti, sorgente e range 0–100", () => {
  const pts = buildInsulinStimulusPredictorSubhourlyV1("2026-05-01", kernel, [], 5);
  assert.equal(pts.length, 288);
  const src = insulinStimulusPredictorSourceV1(5);
  assert.ok(pts.every((p) => p.source === src));
  assert.ok(pts.every((p) => p.value >= 0 && p.value <= 100));
});

test("buildInsulinProxyHourly24 è media oraria del predittore 5 min (coerenza interna)", () => {
  const date = "2026-05-01";
  const dense = buildInsulinStimulusPredictorSubhourlyV1(date, kernel, [], 5);
  const hourly = buildInsulinProxyHourly24(date, kernel, []);
  for (let h = 0; h < 24; h += 1) {
    const slice = dense.filter((p) => p.ts.slice(11, 13) === String(h).padStart(2, "0"));
    const mean = slice.reduce((s, p) => s + p.value, 0) / slice.length;
    assert.ok(Math.abs((hourly[h] ?? 0) - mean) < 0.06, `ora ${h}: hourly ≈ media 5m`);
  }
});

test("pasto con CHO/insulin_load alza proxy locale e orario rispetto a baseline", () => {
  const date = "2026-05-01";
  const meal = [
    { ts: "2026-05-01T08:15:00", type: "meal" as const, payload: { carbsG: 70, insulinLoad: 22 } },
  ];
  const empty = buildInsulinProxyHourly24(date, kernel, []);
  const withMeal = buildInsulinProxyHourly24(date, kernel, meal);
  assert.ok(withMeal[8]! > empty[8]!);
});
