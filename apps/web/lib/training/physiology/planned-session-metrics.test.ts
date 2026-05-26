import test from "node:test";
import assert from "node:assert/strict";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";

function minimalAerobicContract(ftpW: number): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "ciclismo",
    sessionName: "Test",
    adaptationTarget: "endurance",
    phase: "base",
    plannedSessionDurationMinutes: 60,
    summary: { durationSec: 3600, tss: 0, kcal: 0, kj: 0, avgPowerW: 0 },
    renderProfile: { intensityUnit: "watt", ftpW, hrMax: 185, lengthMode: "time", speedRefKmh: 35 },
    blocks: [
      {
        id: "b1",
        label: "Steady",
        kind: "steady",
        durationMinutes: 60,
        intensityCue: "Z2",
        chart: { intensity: "Z2", durationSeconds: 3600 },
      },
    ],
  };
}

test("resolvePlannedSessionMetrics: higher FTP increases kcal for same contract", () => {
  const contract = minimalAerobicContract(250);
  const at250 = resolvePlannedSessionMetrics({ contract, athleteFtpWatts: 250 });
  const at300 = resolvePlannedSessionMetrics({ contract, athleteFtpWatts: 300 });
  assert.ok(at300.kcal > at250.kcal);
  assert.ok(at300.kj > at250.kj);
  assert.ok(at300.tss > 0);
  assert.equal(at300.durationMinutes, 60);
});
