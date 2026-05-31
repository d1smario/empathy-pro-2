import assert from "node:assert/strict";
import test from "node:test";
import { assignPathwayTargetsToMealSlots } from "./pathway-meal-usda-slots";
import { buildNutritionPathwayModulationViewModel } from "./pathway-modulation-model";
import { buildMultiscalePathwayBridge } from "./multiscale-pathway-bridge";
import type { FunctionalFoodTargetViewModel } from "@/api/nutrition/contracts";

const b12Target: FunctionalFoodTargetViewModel = {
  nutrientId: "vitB12_mcg",
  displayNameIt: "Vitamina B12",
  pathwayLabel: "Test",
  rationaleIt: "Test",
  usdaRichSearch: true,
  searchQueries: ["B12"],
  curatedExamples: [],
};

test("pathway-meal-usda-slots: B12 prefer breakfast/lunch con pathway multiscala", () => {
  const physiology = {
    performanceProfile: { redoxStressIndex: 58 },
    lactateProfile: { gutStressScore: 0.1, bloodDeliveryPctOfIngested: 95 },
    bioenergeticProfile: {},
    metabolicProfile: {},
    recoveryProfile: {},
    physiologicalProfile: {},
  } as never;
  const bridge = buildMultiscalePathwayBridge({ physiology, twin: { glycogenStatus: 35 } });
  const vm = buildNutritionPathwayModulationViewModel({
    date: "2026-05-30",
    plannedSessions: [{ id: "1", label: "Z2", builderSession: null }],
    physiology,
    twin: { glycogenStatus: 35 },
    multiscaleBridge: bridge,
  });
  const assigned = assignPathwayTargetsToMealSlots({
    targets: [b12Target],
    planDate: "2026-05-30",
    athleteId: "a1",
    pathwayModulation: vm,
    selectorSlots: [
      { slot: "breakfast", focus: "redox", rationaleIt: "r", suggestedCatalogIds: [] },
      { slot: "lunch", focus: "glycogen", rationaleIt: "r", suggestedCatalogIds: [] },
      { slot: "dinner", focus: "anabolic", rationaleIt: "r", suggestedCatalogIds: [] },
      { slot: "snack_am", focus: "glycogen", rationaleIt: "r", suggestedCatalogIds: [] },
      { slot: "snack_pm", focus: "recovery", rationaleIt: "r", suggestedCatalogIds: [] },
    ],
  });
  const slotsWithB12 = (["breakfast", "lunch", "dinner"] as const).filter((s) =>
    assigned[s].some((t) => t.nutrientId === "vitB12_mcg"),
  );
  assert.ok(slotsWithB12.includes("breakfast") || slotsWithB12.includes("lunch"));
  assert.ok(!slotsWithB12.includes("dinner"));
});
