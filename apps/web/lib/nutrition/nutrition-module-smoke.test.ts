import assert from "node:assert/strict";
import test from "node:test";
import { buildHealthLabPathwayBridge } from "./health-lab-pathway-bridge";
import { buildMultiscalePathwayBridge } from "./multiscale-pathway-bridge";
import { buildNutritionPathwayModulationViewModel } from "./pathway-modulation-model";
import { buildActiveNutrientTargets } from "./pathway-cofactors-to-nutrient-targets";
import { buildNutrientInterrogationViewModel } from "./build-nutrient-interrogation-view-model";
import { nutrientBoostAppliesToSlot } from "./pathway-absorption-hints";

const physiology = {
  performanceProfile: { redoxStressIndex: 58, oxidativeBottleneckIndex: 65 },
  lactateProfile: { gutStressScore: 0.1, bloodDeliveryPctOfIngested: 95 },
  bioenergeticProfile: {},
  metabolicProfile: {},
  recoveryProfile: {},
  physiologicalProfile: {},
} as never;

test("nutrition module smoke: pathway stack con lab + multiscala", () => {
  const lab = buildHealthLabPathwayBridge({
    blood: { ferritin_ng_ml: 18 },
    panels: [],
    systemicModulationSnapshots: [],
  });
  const bridge = buildMultiscalePathwayBridge({
    physiology,
    twin: { glycogenStatus: 35, inflammationRisk: 60 },
  });
  const vm = buildNutritionPathwayModulationViewModel({
    date: "2026-05-30",
    plannedSessions: [{ id: "pw1", label: "Endurance", builderSession: null }],
    physiology,
    twin: { glycogenStatus: 35 },
    healthLabBridge: lab,
    multiscaleBridge: bridge,
  });

  assert.ok(vm.pathways.some((p) => p.id === "health_lab_micronutrient_support"));
  assert.ok(vm.pathways.some((p) => p.id === "multiscale_ontology_cofactor_support"));

  const targets = buildActiveNutrientTargets({
    cofactorStrings: vm.pathways.flatMap((p) => p.cofactors),
  });
  assert.ok(targets.some((t) => t.nutrientId === "fe_mg"));
  assert.ok(targets.some((t) => t.nutrientId === "thiamineB1_mg"));

  const interrogation = buildNutrientInterrogationViewModel({
    activeTargets: targets,
    multiscaleBridge: bridge,
    healthLabBridge: lab,
    pathwayModulation: vm,
  });
  assert.ok(interrogation && interrogation.items.length >= 2);

  const b1 = interrogation!.items.find((i) => i.nutrientId === "thiamineB1_mg");
  assert.ok(b1?.preferredSlotsIt.includes("breakfast"));
  assert.ok(nutrientBoostAppliesToSlot("thiamineB1_mg", "breakfast", vm));
  assert.ok(!nutrientBoostAppliesToSlot("thiamineB1_mg", "dinner", vm) || b1!.preferredSlotsIt.includes("dinner"));
});
