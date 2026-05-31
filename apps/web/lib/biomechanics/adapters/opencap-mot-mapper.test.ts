import test from "node:test";
import assert from "node:assert/strict";
import { parseOpenCapMotToJointAngles } from "./opencap-mot-mapper";

const SAMPLE_MOT = `name angle_data
datacolumns 4 datarows 3
nColumns=4
inDegrees=yes
endheader
time knee_angle_l knee_angle_r pelvis_tilt
0.0 140.0 138.0 8.0
0.1 142.0 139.0 8.5
0.2 141.0 137.5 8.2
`;

test("parseOpenCapMotToJointAngles maps OpenSim coordinates to EMPATHY joints", () => {
  const result = parseOpenCapMotToJointAngles(SAMPLE_MOT);
  assert.equal(result.sampleCount, 3);
  assert.ok(result.jointAngles.length >= 3);
  const kneeLeft = result.jointAngles.find((row) => row.joint === "knee" && row.side === "left");
  assert.ok(kneeLeft);
  assert.ok(Math.abs(kneeLeft!.angleDeg - 141) < 0.01);
});
