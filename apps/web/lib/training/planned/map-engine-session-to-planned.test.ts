import { describe, expect, it } from "vitest";
import { mapEngineSessionToPlannedRow } from "@/lib/training/planned/map-engine-session-to-planned";

describe("mapEngineSessionToPlannedRow", () => {
  it("perserves the calendar target date (not today)", () => {
    const row = mapEngineSessionToPlannedRow({
      athleteId: "athlete-1",
      date: "2026-05-27",
      session: {
        sport: "cycling",
        domain: "endurance",
        physiologicalTarget: "aerobic_base",
        goalLabel: "Test",
        blocks: [{ label: "Z2", durationMinutes: 60, intensityHint: "Z2" }],
        expectedLoad: { loadBand: "moderate", tssHint: 50 },
      },
    });
    expect(row.date).toBe("2026-05-27");
    expect(row.athlete_id).toBe("athlete-1");
  });
});
