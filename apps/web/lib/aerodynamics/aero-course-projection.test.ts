import test from "node:test";
import assert from "node:assert/strict";
import { projectAeroCourseFromSession } from "./aero-course-projection";

test("projectAeroCourseFromSession wraps domain course projection", () => {
  const out = projectAeroCourseFromSession({
    baselineCdaM2: 0.32,
    optimizedCdaM2: 0.28,
    distanceKm: 40,
    avgSpeedKph: 40,
  });
  assert.ok(out.estimatedTimeDeltaSeconds > 0);
});
