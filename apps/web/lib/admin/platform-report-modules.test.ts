import assert from "node:assert/strict";
import test from "node:test";
import type { AdminAthleteActivityRollup } from "@/lib/admin/load-activity-rollups";
import { computeModuleAdoption, modulesUsedFromRollup } from "@/lib/admin/platform-report-modules";

const emptyRollup: AdminAthleteActivityRollup = {
  athleteId: "a1",
  executedWorkoutsCount: 0,
  executedLastDate: null,
  plannedWorkoutsCount: 0,
  plannedLastDate: null,
  foodDiaryEntriesCount: 0,
  foodDiaryLastEntryDate: null,
  biomarkerPanelsCount: 0,
  biomarkerLastSampleDate: null,
  deviceSyncExportsCount: 0,
  deviceSyncLastAt: null,
  garminPullJobsTotal: 0,
  garminPullJobsCompleted: 0,
  garminPullJobsFailed: 0,
  garminPullJobsLastAt: null,
  garminAthleteLinked: false,
  garminActivityBlobsCount: 0,
  garminActivityBlobsLastAt: null,
  interpretationStagingRunsCount: 0,
  interpretationStagingLastAt: null,
  trainingImportJobsCount: 0,
  trainingImportJobsLastAt: null,
};

test("modulesUsedFromRollup: empty → nessun modulo", () => {
  assert.deepEqual(modulesUsedFromRollup(emptyRollup), []);
});

test("modulesUsedFromRollup: training da executed count", () => {
  const mods = modulesUsedFromRollup({ ...emptyRollup, executedWorkoutsCount: 2 });
  assert.ok(mods.includes("training"));
});

test("modulesUsedFromRollup: bioenergetics da time-series count", () => {
  const mods = modulesUsedFromRollup(emptyRollup, 3);
  assert.ok(mods.includes("bioenergetics"));
});

test("computeModuleAdoption: percentuali su due atleti", () => {
  const rollups = new Map<string, AdminAthleteActivityRollup>([
    ["a1", { ...emptyRollup, athleteId: "a1", foodDiaryEntriesCount: 1 }],
    ["a2", { ...emptyRollup, athleteId: "a2", executedWorkoutsCount: 1 }],
  ]);
  const tsCounts = new Map<string, number>([["a2", 5]]);
  const adoption = computeModuleAdoption(["a1", "a2"], rollups, tsCounts);
  const training = adoption.find((m) => m.moduleId === "training");
  const nutrition = adoption.find((m) => m.moduleId === "nutrition");
  const bio = adoption.find((m) => m.moduleId === "bioenergetics");
  assert.equal(training?.athletesActive, 1);
  assert.equal(training?.pct, 50);
  assert.equal(nutrition?.athletesActive, 1);
  assert.equal(bio?.athletesActive, 1);
});
