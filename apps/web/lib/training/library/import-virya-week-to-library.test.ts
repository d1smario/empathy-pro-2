import { describe, expect, it } from "vitest";
import { parsePro2BuilderSessionContract } from "@/lib/training/library/library-item-from-contract";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

describe("importViryaWeekToLibrary contract gate", () => {
  const minimalContract: Pro2BuilderSessionContract = {
    version: 1,
    source: "virya",
    family: "aerobic",
    discipline: "Cycling",
    sessionName: "VIRYA · base · Cycling · Mon",
    adaptationTarget: "aerobic_endurance",
    phase: "base",
    plannedSessionDurationMinutes: 60,
    blocks: [],
    summary: { durationSec: 3600, tss: 45 },
  };

  it("accepts virya-sourced builder contracts", () => {
    expect(parsePro2BuilderSessionContract(minimalContract)).not.toBeNull();
  });
});
