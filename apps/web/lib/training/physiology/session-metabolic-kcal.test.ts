import test from "node:test";
import assert from "node:assert/strict";
import type { Pro2BuilderSessionContract } from "../builder/pro2-session-contract";
import { metabolicKcalFromPro2BuilderContract } from "./session-metabolic-kcal";

function steadyZ2Contract(ftpW: number, durationMin: number): Pro2BuilderSessionContract {
  const durationSec = durationMin * 60;
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "cycling",
    sessionName: "ftp-energy-test",
    summary: { durationSec, tss: 80, kcal: 1, kj: 1, avgPowerW: 170 },
    renderProfile: { intensityUnit: "watt", ftpW, hrMax: 190, lengthMode: "time", speedRefKmh: 35 },
    blocks: [
      {
        id: "b1",
        label: "endurance",
        kind: "steady",
        durationMinutes: durationMin,
        intensityCue: "Z2",
        chart: {
          minutes: durationMin,
          seconds: 0,
          intensity: "Z2",
          startIntensity: "Z2",
          endIntensity: "Z2",
          intensity2: "Z1",
          intensity3: "Z1",
          repeats: 1,
          workSeconds: 180,
          recoverSeconds: 90,
          step1Seconds: 120,
          step2Seconds: 90,
          step3Seconds: 60,
          pyramidSteps: 5,
          pyramidStepSeconds: 180,
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
}

test("metabolicKcalFromPro2BuilderContract scales with athlete FTP, not hardcoded 250", () => {
  const contract = steadyZ2Contract(250, 120);
  const kcal250 = metabolicKcalFromPro2BuilderContract(contract, { athleteFtpWatts: 250 });
  const kcal320 = metabolicKcalFromPro2BuilderContract(contract, { athleteFtpWatts: 320 });
  assert.ok(kcal250 > 0);
  assert.ok(kcal320 > kcal250);
  assert.ok(Math.abs(kcal320 / kcal250 - 320 / 250) < 0.02);
});

test("athlete FTP overrides stale renderProfile FTP in contract", () => {
  const contract = steadyZ2Contract(250, 60);
  const fromAthlete = metabolicKcalFromPro2BuilderContract(contract, { athleteFtpWatts: 300 });
  const fromContractOnly = metabolicKcalFromPro2BuilderContract(contract);
  assert.ok(fromAthlete > fromContractOnly);
});
