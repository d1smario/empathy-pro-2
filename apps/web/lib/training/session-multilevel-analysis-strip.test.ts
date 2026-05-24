import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSessionMultilevelAnalysisStrip } from "./session-multilevel-analysis-strip";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

function lactateThresholdFixture(): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "virya",
    family: "aerobic",
    discipline: "Cycling",
    sessionName: "LT2 test",
    adaptationTarget: "lactate_tolerance",
    phase: "base",
    blocks: [
      {
        id: "w",
        label: "Warm-up",
        kind: "warmup",
        durationMinutes: 14,
        intensityCue: "Z1",
        chart: { intensity: "Z1", segments: [{ durationSec: 840, intensity: "Z1" }] },
      },
      {
        id: "m",
        label: "Main block",
        kind: "main",
        durationMinutes: 28,
        intensityCue: "LT2",
        chart: {
          intensity: "LT2",
          segments: [
            { durationSec: 300, intensity: "LT2" },
            { durationSec: 120, intensity: "Z1" },
            { durationSec: 300, intensity: "LT2" },
            { durationSec: 120, intensity: "Z1" },
          ],
        },
      },
      {
        id: "c",
        label: "Cool-down",
        kind: "cooldown",
        durationMinutes: 11,
        intensityCue: "Z2",
        chart: { intensity: "Z2", segments: [{ durationSec: 660, intensity: "Z2" }] },
      },
    ],
    renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 190, lengthMode: "duration" },
    summary: { durationSec: 3180, tss: 81 },
  };
}

test("multilevel strip: lactate_tolerance + chart fills O2 and neuro", () => {
  const vm = buildSessionMultilevelAnalysisStrip({
    contract: lactateThresholdFixture(),
    fallbackTss: 111,
    fallbackDurationMin: 91,
  });

  const active = vm.stripSlots.filter(Boolean).filter((s) => s.valueLineIt !== "—");
  assert.ok(active.length >= 5, `expected >=5 active sectors, got ${active.length}`);
  assert.ok(vm.facets.some((f) => f.category === "oxygen_hypoxia"));
  assert.ok(vm.facets.some((f) => f.category === "neuro_adrenergic"));
  assert.ok(vm.coachPrompts.length >= 2);
  assert.ok(vm.facilitationHints.length >= 1);
});

test("multilevel strip: uses max TSS for load proxy", () => {
  const vm = buildSessionMultilevelAnalysisStrip({
    contract: lactateThresholdFixture(),
    fallbackTss: 111,
    fallbackDurationMin: 91,
  });
  assert.ok(vm.facets.some((f) => f.id === "load_hpa" || f.id === "load_neuro"));
});
