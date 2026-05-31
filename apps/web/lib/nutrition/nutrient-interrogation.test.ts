import assert from "node:assert/strict";
import test from "node:test";
import { buildNutrientInterrogationViewModel } from "./build-nutrient-interrogation-view-model";
import { buildMultiscalePathwayBridge } from "./multiscale-pathway-bridge";
import { buildActiveNutrientTargets } from "./pathway-cofactors-to-nutrient-targets";
import { buildNutritionPathwayModulationViewModel } from "./pathway-modulation-model";

test("nutrient interrogation: B1 collegato a enzyme.pdh quando multiscala L1/L2", () => {
  const physiologyL12 = {
    performanceProfile: { redoxStressIndex: 58 },
    lactateProfile: { gutStressScore: 0.1, bloodDeliveryPctOfIngested: 95 },
    bioenergeticProfile: {},
    metabolicProfile: {},
    recoveryProfile: {},
    physiologicalProfile: {},
  } as never;
  const bridge = buildMultiscalePathwayBridge({
    physiology: physiologyL12,
    twin: { glycogenStatus: 35, readiness: 40 },
  });
  assert.ok(bridge?.subgraphNodeIds.includes("enzyme.pdh"));
  const vm = buildNutritionPathwayModulationViewModel({
    date: "2026-05-30",
    plannedSessions: [{ id: "1", label: "Threshold", builderSession: null }],
    physiology: physiologyL12,
    twin: { glycogenStatus: 35 },
    multiscaleBridge: bridge,
  });
  const targets = buildActiveNutrientTargets({
    cofactorStrings: vm.pathways.flatMap((p) => p.cofactors),
  });
  const interrogation = buildNutrientInterrogationViewModel({
    activeTargets: targets,
    multiscaleBridge: bridge,
  });
  assert.ok(interrogation);
  const b1 = interrogation!.items.find((i) => i.nutrientId === "thiamineB1_mg");
  assert.ok(b1);
  assert.ok(b1!.subDomains.includes("enzyme_flux"));
  assert.ok(
    b1!.activatedNodes.some((n) => n.id === "enzyme.pdh") ||
      b1!.rationaleIt.toLowerCase().includes("piruvato"),
  );
});
