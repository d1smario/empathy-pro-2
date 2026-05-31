import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPositionDelta,
  buildPositionScenarioMatrix,
  estimateCdaFromPositionSurrogate,
} from "./position-surrogate";

test("estimateCdaFromPositionSurrogate penalizes higher torso angle", () => {
  const low = estimateCdaFromPositionSurrogate({
    position: { torsoAngleDeg: 8, headDropMm: 40, elbowWidthMm: 320 },
    geometry: { frontalAreaM2: 0.36 },
    equipment: {},
  });
  const high = estimateCdaFromPositionSurrogate({
    position: { torsoAngleDeg: 18, headDropMm: 40, elbowWidthMm: 320 },
    geometry: { frontalAreaM2: 0.36 },
    equipment: {},
  });
  assert.ok(high > low);
});

test("same torso delta affects riders differently (AiRO lesson)", () => {
  const riderA = { torsoAngleDeg: 10, headDropMm: 35, elbowWidthMm: 300, shoulderWidthMm: 360 };
  const riderB = { torsoAngleDeg: 16, headDropMm: 55, elbowWidthMm: 340, shoulderWidthMm: 410 };
  const geometry = { frontalAreaM2: 0.37 };

  const baseA = estimateCdaFromPositionSurrogate({ position: riderA, geometry, equipment: {} });
  const baseB = estimateCdaFromPositionSurrogate({ position: riderB, geometry, equipment: {} });

  const deltaA = estimateCdaFromPositionSurrogate({
    position: applyPositionDelta(riderA, { torsoAngleDeg: 3 }),
    geometry,
    equipment: {},
  });
  const deltaB = estimateCdaFromPositionSurrogate({
    position: applyPositionDelta(riderB, { torsoAngleDeg: 3 }),
    geometry,
    equipment: {},
  });

  const changeA = deltaA - baseA;
  const changeB = deltaB - baseB;
  assert.notEqual(Math.sign(changeA), 0);
  assert.notEqual(changeA, changeB);
});

test("buildPositionScenarioMatrix returns baseline plus ranked candidates", () => {
  const compare = buildPositionScenarioMatrix({
    baselinePosition: { torsoAngleDeg: 12, headDropMm: 45, elbowWidthMm: 350 },
    baselineEquipment: { helmet: "road" },
    geometry: { frontalAreaM2: 0.38 },
    confidence01: 0.8,
    referenceSpeedKph: 45,
  });

  assert.equal(compare.version, "aero_scenario_compare_v1");
  assert.equal(compare.baselineScenarioId, "baseline");
  assert.ok(compare.candidates.length >= 4);
  const baseline = compare.candidates.find((row) => row.id === "baseline");
  assert.ok(baseline);
  assert.equal(baseline!.wattSavingsVsBaseline, 0);
});
