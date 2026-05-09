import test from "node:test";
import assert from "node:assert/strict";
import { computeBioenergeticDayKernel } from "@/lib/bioenergetics/day-response-kernel";

test("high activity with CHO keeps supportive pathway tendency", () => {
  const out = computeBioenergeticDayKernel({
    choIntakeG: 50,
    activityLoadScore: 82,
    cgmPresent: true,
    lactatePresent: true,
    gutConstraintScore: 15,
  });

  assert.equal(out.pathwayState, "supportive");
  assert.ok(out.glucoseHandlingScore > out.insulinDemandScore);
  assert.ok(out.keyDrivers.includes("high_activity_pull"));
});

test("low activity with same CHO shifts toward inhibitory pattern", () => {
  const out = computeBioenergeticDayKernel({
    choIntakeG: 50,
    activityLoadScore: 8,
    cgmPresent: false,
    lactatePresent: false,
    gutConstraintScore: 40,
  });

  assert.equal(out.pathwayState, "inhibitory");
  assert.ok(out.insulinDemandScore > out.glucoseHandlingScore);
  assert.equal(out.efficiencyBand, "low");
});
