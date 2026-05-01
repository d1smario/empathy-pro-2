import assert from "node:assert/strict";
import test from "node:test";
import { buildFunctionalMealSelectorViewModel } from "./functional-meal-selector";

test("buildFunctionalMealSelectorViewModel: directive focus aggiunge nota direttiva", () => {
  const vm = buildFunctionalMealSelectorViewModel({
    date: "2026-05-01",
    pathwayModulation: null,
    foodRecommendations: null,
    nutritionPerformanceIntegration: null,
    applicationDirective: {
      focus: ["redox_support"],
      coachValidatedMemoryCount: 0,
    },
    adaptationLoop: null,
    recoverySummary: null,
    twin: null,
  });
  assert.ok(vm);
  assert.ok(vm.notes.some((n) => n.includes("Direttiva applicativa")));
});

test("buildFunctionalMealSelectorViewModel: coach memory lines nelle note", () => {
  const vm = buildFunctionalMealSelectorViewModel({
    date: "2026-05-01",
    pathwayModulation: null,
    foodRecommendations: null,
    nutritionPerformanceIntegration: null,
    applicationDirective: {
      focus: [],
      coachValidatedMemoryCount: 1,
      coachValidatedMemoryLines: ["Aumentare cofattori ferro con vitamina C al pasto"],
    },
    adaptationLoop: null,
    recoverySummary: null,
    twin: null,
  });
  assert.ok(vm.notes.some((n) => n.includes("Memoria coach validate:")));
});

test("buildFunctionalMealSelectorViewModel: senza directive applicativa nessuna riga Memoria/Direttiva da directive", () => {
  const vm = buildFunctionalMealSelectorViewModel({
    date: "2026-05-01",
    pathwayModulation: null,
    foodRecommendations: null,
    nutritionPerformanceIntegration: null,
    applicationDirective: null,
    adaptationLoop: null,
    recoverySummary: null,
    twin: { readiness: 70, redoxStressIndex: 10, inflammationRisk: 10, glycogenStatus: 60 },
  });
  assert.ok(vm);
  assert.equal(vm.notes.some((n) => n.includes("Direttiva applicativa")), false);
  assert.equal(vm.notes.some((n) => n.includes("Memoria coach validate:")), false);
});
