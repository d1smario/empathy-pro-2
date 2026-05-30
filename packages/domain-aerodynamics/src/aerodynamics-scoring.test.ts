import test from "node:test";
import assert from "node:assert/strict";
import {
  aerodynamicDragWatts,
  buildAerodynamicsOptimizationResult,
  buildCdAEstimate,
  computeAerodynamicsScores,
  estimateTimeSavingsSeconds,
  kphToMetersPerSecond,
  wattSavingsAtSpeed,
} from "./index";

test("kphToMetersPerSecond converts speed deterministically", () => {
  assert.equal(kphToMetersPerSecond(36), 10);
});

test("aerodynamicDragWatts uses 0.5 * rho * CdA * v^3", () => {
  const watts = aerodynamicDragWatts({ cdaM2: 0.3, speedKph: 36, airDensityKgM3: 1.225 });
  assert.ok(Math.abs(watts - 183.75) < 1e-9);
});

test("buildCdAEstimate includes drag watts when speed is known", () => {
  const estimate = buildCdAEstimate({
    cdaM2: 0.3,
    speedKph: 36,
    confidence01: 1.2,
    method: "field_estimate",
  });
  assert.equal(estimate.confidence01, 1);
  assert.ok(Math.abs((estimate.dragWatts ?? 0) - 183.75) < 1e-9);
});

test("wattSavingsAtSpeed computes positive baseline minus optimized drag", () => {
  const saved = wattSavingsAtSpeed({
    baselineCdaM2: 0.32,
    optimizedCdaM2: 0.28,
    speedKph: 45,
    airDensityKgM3: 1.225,
  });
  assert.ok(Math.abs(saved - 47.8515625) < 1e-9);
});

test("estimateTimeSavingsSeconds follows first-order CdA speed scaling", () => {
  const saved = estimateTimeSavingsSeconds({
    baselineCdaM2: 0.32,
    optimizedCdaM2: 0.28,
    speedKph: 45,
    durationSeconds: 3600,
  });
  assert.ok(saved > 140);
  assert.ok(saved < 160);
});

test("buildAerodynamicsOptimizationResult returns bounded deltas", () => {
  const result = buildAerodynamicsOptimizationResult({
    baselineCdaM2: 0.32,
    optimizedCdaM2: 0.28,
    referenceSpeedKph: 45,
    confidence01: 0.82,
    changedVariables: ["elbowWidthMm", "headDropMm"],
  });
  assert.ok(Math.abs(result.deltaCdaM2 + 0.04) < 1e-12);
  assert.equal(result.confidence01, 0.82);
  assert.ok(result.wattSavingsAtReferenceSpeed > 47);
  assert.ok(result.timeSavingsSecondsPerHour && result.timeSavingsSecondsPerHour > 140);
});

test("computeAerodynamicsScores rewards lower CdA and optimized position", () => {
  const scores = computeAerodynamicsScores({
    cdaM2: 0.28,
    optimizedCdaM2: 0.25,
    positionConfidence01: 0.8,
    equipmentConfidence01: 0.7,
  });
  assert.ok(scores.cdaScore01 > 0.6);
  assert.ok(scores.positionScore01 > 0.5);
  assert.equal(scores.equipmentScore01, 0.7);
  assert.ok(scores.aeroEfficiency01 > 0.6);
});
