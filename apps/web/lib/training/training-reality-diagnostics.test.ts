import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTrainingRealityDiagnostics } from "./training-reality-diagnostics";

test("flags preference mismatch when garmin rows exist but strava preferred", () => {
  const diag = summarizeTrainingRealityDiagnostics(
    [
      {
        date: "2026-05-15",
        source: "api_sync:garmin:activities",
        tss: 45,
        duration_minutes: 60,
        trace_summary: {},
      },
    ],
    { training_activity: "strava" },
    { endDate: "2026-05-16", windowDays: 7 },
  );
  assert.equal(diag.executedCountRaw, 1);
  assert.equal(diag.executedCountVisible, 0);
  assert.equal(diag.hiddenByTrainingPreference, 1);
  assert.equal(diag.hint, "preference_mismatch");
});

test("counts visible garmin sessions when preference matches", () => {
  const diag = summarizeTrainingRealityDiagnostics(
    [
      {
        date: "2026-05-15",
        source: "api_sync:garmin:activities",
        tss: 30,
        duration_minutes: 45,
        trace_summary: null,
      },
    ],
    { training_activity: "garmin" },
    { endDate: "2026-05-16", windowDays: 7 },
  );
  assert.equal(diag.executedCountVisible, 1);
  assert.equal(diag.sessionsWithExternalImpulse, 1);
  assert.equal(diag.hint, "none");
});

test("detects executed without load signal", () => {
  const diag = summarizeTrainingRealityDiagnostics(
    [
      {
        date: "2026-05-14",
        source: "api_sync:garmin:activities",
        tss: 0,
        duration_minutes: 20,
        trace_summary: {},
      },
    ],
    {},
    { endDate: "2026-05-16", windowDays: 7 },
  );
  assert.equal(diag.executedCountVisible, 1);
  assert.equal(diag.sessionsWithNoLoadSignal, 1);
  assert.equal(diag.hint, "executed_no_load_signal");
});
