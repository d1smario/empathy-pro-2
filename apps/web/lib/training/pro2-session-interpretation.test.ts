import { test } from "node:test";
import assert from "node:assert/strict";
import { preparePro2BuilderSessionContractForPersist } from "./builder/pro2-session-interpretation";
import { serializePro2BuilderSessionContract } from "./builder/pro2-session-contract";
import type { Pro2BuilderSessionContract } from "./builder/pro2-session-contract";

const minimal: Pro2BuilderSessionContract = {
  version: 1,
  source: "builder",
  family: "aerobic",
  discipline: "Cycling",
  sessionName: "Test LT2",
  adaptationTarget: "lactate_tolerance",
  phase: "base",
  summary: { durationSec: 5400, tss: 100, kcal: 900, kj: 3800, avgPowerW: 200 },
  renderProfile: {
    intensityUnit: "watt",
    ftpW: 250,
    hrMax: 190,
    lengthMode: "time",
    speedRefKmh: 35,
  },
  blocks: [
    {
      id: "m",
      label: "Main",
      kind: "interval2",
      durationMinutes: 30,
      intensityCue: "LT2",
      chart: {
        minutes: 0,
        seconds: 0,
        intensity: "LT2",
        startIntensity: "",
        endIntensity: "",
        intensity2: "Z1",
        intensity3: "",
        repeats: 4,
        workSeconds: 300,
        recoverSeconds: 120,
        step1Seconds: 0,
        step2Seconds: 0,
        step3Seconds: 0,
        pyramidSteps: 0,
        pyramidStepSeconds: 0,
        pyramidStartTarget: 0,
        pyramidEndTarget: 0,
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

test("preparePro2BuilderSessionContractForPersist attaches sessionInterpretation", () => {
  const prepared = preparePro2BuilderSessionContractForPersist(minimal);
  assert.equal(prepared.sessionInterpretation?.modelVersion, 1);
  assert.ok((prepared.sessionInterpretation?.coachPrompts.length ?? 0) >= 2);
  assert.ok((prepared.sessionInterpretation?.sectors.length ?? 0) >= 3);
});

test("serializePro2BuilderSessionContract embeds sessionInterpretation in notes JSON", () => {
  const line = serializePro2BuilderSessionContract(minimal);
  assert.ok(line.includes("sessionInterpretation"));
  assert.ok(line.includes("coachPrompts"));
});
