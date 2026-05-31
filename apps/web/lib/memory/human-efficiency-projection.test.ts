import test from "node:test";
import assert from "node:assert/strict";
import { buildHumanEfficiencyFromLabMemory } from "./human-efficiency-projection";

test("buildHumanEfficiencyFromLabMemory composes from memory slices", () => {
  const score = buildHumanEfficiencyFromLabMemory({
    athleteId: "athlete-1",
    biomechanics: {
      latestSnapshot: {
        athleteId: "athlete-1",
        computedAt: "2026-05-30T12:00:00.000Z",
        disciplineCoverage: ["cycling"],
        riskScores: {},
        efficiencyScores: {
          biomechanicalEfficiency01: 0.75,
          movementQuality01: 0.7,
          symmetry01: 0.8,
          injuryRisk01: 0.2,
        },
        correctiveActionTags: [],
        confidence01: 0.9,
        algorithmVersion: "biomechanics_engine_v1",
      },
      historicalEvolution: [],
    },
    aerodynamics: {
      latestSnapshot: {
        athleteId: "athlete-1",
        computedAt: "2026-05-30T11:00:00.000Z",
        currentCdaM2: 0.3,
        equipment: {},
        position: {},
        scores: {
          cdaScore01: 0.65,
          positionScore01: 0.7,
          equipmentScore01: 0.6,
          aeroEfficiency01: 0.66,
        },
        confidence01: 0.85,
        algorithmVersion: "aerodynamics_engine_v1",
      },
      historicalEvolution: [],
    },
  });

  assert.ok(score);
  assert.ok(score!.globalHumanEfficiency01 > 0.6);
});
