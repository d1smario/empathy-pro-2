import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAerodynamicsMemoryFromTestRows,
  buildBiomechanicsMemoryFromSessionRows,
} from "./biomech-aero-memory-projections";

test("buildBiomechanicsMemoryFromSessionRows projects latest confirmed session into memory", () => {
  const memory = buildBiomechanicsMemoryFromSessionRows("athlete-1", [
    {
      id: "session-1",
      recorded_at: "2026-05-30T10:00:00.000Z",
      payload: {
        confidence01: 0.82,
        algorithmVersion: "biomechanics_engine_v1",
        efficiencyScores: {
          biomechanicalEfficiency01: 0.72,
          movementQuality01: 0.8,
          symmetry01: 0.7,
          injuryRisk01: 0.35,
        },
        riskScores: {
          kneeRisk01: 0.3,
          lumbarRisk01: 0.2,
        },
        correctiveActionTags: ["knee_tracking", "pelvic_stability"],
      },
    },
  ]);

  assert.equal(memory.latestSnapshot?.athleteId, "athlete-1");
  assert.equal(memory.latestSnapshot?.latestSessionImportId, "session-1");
  assert.equal(memory.latestSnapshot?.efficiencyScores.biomechanicalEfficiency01, 0.72);
  assert.equal(memory.latestSnapshot?.riskScores.kneeRisk01, 0.3);
  assert.equal(memory.historicalEvolution?.length, 1);
});

test("buildBiomechanicsMemoryFromSessionRows ignores rows without engine scores", () => {
  const memory = buildBiomechanicsMemoryFromSessionRows("athlete-1", [
    {
      id: "session-raw",
      recorded_at: "2026-05-30T10:00:00.000Z",
      payload: { landmarks: [] },
    },
  ]);

  assert.equal(memory.latestSnapshot, null);
  assert.deepEqual(memory.historicalEvolution, []);
});

test("buildAerodynamicsMemoryFromTestRows projects CdA baseline into memory", () => {
  const memory = buildAerodynamicsMemoryFromTestRows("athlete-1", [
    {
      id: "aero-1",
      schema_version: 1,
      recorded_at: "2026-05-30T11:00:00.000Z",
      position: { torsoAngleDeg: 12 },
      equipment: { helmet: "aero" },
      cda_estimate: {
        cdaM2: 0.285,
        confidence01: 0.76,
      },
      optimization: {
        optimizedCdaM2: 0.255,
      },
      scores: {
        cdaScore01: 0.62,
        positionScore01: 0.7,
        equipmentScore01: 0.6,
        aeroEfficiency01: 0.66,
      },
    },
  ]);

  assert.equal(memory.latestSnapshot?.athleteId, "athlete-1");
  assert.equal(memory.latestSnapshot?.latestTestSessionId, "aero-1");
  assert.equal(memory.latestSnapshot?.currentCdaM2, 0.285);
  assert.equal(memory.latestSnapshot?.optimizedCdaM2, 0.255);
  assert.equal(memory.latestSnapshot?.scores.aeroEfficiency01, 0.66);
  assert.equal(memory.historicalEvolution?.length, 1);
});

test("buildAerodynamicsMemoryFromTestRows ignores incomplete test rows", () => {
  const memory = buildAerodynamicsMemoryFromTestRows("athlete-1", [
    {
      id: "aero-raw",
      recorded_at: "2026-05-30T11:00:00.000Z",
      cda_estimate: { cdaM2: 0.3 },
      scores: null,
    },
  ]);

  assert.equal(memory.latestSnapshot, null);
  assert.deepEqual(memory.historicalEvolution, []);
});
