import assert from "node:assert/strict";
import test from "node:test";
import { buildMultiscalePathwayBridge } from "./multiscale-pathway-bridge";
import { resolveMultiscaleTagsToCofactorStrings } from "./multiscale-nutrient-tag-resolver";
import { buildNutritionPathwayModulationViewModel } from "./pathway-modulation-model";
import { buildActiveNutrientTargets } from "./pathway-cofactors-to-nutrient-targets";

test("multiscale tag resolver: thiamine → B1 string", () => {
  const out = resolveMultiscaleTagsToCofactorStrings(["thiamine", "magnesium"]);
  assert.ok(out.some((s) => /B1|tiamin/i.test(s)));
  assert.ok(out.some((s) => /magnesio/i.test(s)));
});

test("multiscale bridge: redox stress attiva cofattori e pathway extension", () => {
  const bridge = buildMultiscalePathwayBridge({
    physiology: {
      performanceProfile: { redoxStressIndex: 58, oxidativeBottleneckIndex: 65 },
      lactateProfile: { gutStressScore: 0.1, bloodDeliveryPctOfIngested: 95 },
      bioenergeticProfile: {},
      metabolicProfile: {},
      recoveryProfile: {},
      physiologicalProfile: {},
    } as never,
    twin: { inflammationRisk: 60, glycogenStatus: 50, readiness: 55 },
  });
  assert.ok(bridge);
  assert.ok(bridge!.pathwayExtension);
  assert.equal(bridge!.pathwayExtension!.id, "multiscale_ontology_cofactor_support");
  assert.ok(bridge!.cofactorStrings.length >= 1);
});

test("multiscale bridge: L1/L2 aggiunge PDH → target B1 nel meal plan", () => {
  const bridge = buildMultiscalePathwayBridge({
    physiology: {
      performanceProfile: { redoxStressIndex: 58 },
      lactateProfile: { gutStressScore: 0.1, bloodDeliveryPctOfIngested: 95 },
      bioenergeticProfile: {},
      metabolicProfile: {},
      recoveryProfile: {},
      physiologicalProfile: {},
    } as never,
    twin: { glycogenStatus: 35, readiness: 40 },
  });
  const vm = buildNutritionPathwayModulationViewModel({
    date: "2026-05-30",
    plannedSessions: [{ id: "1", label: "Z2", builderSession: null }],
    physiology: {
      performanceProfile: { redoxStressIndex: 58 },
      lactateProfile: { gutStressScore: 0.1, bloodDeliveryPctOfIngested: 95 },
      bioenergeticProfile: {},
      metabolicProfile: {},
      recoveryProfile: {},
      physiologicalProfile: {},
    } as never,
    twin: { glycogenStatus: 35 },
    multiscaleBridge: bridge,
  });
  assert.ok(vm.pathways.some((p) => p.id === "multiscale_ontology_cofactor_support"));
  const targets = buildActiveNutrientTargets({
    cofactorStrings: vm.pathways.flatMap((p) => p.cofactors),
  });
  assert.ok(targets.some((t) => t.nutrientId === "thiamineB1_mg"));
});
