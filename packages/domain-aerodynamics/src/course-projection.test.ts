import test from "node:test";
import assert from "node:assert/strict";
import { projectCourseTimeDelta } from "./course-projection";

test("projectCourseTimeDelta returns positive savings when optimized CdA is lower", () => {
  const projection = projectCourseTimeDelta({
    baselineCdaM2: 0.32,
    optimizedCdaM2: 0.28,
    course: { distanceKm: 40, avgSpeedKph: 40 },
  });
  assert.ok(projection.estimatedTimeDeltaSeconds > 0);
  assert.equal(projection.algorithmVersion, "course_aero_projection_v1");
});
