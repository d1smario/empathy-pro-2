import test from "node:test";
import assert from "node:assert/strict";
import { buildAeroScenarioCompareFromProposal } from "./aero-scenario-runner";

test("goldenAeroScenarioCompare builds candidates from proposal shape", () => {
  const compare = buildAeroScenarioCompareFromProposal({
    version: "geometry_proposal_v1",
    confidence01: 0.78,
    provider: "test-geometry",
    position: { torsoAngleDeg: 12, headDropMm: 45, elbowWidthMm: 350 },
    equipment: { helmet: "road" },
    geometry: { frontalAreaM2: 0.38 },
  });
  assert.equal(compare.version, "aero_scenario_compare_v1");
  assert.ok(compare.candidates.some((row) => row.id === "baseline"));
});
