import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateRiskScore,
  computeBiomechanicsEfficiencyScores,
  movementQualityScore,
  summarizeJointAngles,
  symmetryScoreFromBilateralAngles,
} from "./index";
import type { BiomechanicsJointAngleSample } from "@empathy/contracts";

const bilateralCyclingKneeFixture: BiomechanicsJointAngleSample[] = [
  { joint: "knee", side: "left", angleDeg: 142, phasePct: 0 },
  { joint: "knee", side: "left", angleDeg: 96, phasePct: 50 },
  { joint: "knee", side: "right", angleDeg: 138, phasePct: 0 },
  { joint: "knee", side: "right", angleDeg: 94, phasePct: 50 },
  { joint: "hip", side: "left", angleDeg: 54, phasePct: 0 },
  { joint: "hip", side: "right", angleDeg: 50, phasePct: 0 },
];

test("summarizeJointAngles computes envelopes per joint and side", () => {
  const envelopes = summarizeJointAngles(bilateralCyclingKneeFixture);
  const leftKnee = envelopes.find((row) => row.joint === "knee" && row.side === "left");

  assert.ok(leftKnee);
  assert.equal(leftKnee.minDeg, 96);
  assert.equal(leftKnee.maxDeg, 142);
  assert.equal(leftKnee.rangeDeg, 46);
  assert.equal(leftKnee.meanDeg, 119);
  assert.equal(leftKnee.samples, 2);
});

test("symmetryScoreFromBilateralAngles penalizes mean left/right divergence", () => {
  const score = symmetryScoreFromBilateralAngles(bilateralCyclingKneeFixture);
  assert.ok(Math.abs(score - 0.825) < 1e-9);
});

test("movementQualityScore averages positive movement signals and penalizes compensations", () => {
  const score = movementQualityScore({
    pelvicStability01: 0.8,
    kneeTracking01: 0.7,
    ankleDynamics01: 0.6,
    rangeOfMotion01: 0.9,
    compensationFlags: ["dynamic_valgus"],
  });

  assert.ok(Math.abs(score - 0.7) < 1e-9);
});

test("aggregateRiskScore uses the highest canonical risk channel", () => {
  assert.equal(aggregateRiskScore({ kneeRisk01: 0.2, lumbarRisk01: 0.65, achillesRisk01: 0.4 }), 0.65);
});

test("computeBiomechanicsEfficiencyScores combines quality, symmetry and inverse risk", () => {
  const scores = computeBiomechanicsEfficiencyScores({
    jointAngles: bilateralCyclingKneeFixture,
    movementPatterns: {
      pelvicStability01: 0.8,
      kneeTracking01: 0.7,
      ankleDynamics01: 0.6,
      rangeOfMotion01: 0.9,
      compensationFlags: ["dynamic_valgus"],
    },
    riskScores: { kneeRisk01: 0.2, lumbarRisk01: 0.65, achillesRisk01: 0.4 },
  });

  assert.ok(Math.abs(scores.movementQuality01 - 0.7) < 1e-9);
  assert.ok(Math.abs(scores.symmetry01 - 0.825) < 1e-9);
  assert.equal(scores.injuryRisk01, 0.65);
  assert.ok(Math.abs(scores.biomechanicalEfficiency01 - 0.67375) < 1e-9);
});
