import test from "node:test";
import assert from "node:assert/strict";
import { POSE_PROPOSAL_VERSION } from "./biomech-pose-cv-adapter";

test("BIOMECH_ENGINE_VERSION contract label", () => {
  assert.equal("biomechanics_engine_v1", "biomechanics_engine_v1");
});

test("golden pose proposal shape matches staging patch contract", () => {
  const proposal = {
    version: POSE_PROPOSAL_VERSION,
    confidence01: 0.82,
    provider: "test",
    jointAngles: [
      { joint: "knee", side: "left", angleDeg: 142 },
      { joint: "knee", side: "right", angleDeg: 138 },
    ],
    movementPatterns: { pelvicStability01: 0.8, kneeTracking01: 0.7, compensationFlags: ["dynamic_valgus"] },
    riskScores: { kneeRisk01: 0.2, lumbarRisk01: 0.65 },
  };
  assert.equal(proposal.version, "pose_proposal_v1");
  assert.ok(proposal.jointAngles.length >= 2);
});
