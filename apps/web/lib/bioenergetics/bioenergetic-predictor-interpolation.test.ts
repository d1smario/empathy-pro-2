import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPredictorCurvesDemoParseResult,
  expandHourly24ToFiveMinuteStream,
  interpolateFifteenMinuteSeriesToFiveMinuteStream,
} from "./bioenergetic-predictor-curves-ai";

test("interpolateFifteenMinuteSeriesToFiveMinuteStream: 96 → 288 e clamp", () => {
  const date = "2026-01-15";
  const v96 = Array.from({ length: 96 }, (_, i) => i / 95);
  const out = interpolateFifteenMinuteSeriesToFiveMinuteStream(date, v96, 0, 10);
  assert.equal(out.length, 288);
  assert.equal(out[0]!.observedAt, `${date}T00:00:00`);
  assert.equal(out[0]!.value, 0);
  assert.ok(out[287]!.value <= 1.001);
});

test("interpolateFifteenMinuteSeriesToFiveMinuteStream: lunghezza errata → []", () => {
  assert.equal(
    interpolateFifteenMinuteSeriesToFiveMinuteStream("2026-01-15", [1, 2], 0, 10).length,
    0,
  );
});

test("expandHourly24ToFiveMinuteStream: 288 punti, stesso valore per slot oraria", () => {
  const date = "2026-01-15";
  const hourly = Array.from({ length: 24 }, (_, h) => h);
  const out = expandHourly24ToFiveMinuteStream(date, hourly, 0, 50);
  assert.equal(out.length, 288);
  assert.equal(out[0]!.value, 0);
  assert.equal(out[11]!.value, 0);
  assert.equal(out[12]!.value, 1);
});

test("buildPredictorCurvesDemoParseResult: glucosio 96 se non skip", () => {
  const p = buildPredictorCurvesDemoParseResult(false);
  assert.equal(p.glucose96?.length, 96);
  assert.ok(p.disclaimerIt.length > 20);
});

test("buildPredictorCurvesDemoParseResult: glucosio omesso se skip CGM", () => {
  const p = buildPredictorCurvesDemoParseResult(true);
  assert.equal(p.glucose96, null);
  assert.equal(p.lactate96?.length, 96);
});
