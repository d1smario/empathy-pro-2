import assert from "node:assert/strict";
import test from "node:test";

import { GOLDEN_SAGITTAL_LANDMARKS } from "@/lib/biomechanics/biomech-skeleton-overlay";
import { deriveJointAnglesFromLandmarks } from "./biomech-landmark-angles";

test("deriveJointAnglesFromLandmarks emits six bilateral samples", () => {
  const angles = deriveJointAnglesFromLandmarks(GOLDEN_SAGITTAL_LANDMARKS, [
    { joint: "knee", side: "left", angleDeg: 0, phasePct: 50 },
  ]);
  assert.equal(angles.length, 6);
  assert.ok(angles.every((row) => row.angleDeg > 0 && row.angleDeg < 180));
});
