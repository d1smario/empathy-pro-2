import { describe, expect, it } from "vitest";
import { applyBuilderOperationalScaling } from "@/lib/training/builder/apply-builder-operational-scaling";
import type { GeneratedSession } from "@/lib/training/engine";
import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";

const baseSession: GeneratedSession = {
  sport: "cycling",
  domain: "endurance",
  goalLabel: "mitochondrial_density",
  physiologicalTarget: "mitochondrial_density",
  expectedLoad: { loadBand: "moderate", tssHint: 80 },
  blocks: [
    {
      order: 1,
      label: "Warm",
      method: "steady",
      targetSystem: "aerobic_base",
      durationMinutes: 15,
      intensityCue: "Z1",
      expectedAdaptation: "mitochondrial_density",
      exerciseIds: [],
    },
    {
      order: 2,
      label: "Main",
      method: "steady",
      targetSystem: "aerobic_base",
      durationMinutes: 45,
      intensityCue: "Z2",
      expectedAdaptation: "mitochondrial_density",
      exerciseIds: [],
    },
  ],
  rationale: ["base"],
};

const yellowGuidance: AdaptationGuidance = {
  scorePct: 60,
  trafficLight: "yellow",
  expectedAdaptation: 70,
  observedAdaptation: 42,
  reductionMinPct: 30,
  reductionMaxPct: 50,
  keepProgramUnchanged: false,
  guidance: "Giallo",
  likelyDrivers: [],
};

describe("applyBuilderOperationalScaling", () => {
  it("leaves session unchanged when load scale is ~1", () => {
    const out = applyBuilderOperationalScaling({
      session: baseSession,
      sessionMinutesRequested: 60,
      tssTargetHintRequested: 80,
      adaptationGuidance: {
        scorePct: 90,
        trafficLight: "green",
        expectedAdaptation: 70,
        observedAdaptation: 65,
        reductionMinPct: 0,
        reductionMaxPct: 0,
        keepProgramUnchanged: true,
        guidance: "Ok",
        likelyDrivers: [],
      },
      operationalContext: {
        mode: "normal",
        loadScale: 1,
        loadScalePct: 100,
        headline: "Standard",
        guidance: "Ok",
      },
      bioenergeticModulation: null,
      recoveryStatus: "good",
    });
    expect(out.operationalScaling.applied).toBe(false);
    expect(out.session.blocks[1].durationMinutes).toBe(45);
  });

  it("scales block minutes and TSS when score is yellow", () => {
    const out = applyBuilderOperationalScaling({
      session: baseSession,
      sessionMinutesRequested: 60,
      tssTargetHintRequested: 80,
      adaptationGuidance: yellowGuidance,
      operationalContext: {
        mode: "cautious",
        loadScale: 0.72,
        loadScalePct: 72,
        headline: "Cauto",
        guidance: "Riduci",
      },
      bioenergeticModulation: null,
    });
    expect(out.operationalScaling.applied).toBe(true);
    expect(out.loadAdaptation.direction).toBe("reduce");
    expect(out.session.blocks[1].durationMinutes).toBeLessThan(45);
    expect(out.session.expectedLoad.tssHint).toBeLessThan(80);
  });
});
