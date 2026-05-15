import test from "node:test";
import assert from "node:assert/strict";
import { buildEmpathyFuelingExportV1 } from "./fueling-device-export-v1";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

const miniContract: Pro2BuilderSessionContract = {
  version: 1,
  source: "builder",
  family: "aerobic",
  discipline: "Cycling",
  sessionName: "fuel-json-test",
  summary: { durationSec: 5400, tss: 70, kcal: 500, kj: 2090, avgPowerW: 190 },
  renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 190, lengthMode: "time", speedRefKmh: 35 },
  blocks: [
    {
      id: "b1",
      label: "Endurance",
      kind: "steady",
      durationMinutes: 90,
      intensityCue: "Z2",
      chart: {
        minutes: 90,
        seconds: 0,
        intensity: "Z2",
        startIntensity: "Z2",
        endIntensity: "Z2",
        intensity2: "Z1",
        intensity3: "Z3",
        repeats: 1,
        workSeconds: 180,
        recoverSeconds: 90,
        step1Seconds: 60,
        step2Seconds: 60,
        step3Seconds: 60,
        pyramidSteps: 3,
        pyramidStepSeconds: 60,
        pyramidStartTarget: 150,
        pyramidEndTarget: 220,
        distanceKm: 0,
        gradePercent: 0,
        elevationMeters: 0,
        cadence: "",
        frequencyHint: "",
        loadFactor: 1,
      },
    },
  ],
};

test("buildEmpathyFuelingExportV1: shape v1", () => {
  const ex = buildEmpathyFuelingExportV1({
    sessionDate: "2026-06-01",
    plannedWorkoutId: "abc",
    contract: miniContract,
    durationMinutesDb: 90,
    tssTargetDb: 70,
    kcalTargetDb: 500,
  });
  assert.equal(ex.version, 1);
  assert.equal(ex.schema, "empathy_fueling_export_v1");
  assert.equal(ex.sessionDate, "2026-06-01");
  assert.ok(Array.isArray(ex.reminders));
  assert.ok(ex.reminders.length >= 1);
});
