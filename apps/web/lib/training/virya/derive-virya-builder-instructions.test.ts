import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildViryaBuilderSessionBrief } from "@/lib/training/virya/build-virya-session-brief";
import { deriveViryaBuilderInstructions } from "@/lib/training/virya/derive-virya-builder-instructions";
import type { GymDayModule } from "@/lib/training/virya/gym-day-modules";

const gymModule: GymDayModule = {
  dayIndex: 1,
  districts: ["Petto", "Schiena"],
  districtObjective: "Forza massima",
  exerciseType: "Multiarticolare",
  methodology: "Lento controllato",
};

function briefForRole(role: "quality" | "volume") {
  return buildViryaBuilderSessionBrief({
    weekStart: "2026-01-05",
    slot: { weekdayOffset: 0, slotIndex: 0, loadTarget: role === "quality" ? 130 : 55, sessionRole: role },
    sessionsInWeek: 5,
    weeklyBudgetLoad: 500,
    weekdayPatternId: "5d",
    phase: "build",
    family: "strength",
    discipline: "Gym",
    planName: "Test",
    phaseLabel: "Costruzione",
    sessionName: "Test · Gym",
    gymPrimaryGoal: "forza",
  });
}

describe("deriveViryaBuilderInstructions", () => {
  it("quality vs volume produce different gym adaptation targets", () => {
    const q = deriveViryaBuilderInstructions({ brief: briefForRole("quality"), gymModule });
    const v = deriveViryaBuilderInstructions({ brief: briefForRole("volume"), gymModule });
    assert.notEqual(q.adaptationTarget, v.adaptationTarget);
    assert.ok(q.tss > v.tss);
  });
});
