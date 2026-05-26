import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateBlockDurationMinutes,
  patchLibraryContractBlock,
  scaleLibraryContractTiming,
  setLibraryContractPlannedDuration,
} from "./edit-library-contract";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

function intervalContract(): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "Run",
    sessionName: "Intervals",
    summary: { durationSec: 2400, tss: 50, kcal: 0, kj: 0, avgPowerW: 0 },
    blocks: [
      {
        id: "main",
        label: "4x4",
        kind: "interval2",
        durationMinutes: 32,
        chart: {
          minutes: 0,
          seconds: 0,
          intensity: "Z4",
          startIntensity: "Z4",
          endIntensity: "Z4",
          intensity2: "Z2",
          intensity3: "Z5",
          repeats: 4,
          workSeconds: 240,
          recoverSeconds: 180,
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
}

test("estimateBlockDurationMinutes: interval work+recover", () => {
  const block = intervalContract().blocks![0]!;
  assert.equal(estimateBlockDurationMinutes(block), 29);
});

test("patchLibraryContractBlock: +1 repeat lengthens block", () => {
  const out = patchLibraryContractBlock(intervalContract(), "main", { repeats: 5 });
  assert.equal(out.blocks![0]!.chart?.repeats, 5);
  assert.ok((out.blocks![0]!.durationMinutes ?? 0) >= 32);
});

test("scaleLibraryContractTiming: 1.1 increases work seconds", () => {
  const out = scaleLibraryContractTiming(intervalContract(), 1.1);
  assert.ok((out.blocks![0]!.chart?.workSeconds ?? 0) >= 264);
});

test("setLibraryContractPlannedDuration: caps at 720", () => {
  const out = setLibraryContractPlannedDuration(intervalContract(), 900);
  assert.equal(out.plannedSessionDurationMinutes, 720);
});
