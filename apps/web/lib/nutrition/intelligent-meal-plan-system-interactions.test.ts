/**
 * Sistema intelligente (Nutrition · Meal plan): quante chiamate aggiunge il client
 * e cosa cambia nel piano deterministico rispetto a pathwayModulation = null.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { FunctionalFoodTargetViewModel } from "@/api/nutrition/contracts";
import { buildIntelligentMealPlanRequest } from "./intelligent-meal-plan-request-builder";
import type { MealSlotKey } from "./intelligent-meal-plan-types";
import { buildMultiscalePathwayBridge } from "./multiscale-pathway-bridge";
import { buildHealthLabPathwayBridge } from "./health-lab-pathway-bridge";
import { buildNutritionPathwayModulationViewModel } from "./pathway-modulation-model";
import { assignPathwayTargetsToMealSlots, catalogIdsForSlot } from "./pathway-meal-usda-slots";
import { buildActiveNutrientTargets } from "./pathway-cofactors-to-nutrient-targets";
import { buildFunctionalFoodRecommendationsViewModel } from "./functional-food-recommendations";

const MEAL_SLOTS: MealSlotKey[] = ["breakfast", "lunch", "dinner", "snack_am", "snack_pm"];

/** Modello UI `/nutrition/meal-plan` (dopo ottimizzazione performance). */
export function estimateMealPlanClientHttpInteractions(input: {
  activeMealSlotCount: number;
  slotsWithUsdaCatalog: number;
  includePathwayDateRefresh?: boolean;
  includeHeavyEnrichment?: boolean;
}): {
  total: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {
    "GET /api/nutrition/module?mode=light": 1,
    "POST /api/nutrition/intelligent-meal-plan": 1,
    "GET /api/nutrition/usda-by-nutrient (per slot, batch catalogIds)": input.slotsWithUsdaCatalog,
  };
  if (input.includePathwayDateRefresh) {
    breakdown["GET /api/nutrition/module?mode=pathway&pathwayDate=…"] = 1;
  }
  if (input.includeHeavyEnrichment) {
    breakdown["GET /api/nutrition/module?includeHeavy=1"] = 1;
  }
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  return { total, breakdown };
}

function sampleMealRows() {
  return [
    { key: "breakfast", label: "Colazione", kcal: 550, carbs: 70, protein: 28, fat: 18, timeLocal: "07:30" },
    { key: "lunch", label: "Pranzo", kcal: 850, carbs: 110, protein: 42, fat: 28, timeLocal: "13:00" },
    { key: "dinner", label: "Cena", kcal: 750, carbs: 85, protein: 48, fat: 30, timeLocal: "20:00" },
    { key: "snack_am", label: "Spuntino", kcal: 180, carbs: 28, protein: 8, fat: 5, timeLocal: "10:30" },
    { key: "snack_pm", label: "Merenda", kcal: 200, carbs: 32, protein: 10, fat: 6, timeLocal: "16:30" },
  ];
}

function buildRichPathwayVm() {
  const physiology = {
    performanceProfile: { redoxStressIndex: 62, oxidativeBottleneckIndex: 68 },
    lactateProfile: { gutStressScore: 0.15, bloodDeliveryPctOfIngested: 92 },
    bioenergeticProfile: {},
    metabolicProfile: {},
    recoveryProfile: {},
    physiologicalProfile: {},
  } as never;
  const lab = buildHealthLabPathwayBridge({
    blood: { ferritin_ng_ml: 16 },
    panels: [],
    systemicModulationSnapshots: [],
  });
  const bridge = buildMultiscalePathwayBridge({
    physiology,
    twin: { glycogenStatus: 32, inflammationRisk: 55 },
  });
  return buildNutritionPathwayModulationViewModel({
    date: "2026-06-02",
    plannedSessions: [{ id: "s1", label: "Endurance Z2", builderSession: null }],
    physiology,
    twin: { glycogenStatus: 32 },
    healthLabBridge: lab,
    multiscaleBridge: bridge,
  });
}

function mealPathwayBundles(pathwayModulation: ReturnType<typeof buildRichPathwayVm> | null) {
  const recs = buildFunctionalFoodRecommendationsViewModel(pathwayModulation?.pathways ?? null);
  const bySlot = assignPathwayTargetsToMealSlots({
    targets: recs.targets,
    planDate: "2026-06-02",
    athleteId: "athlete-test",
    pathwayModulation,
  });
  const out: Partial<
    Record<
      MealSlotKey,
      { pathwayTargets: FunctionalFoodTargetViewModel[]; foods: []; pathwayTargetsForIds: string[] }
    >
  > = {};
  for (const k of MEAL_SLOTS) {
    const targets = bySlot[k] ?? [];
    out[k] = { pathwayTargets: targets, foods: [], pathwayTargetsForIds: catalogIdsForSlot(targets) };
  }
  return out;
}

