import assert from "node:assert/strict";
import test from "node:test";
import { pro2BuilderContractToExpandedChartSegments } from "./pro2-contract-chart-segments";
import type { Pro2BuilderSessionContract } from "./pro2-session-contract";

function minimalContract(blocks: Pro2BuilderSessionContract["blocks"]): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "cycling",
    sessionName: "Test",
    summary: { durationSec: 3600, tss: 80, kcal: 0, kj: 0, avgPowerW: 200 },
    renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 185, lengthMode: "time", speedRefKmh: 32 },
    blocks,
  };
}

test("expanded chart: interval2 yields work + recovery segments per repeat", () => {
  const contract = minimalContract([
    {
      id: "w",
      label: "Riscaldamento",
      kind: "ramp",
      durationMinutes: 12,
      chart: {
        minutes: 12,
        seconds: 0,
        intensity: "Z1",
        startIntensity: "Z1",
        endIntensity: "Z2",
        intensity2: "Z1",
        intensity3: "Z5",
        repeats: 1,
        workSeconds: 0,
        recoverSeconds: 0,
        step1Seconds: 0,
        step2Seconds: 0,
        step3Seconds: 0,
        pyramidSteps: 1,
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
    {
      id: "m",
      label: "Serie principali",
      kind: "interval2",
      durationMinutes: 45,
      intensityCue: "PRESET_VO2_Z5",
      chart: {
        minutes: 45,
        seconds: 0,
        intensity: "Z5",
        startIntensity: "Z5",
        endIntensity: "Z5",
        intensity2: "Z1",
        intensity3: "Z5",
        repeats: 3,
        workSeconds: 120,
        recoverSeconds: 90,
        step1Seconds: 0,
        step2Seconds: 0,
        step3Seconds: 0,
        pyramidSteps: 1,
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
    {
      id: "c",
      label: "Defaticamento",
      kind: "ramp",
      durationMinutes: 10,
      chart: {
        minutes: 10,
        seconds: 0,
        intensity: "Z2",
        startIntensity: "Z2",
        endIntensity: "Z1",
        intensity2: "Z1",
        intensity3: "Z5",
        repeats: 1,
        workSeconds: 0,
        recoverSeconds: 0,
        step1Seconds: 0,
        step2Seconds: 0,
        step3Seconds: 0,
        pyramidSteps: 1,
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
  ]);

  const segs = pro2BuilderContractToExpandedChartSegments(contract);
  assert.ok(segs.length >= 7, `expected warm + 3×(work+rec) + cool, got ${segs.length}`);
  assert.ok(segs.some((s) => /lavoro/i.test(s.label)));
  assert.ok(segs.some((s) => /recupero/i.test(s.label)));
  assert.ok(segs[0]!.label.includes("Riscaldamento"));
  assert.ok(segs[segs.length - 1]!.label.includes("Defaticamento"));
});
