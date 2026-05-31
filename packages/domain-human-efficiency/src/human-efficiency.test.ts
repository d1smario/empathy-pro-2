import test from "node:test";
import assert from "node:assert/strict";
import { computeHumanEfficiencyScoreV1 } from "./index";

test("computeHumanEfficiencyScoreV1 composes biomech + aero snapshots", () => {
  const score = computeHumanEfficiencyScoreV1({
    athleteId: "athlete-1",
    computedAt: "2026-05-30T12:00:00.000Z",
    biomechanicsSnapshot: {
      athleteId: "athlete-1",
      computedAt: "2026-05-30T11:00:00.000Z",
      disciplineCoverage: ["cycling"],
      riskScores: {},
      efficiencyScores: {
        biomechanicalEfficiency01: 0.8,
        movementQuality01: 0.75,
        symmetry01: 0.7,
        injuryRisk01: 0.2,
      },
      correctiveActionTags: [],
      confidence01: 0.9,
      algorithmVersion: "biomechanics_engine_v1",
    },
    aerodynamicsSnapshot: {
      athleteId: "athlete-1",
      computedAt: "2026-05-30T10:00:00.000Z",
      currentCdaM2: 0.29,
      equipment: {},
      position: {},
      scores: {
        cdaScore01: 0.7,
        positionScore01: 0.72,
        equipmentScore01: 0.65,
        aeroEfficiency01: 0.68,
      },
      confidence01: 0.85,
      algorithmVersion: "aerodynamics_engine_v1",
    },
    physiologicalReadiness01: 0.74,
  });

  assert.ok(score);
  assert.equal(score!.mechanicalEfficiency01, 0.8);
  assert.equal(score!.aerodynamicEfficiency01, 0.68);
  assert.ok(score!.globalHumanEfficiency01 > 0.6);
});

test("computeHumanEfficiencyScoreV1 returns null without inputs", () => {
  assert.equal(computeHumanEfficiencyScoreV1({ athleteId: "a" }), null);
});