test("interazioni HTTP tipiche meal-plan: light + pathway giorno + USDA slot + POST piano", () => {
  const slotsWithCatalog = MEAL_SLOTS.filter((k) => {
    const vm = buildRichPathwayVm();
    const bundles = mealPathwayBundles(vm);
    return (bundles[k]?.pathwayTargetsForIds.length ?? 0) > 0;
  }).length;

  const est = estimateMealPlanClientHttpInteractions({
    activeMealSlotCount: MEAL_SLOTS.length,
    slotsWithUsdaCatalog: slotsWithCatalog,
    includePathwayDateRefresh: true,
    includeHeavyEnrichment: false,
  });

  assert.equal(est.breakdown["GET /api/nutrition/module?mode=light"], 1);
  assert.equal(est.breakdown["POST /api/nutrition/intelligent-meal-plan"], 1);
  assert.ok(est.total >= 3);
  assert.ok(slotsWithCatalog >= 1, "pathway ricco assegna almeno un target USDA a uno slot");
});

test("predictor/integration: +1 module includeHeavy (lazy, solo quelle tab)", () => {
  const base = estimateMealPlanClientHttpInteractions({
    activeMealSlotCount: 5,
    slotsWithUsdaCatalog: 0,
    includePathwayDateRefresh: false,
    includeHeavyEnrichment: false,
  });
  const withHeavy = estimateMealPlanClientHttpInteractions({
    activeMealSlotCount: 5,
    slotsWithUsdaCatalog: 0,
    includePathwayDateRefresh: false,
    includeHeavyEnrichment: true,
  });
  assert.equal(withHeavy.total, base.total + 1);
  assert.equal(withHeavy.breakdown["GET /api/nutrition/module?includeHeavy=1"], 1);
});

test("request builder: pathway attivo aggiunge nutrientBoostTargets e gruppi funzionali", () => {
  const vm = buildRichPathwayVm();
  const bundles = mealPathwayBundles(vm);
  const mealPathwayBySlot: Record<string, { pathwayTargets: FunctionalFoodTargetViewModel[]; foods: [] }> =
    {};
  for (const k of MEAL_SLOTS) {
    mealPathwayBySlot[k] = { pathwayTargets: bundles[k]!.pathwayTargets, foods: [] };
  }

  const withPathway = buildIntelligentMealPlanRequest({
    athleteId: "a1",
    planDate: "2026-06-02",
    profile: {
      diet_type: "omnivore",
      intolerances: null,
      allergies: null,
      food_exclusions: null,
      food_preferences: null,
      supplements: null,
      routine_config: null,
      weight_kg: 70,
    },
    mealRows: sampleMealRows(),
    mealPathwayBySlot,
    contextLines: [],
    pathwayModulation: vm,
    trainingDayLines: [],
  });

  const withoutPathway = buildIntelligentMealPlanRequest({
    athleteId: "a1",
    planDate: "2026-06-02",
    profile: {
      diet_type: "omnivore",
      intolerances: null,
      allergies: null,
      food_exclusions: null,
      food_preferences: null,
      supplements: null,
      routine_config: null,
      weight_kg: 70,
    },
    mealRows: sampleMealRows(),
    mealPathwayBySlot: {},
    contextLines: [],
    pathwayModulation: null,
    trainingDayLines: [],
  });

  const boostWith = withPathway.nutrientBoostTargets?.length ?? 0;
  const boostWithout = withoutPathway.nutrientBoostTargets?.length ?? 0;
  assert.ok(boostWith > boostWithout, "cofactors pathway → più nutrient target");
  assert.ok(withPathway.pathwayModulationActiveLabels?.length);
  assert.equal(withoutPathway.pathwayModulationActiveLabels, undefined);

  const groupsWith = withPathway.slots.reduce((s, sl) => s + sl.functionalFoodGroups.length, 0);
  const groupsWithout = withoutPathway.slots.reduce((s, sl) => s + sl.functionalFoodGroups.length, 0);
  assert.ok(groupsWith >= groupsWithout);

  const cofactorStrings = vm.pathways.flatMap((p) => p.cofactors ?? []);
  const expectedTargets = buildActiveNutrientTargets({ cofactorStrings }).length;
  assert.ok(boostWith >= Math.min(3, expectedTargets));
});
