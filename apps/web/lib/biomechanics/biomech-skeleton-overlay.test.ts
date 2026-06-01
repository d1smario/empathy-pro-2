import assert from "node:assert/strict";
import test from "node:test";

import {
  angleBetweenPoints,
  findJointAngleDeg,
  GOLDEN_MONOLATERAL_SIDE_LANDMARKS,
  landmarkLabelIt,
  normalizeMonolateralLandmarks,
  pickJointAnglesForPhase,
  resolveOverlayLandmarks,
} from "./biomech-skeleton-overlay";
import { deriveJointAnglesFromLandmarks } from "./biomech-landmark-angles";

test("resolveOverlayLandmarks uses monolateral golden skeleton", () => {
  assert.equal(resolveOverlayLandmarks(undefined).length, 9);
  assert.equal(resolveOverlayLandmarks([]).length, GOLDEN_MONOLATERAL_SIDE_LANDMARKS.length);
});

test("normalizeMonolateralLandmarks maps legacy knee_l to knee", () => {
  const normalized = normalizeMonolateralLandmarks([
    { name: "knee_l", xMm: 100, yMm: 200 },
    { name: "knee_r", xMm: 300, yMm: 400 },
  ]);
  const knee = normalized.find((row) => row.name === "knee");
  assert.ok(knee);
  assert.equal(knee!.xMm, 100);
  assert.equal(normalized.filter((row) => row.name.includes("knee")).length, 1);
});

test("landmarkLabelIt returns Italian names", () => {
  assert.equal(landmarkLabelIt("shoulder"), "Spalla");
  assert.equal(landmarkLabelIt("knee"), "Ginocchio");
});

test("deriveJointAnglesFromLandmarks emits three monolateral angles per phase", () => {
  const angles = deriveJointAnglesFromLandmarks(GOLDEN_MONOLATERAL_SIDE_LANDMARKS, [
    { joint: "knee", side: "left", angleDeg: 0, phasePct: 50 },
  ]);
  assert.equal(angles.length, 3);
});

test("pickJointAnglesForPhase chooses nearest phase", () => {
  const picked = pickJointAnglesForPhase(
    [
      { joint: "knee", side: "left", angleDeg: 140, phasePct: 0 },
      { joint: "knee", side: "left", angleDeg: 96, phasePct: 50 },
    ],
    45,
  );
  assert.equal(picked.find((row) => row.side === "left")?.angleDeg, 96);
});

test("angleBetweenPoints returns ~90 for orthogonal segments", () => {
  const angle = angleBetweenPoints({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 });
  assert.ok(Math.abs(angle - 90) < 0.01);
});
