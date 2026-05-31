import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAerodynamicsOptimizationResult,
  buildCdAEstimate,
  computeAerodynamicsScores,
} from "@empathy/domain-aerodynamics";
import { parseAeroGeometryProposalV1, GEOMETRY_PROPOSAL_VERSION } from "./aero-geometry-cv-adapter";

test("aero apply path: geometry proposal to domain scores", () => {
  const proposal = parseAeroGeometryProposalV1({
    version: GEOMETRY_PROPOSAL_VERSION,
    confidence01: 0.76,
    provider: "test-aero",
    position: { torsoAngleDeg: 11, headDropMm: 42 },
    geometry: { frontalAreaM2: 0.36 },
    equipment: { helmet: "aero" },
    cdaSurrogateM2: 0.295,
  });

  const baselineCda = proposal.cdaSurrogateM2 ?? 0.3;
  const optimizedCda = Math.max(baselineCda - 0.04, baselineCda * 0.92);
  const cdaEstimate = buildCdAEstimate({
    cdaM2: baselineCda,
    speedKph: 45,
    confidence01: proposal.confidence01,
    method: "surrogate_model",
  });
  const optimization = buildAerodynamicsOptimizationResult({
    baselineCdaM2: baselineCda,
    optimizedCdaM2: optimizedCda,
    referenceSpeedKph: 45,
    confidence01: 0.7,
    changedVariables: ["torsoAngleDeg"],
  });
  const scores = computeAerodynamicsScores({
    cdaM2: baselineCda,
    optimizedCdaM2: optimizedCda,
    positionConfidence01: 0.7,
    equipmentConfidence01: 0.68,
  });

  assert.equal(cdaEstimate.cdaM2, 0.295);
  assert.ok(optimization.wattSavingsAtReferenceSpeed >= 0);
  assert.ok(scores.aeroEfficiency01 > 0);
});
