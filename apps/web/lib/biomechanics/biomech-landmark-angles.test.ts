import assert from "node:assert/strict";
import test from "node:test";

import { GOLDEN_MONOLATERAL_SIDE_LANDMARKS } from "@/lib/biomechanics/biomech-skeleton-overlay";
import { deriveJointAnglesFromLandmarks } from "./biomech-landmark-angles";

test("deriveJointAnglesFromLandmarks emits three monolateral samples", () => {
  const angles = deriveJointAnglesFromLandmarks(GOLDEN_MONOLATERAL_SIDE_LANDMARKS, [
    { joint: "knee", side: "left", angleDeg: 0, phasePct: 50 },
  ]);
  assert.equal(angles.length, 3);
  assert.ok(angles.every((row) => row.angleDeg > 0 && row.angleDeg < 180));
});
