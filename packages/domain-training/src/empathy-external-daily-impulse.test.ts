import test from "node:test";
import assert from "node:assert/strict";
import { empathyCardioImpulseDailyFromSession } from "./empathy-cardio-impulse-daily";
import { empathyExternalDailyImpulseFromSession } from "./empathy-external-daily-impulse";

test("prefer TSS when present", () => {
  assert.equal(empathyExternalDailyImpulseFromSession({ tss: 80, durationMinutes: 60, hrAvgBpm: 150 }), 80);
});

test("zero when no TSS and no cardio", () => {
  assert.equal(empathyExternalDailyImpulseFromSession({ tss: 0, durationMinutes: 60, hrAvgBpm: null }), 0);
});

test("pseudo load from HR when TSS zero", () => {
  const cardio = empathyCardioImpulseDailyFromSession({ durationMinutes: 60, hrAvgBpm: 140 });
  assert.equal(empathyExternalDailyImpulseFromSession({ tss: 0, durationMinutes: 60, hrAvgBpm: 140 }), cardio * 10);
});
