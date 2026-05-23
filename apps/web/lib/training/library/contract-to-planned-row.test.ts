import test from "node:test";
import assert from "node:assert/strict";
import { contractToPlannedWorkoutRow } from "./contract-to-planned-row";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

function minimalContract(): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "Cycling",
    sessionName: "Test library",
    summary: { durationSec: 3600, tss: 55, kcal: 400, kj: 1670, avgPowerW: 180 },
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
  };
}

test("contractToPlannedWorkoutRow: notes include library meta + BUILDER_SESSION_JSON", () => {
  const row = contractToPlannedWorkoutRow({
    athleteId: "athlete-1",
    date: "2026-05-20",
    contract: minimalContract(),
    libraryItemId: "lib-item-99",
  });
  assert.equal(row.athlete_id, "athlete-1");
  assert.equal(row.date, "2026-05-20");
  assert.equal(row.tss_target, 55);
  assert.ok(row.notes?.includes("[PRO2_BUILDER_LIBRARY]"));
  assert.ok(row.notes?.includes("lib-item-99"));
  assert.ok(row.notes?.includes("BUILDER_SESSION_JSON"));
  const parsed = parsePro2BuilderSessionFromNotes(row.notes);
  assert.equal(parsed?.sessionName, "Test library");
});
