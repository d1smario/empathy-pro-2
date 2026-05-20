import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VIRYA_WEEKDAY_PATTERN_OFFSETS,
  buildWeekGenerationPlan,
  distributeWeeklyLoad,
  normalizeWeeklyLoad,
} from "@/lib/training/virya/virya-microcycle-planner";

describe("virya-microcycle-planner", () => {
  it("5d pattern uses Lun Mar Gio Ven Dom with non-equal loads summing ~500", () => {
    const plan = buildWeekGenerationPlan({
      weeklyBudgetLoad: 500,
      sessionsPerWeek: 5,
      phase: "build",
      family: "strength",
      patternId: "5d",
    });
    assert.deepEqual(plan.weekdayOffsets, [...VIRYA_WEEKDAY_PATTERN_OFFSETS["5d"]]);
    assert.equal(plan.slots.length, 5);
    const loads = plan.slots.map((s) => s.loadTarget);
    assert.ok(new Set(loads).size > 1);
    assert.ok(plan.loadSum >= 485 && plan.loadSum <= 515);
    const qualityLoads = plan.slots.filter((s) => s.sessionRole === "quality").map((s) => s.loadTarget);
    const volumeLoads = plan.slots.filter((s) => s.sessionRole === "volume").map((s) => s.loadTarget);
    if (qualityLoads.length && volumeLoads.length) {
      assert.ok(Math.max(...qualityLoads) > Math.max(...volumeLoads));
    }
  });

  it("normalizeWeeklyLoad reconciles sum to budget", () => {
    const out = normalizeWeeklyLoad([100, 100, 100, 100, 100], 500);
    const sum = out.reduce((a, b) => a + b, 0);
    assert.ok(sum >= 485 && sum <= 515);
  });

  it("distributeWeeklyLoad assigns higher weight to quality in build", () => {
    const loads = distributeWeeklyLoad({
      weeklyBudgetLoad: 400,
      roles: ["quality", "volume", "quality", "volume", "quality"],
      phase: "build",
    });
    assert.ok(loads[0]! + loads[2]! + loads[4]! > loads[1]! + loads[3]!);
  });
});
