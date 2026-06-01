import assert from "node:assert/strict";
import test from "node:test";

import {
  angleBetweenPoints,
  findJointAngleDeg,
  GOLDEN_SAGITTAL_LANDMARKS,
  pickJointAnglesForPhase,
  resolveOverlayLandmarks,
} from "./biomech-skeleton-overlay";

test("resolveOverlayLandmarks falls back to golden skeleton", () => {
  assert.equal(resolveOverlayLandmarks(undefined).length, GOLDEN_SAGITTAL_LANDMARKS.length);
  assert.equal(resolveOverlayLandmarks([]).length, GOLDEN_SAGITTAL_LANDMARKS.length);
});

test("pickJointAnglesForPhase chooses nearest phase", () => {
  const picked = pickJointAnglesForPhase(
    [
      { joint: "knee", side: "left", angleDeg: 140, phasePct: 0 },
      { joint: "knee", side: "left", angleDeg: 96, phasePct: 50 },
      { joint: "knee", side: "right", angleDeg: 138, phasePct: 0 },
    ],
    45,
  );
  assert.equal(picked.find((row) => row.side === "left")?.angleDeg, 96);
});

test("findJointAngleDeg reads side-specific sample", () => {
  assert.equal(
    findJointAngleDeg([{ joint: "knee", side: "left", angleDeg: 142 }], "knee", "left"),
    142,
  );
});

test("angleBetweenPoints returns ~90 for orthogonal segments", () => {
  const angle = angleBetweenPoints({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 });
  assert.ok(Math.abs(angle - 90) < 0.01);
});
