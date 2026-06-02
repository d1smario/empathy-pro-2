import assert from "node:assert/strict";
import test from "node:test";
import { buildNutritionPathwayModulationViewModel } from "@/lib/nutrition/pathway-modulation-model";
import { buildEmpathyInterrogationMap } from "@/lib/interpretation/build-empathy-interrogation-map";
import { buildEmpathyApplicationPlaybook } from "@/lib/interpretation/empathy-application-playbook";
import { resolveEmpathyInterrogationBundle } from "@/lib/interpretation/resolve-empathy-interrogation-bundle";
import { mergePlaybookIntoMealPlanRequest } from "@/lib/interpretation/materialize-application-playbook";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";

const pathwayVm = buildNutritionPathwayModulationViewModel({
  date: "2026-06-02",
  plannedSessions: [
    {
      id: "s1",
      label: "Endurance Z2",
      builderSession: { adaptationTarget: "endurance_z2" } as never,
    },
  ],
  physiology: null,
  twin: { glycogenStatus: 55, readiness: 70 },
  multiscaleBridge: null,
});

test("interrogation map: Z2 session activates L1 training sector", () => {
  const map = buildEmpathyInterrogationMap({
    athleteId: "athlete-test",
    anchorDate: "2026-06-02",
    plannedSessions: [{ label: "Endurance Z2", adaptationTarget: "endurance_z2" }],
    pathwayModulation: pathwayVm,
    multiscaleBridge: null,
    healthLabBridge: {
      markerSignals: [{ marker: "ferritina", status: "low", value: "18 ng/mL" }],
    } as never,
    healthPanelModulators: null,
    recoverySummary: null,
  });
  assert.ok(map.levels.some((l) => l.levelId === "L1_stimulus"));
  const l1 = map.levels.find((l) => l.levelId === "L1_stimulus");
  assert.ok(l1?.sectors.some((s) => s.sectorId === "training" && s.status === "answered"));
  assert.ok(map.canonicalQuestions.length >= 1);
});

test("application playbook: ferritina bassa → nutrition advice, fueling refs solver", () => {
  const map = buildEmpathyInterrogationMap({
    athleteId: "athlete-test",
    anchorDate: "2026-06-02",
    plannedSessions: [{ label: "VO2 blocks", adaptationTarget: "z5_vo2max" }],
    pathwayModulation: pathwayVm,
    multiscaleBridge: null,
    healthLabBridge: {
      markerSignals: [{ marker: "ferritina", status: "low", value: "18 ng/mL" }],
    } as never,
    healthPanelModulators: null,
    recoverySummary: null,
  });
  const dailyEnergyModel = {
    fueling: { adjustedChoGPerHour: 72, capabilityTier: "high" },
  } as never;
  const playbook = buildEmpathyApplicationPlaybook({
    athleteId: "athlete-test",
    anchorDate: "2026-06-02",
    interrogationMap: map,
    plannedSessions: [{ label: "VO2 blocks", adaptationTarget: "z5_vo2max" }],
    pathwayModulation: pathwayVm,
    healthLabBridge: {
      markerSignals: [{ marker: "ferritina", status: "low", value: "18 ng/mL" }],
    } as never,
    recoverySummary: null,
    nutritionPerformanceIntegration: null,
    dailyEnergyModel,
  });
  assert.ok(playbook.nutritionAdvice.some((n) => n.headlineIt.toLowerCase().includes("ferritina")));
  assert.ok(playbook.fuelingAdvice?.choPerHourRef?.includes("72"));
  assert.ok(playbook.directives.some((d) => d.confidence === "engine_derived"));
});

test("mergePlaybookIntoMealPlanRequest: adds lines without changing meal rows", () => {
  const base: IntelligentMealPlanRequest = {
    athleteId: "a",
    planDate: "2026-06-02",
    profile: {},
    mealRows: [{ key: "breakfast", label: "Colazione", kcal: 500, carbs: 60, protein: 25, fat: 15 }],
    contextLines: [],
    pathwayTimingLines: [],
    mealPlanSolverMeta: { integrationLeverLines: [] },
  } as never;
  const bundle = resolveEmpathyInterrogationBundle({
    athleteId: "athlete-test",
    anchorDate: "2026-06-02",
    plannedSessions: [{ label: "Z2", adaptationTarget: "endurance_z2" }],
    pathwayModulation: pathwayVm,
    multiscaleBridge: null,
    healthLabBridge: null,
    healthPanelModulators: null,
    recoverySummary: null,
    nutritionPerformanceIntegration: null,
    dailyEnergyModel: { fueling: { adjustedChoGPerHour: 60 } } as never,
  });
  const merged = mergePlaybookIntoMealPlanRequest(base, bundle.applicationPlaybook);
  assert.equal(merged.mealRows.length, base.mealRows.length);
  assert.equal(merged.mealRows[0].kcal, 500);
  assert.ok(merged.mealPlanSolverMeta.integrationLeverLines.some((l) => l.startsWith("Playbook EMPATHY")));
});
