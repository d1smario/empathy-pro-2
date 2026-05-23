import test from "node:test";
import assert from "node:assert/strict";
import { scaleLibraryContract } from "./scale-library-contract";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

function contract(): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "Run",
    sessionName: "Scale test",
    summary: { durationSec: 3600, tss: 100, kcal: 500, kj: 2000, avgPowerW: 200 },
    renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 190, lengthMode: "time", speedRefKmh: 35 },
    blocks: [
      {
        id: "b1",
        label: "Main",
        kind: "steady",
        durationMinutes: 60,
        intensityCue: "Z3",
        chart: {
          minutes: 60,
          seconds: 0,
          intensity: "Z3",
          startIntensity: "Z3",
          endIntensity: "Z3",
          intensity2: "Z1",
          intensity3: "Z5",
          repeats: 1,
          workSeconds: 300,
          recoverSeconds: 120,
          step1Seconds: 120,
          step2Seconds: 90,
          step3Seconds: 60,
          pyramidSteps: 5,
          pyramidStepSeconds: 180,
          pyramidStartTarget: 100,
          pyramidEndTarget: 200,
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
}

test("scaleLibraryContract: 0.8 reduces tss and duration", () => {
  const scaled = scaleLibraryContract(contract(), 0.8);
  assert.equal(scaled.summary?.tss, 80);
  assert.equal(scaled.blocks[0]?.durationMinutes, 48);
});

test("scaleLibraryContract: 1.0 is identity", () => {
  const base = contract();
  const scaled = scaleLibraryContract(base, 1);
  assert.equal(scaled.summary?.tss, base.summary?.tss);
});
