import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeStructuredIntervalRowsToFitWorkout,
  pro2BuilderContractToStructuredIntervalRows,
  serializePro2BuilderContractToZwo,
} from "./planned-structured-export";
import type { Pro2BuilderSessionContract } from "./builder/pro2-session-contract";

function baseAerobicContract(overrides: Partial<Pro2BuilderSessionContract> = {}): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "Cycling",
    sessionName: "export-test",
    summary: { durationSec: 3600, tss: 60, kcal: 400, kj: 1670, avgPowerW: 180 },
    renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 190, lengthMode: "time", speedRefKmh: 35 },
    blocks: [
      {
        id: "b1",
        label: "Warm",
        kind: "steady",
        durationMinutes: 10,
        intensityCue: "Z2",
        chart: {
          minutes: 10,
          seconds: 0,
          intensity: "Z2",
          startIntensity: "Z2",
          endIntensity: "Z2",
          intensity2: "Z1",
          intensity3: "Z3",
          repeats: 1,
          workSeconds: 180,
          recoverSeconds: 90,
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
    ...overrides,
  };
}

test("pro2BuilderContractToStructuredIntervalRows: steady Z2 row", () => {
  const c = baseAerobicContract();
  const rows = pro2BuilderContractToStructuredIntervalRows(c);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.durationSec, 600);
  assert.equal(rows[0]!.kind, "steady");
  assert.ok(rows[0]!.powerAvgW > 100 && rows[0]!.powerAvgW < 220);
});

test("encodeStructuredIntervalRowsToFitWorkout: Garmin header .FIT", () => {
  const rows = pro2BuilderContractToStructuredIntervalRows(
    baseAerobicContract({
      blocks: [
        {
          id: "s1",
          label: "Block",
          kind: "steady",
          durationMinutes: 2,
          intensityCue: "Z3",
          chart: {
            minutes: 2,
            seconds: 0,
            intensity: "Z3",
            startIntensity: "Z3",
            endIntensity: "Z3",
            intensity2: "Z1",
            intensity3: "Z5",
            repeats: 1,
            workSeconds: 120,
            recoverSeconds: 60,
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
    }),
  );
  const buf = encodeStructuredIntervalRowsToFitWorkout({
    wktName: "RT",
    ftpW: 250,
    rows,
  });
  assert.ok(buf.length >= 14);
  assert.equal(buf.slice(8, 12).toString("ascii"), ".FIT");
});

test("serializePro2BuilderContractToZwo contains workout and SteadyState", () => {
  const z = serializePro2BuilderContractToZwo(baseAerobicContract());
  assert.match(z, /<workout_file>/i);
  assert.match(z, /<SteadyState /i);
  assert.match(z, /Power="/);
});
