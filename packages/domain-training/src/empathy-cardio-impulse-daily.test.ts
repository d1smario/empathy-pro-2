import test from "node:test";
import assert from "node:assert/strict";
import { empathyCardioImpulseDailyFromSession } from "./empathy-cardio-impulse-daily";

test("zero when no HR", () => {
  assert.equal(empathyCardioImpulseDailyFromSession({ durationMinutes: 60, hrAvgBpm: null }), 0);
});

test("matches legacy hrStress in load-series for typical ride", () => {
  const hr = 140;
  const duration = 60;
  const legacy = Math.max(0, hr - 110) * (duration / 60) * 0.16;
  assert.equal(empathyCardioImpulseDailyFromSession({ durationMinutes: duration, hrAvgBpm: hr }), legacy);
});

test("floor blocks sub-threshold HR", () => {
  assert.equal(empathyCardioImpulseDailyFromSession({ durationMinutes: 120, hrAvgBpm: 100 }), 0);
});
