import assert from "node:assert/strict";
import test from "node:test";
import {
  inferEmpathyTrainingLoadForSession,
  trainingLoadFromPowerSession,
} from "./empathy-infer-training-load";

test("trainingLoadFromPowerSession: 1h at FTP ≈ 100", () => {
  const tl = trainingLoadFromPowerSession({ durationMinutes: 60, avgPowerW: 250, ftpW: 250 });
  assert.equal(tl, 100);
});

test("inferEmpathyTrainingLoadForSession: vendor wins", () => {
  assert.equal(
    inferEmpathyTrainingLoadForSession({
      vendorLoad: 85,
      durationMinutes: 60,
      hrAvgBpm: 150,
    }),
    85,
  );
});

test("inferEmpathyTrainingLoadForSession: HR proxy when no vendor", () => {
  const tl = inferEmpathyTrainingLoadForSession({
    vendorLoad: 0,
    durationMinutes: 60,
    hrAvgBpm: 140,
  });
  assert.ok(tl > 0 && tl <= 150);
});

test("inferEmpathyTrainingLoadForSession: duration-only fallback", () => {
  const tl = inferEmpathyTrainingLoadForSession({
    durationMinutes: 30,
    hrAvgBpm: null,
  });
  assert.ok(tl > 0 && tl <= 40);
});
