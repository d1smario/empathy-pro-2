import { test } from "node:test";
import assert from "node:assert/strict";
import type { AthleteHealthMemory } from "@/lib/empathy/schemas/memory";
import {
  buildHealthLabPathwayBridge,
  readHealthLabMarkerValue,
} from "./health-lab-pathway-bridge";
import { buildActiveNutrientTargets } from "./pathway-cofactors-to-nutrient-targets";
import { buildNutritionPathwayModulationViewModel } from "./pathway-modulation-model";

function healthWithBlood(values: Record<string, unknown>): AthleteHealthMemory {
  return {
    blood: values,
    panels: [{ type: "blood", values }],
    systemicModulationSnapshots: [],
  };
}

test("health-lab bridge: ferritina bassa (legacy ferritin_ng_ml) → ferro + vit C", () => {
  const bridge = buildHealthLabPathwayBridge(healthWithBlood({ ferritin_ng_ml: 18 }));
  assert.equal(bridge.markerSignals.length, 1);
  assert.equal(bridge.markerSignals[0]?.marker, "ferritina");
  assert.ok(bridge.cofactorStrings.some((c) => /ferro/i.test(c)));
  assert.ok(bridge.cofactorStrings.some((c) => /vit.*c/i.test(c)));
  assert.ok(bridge.pathwayExtension?.id === "health_lab_micronutrient_support");

  const targets = buildActiveNutrientTargets({ cofactorStrings: bridge.cofactorStrings });
  const ids = targets.map((t) => t.nutrientId);
  assert.ok(ids.includes("fe_mg"), `Atteso fe_mg, got: ${ids.join(", ")}`);
  assert.ok(ids.includes("vitC_mg"), `Atteso vitC_mg, got: ${ids.join(", ")}`);
});

test("health-lab bridge: B12 bassa → B12 + folati", () => {
  const bridge = buildHealthLabPathwayBridge(healthWithBlood({ b12: 180 }));
  assert.equal(bridge.markerSignals[0]?.marker, "b12");
  const targets = buildActiveNutrientTargets({ cofactorStrings: bridge.cofactorStrings });
  const ids = targets.map((t) => t.nutrientId);
  assert.ok(ids.includes("vitB12_mcg"));
  assert.ok(ids.includes("folate_mcg"));
});

test("health-lab bridge: vit D insufficiente → vitD target", () => {
  const bridge = buildHealthLabPathwayBridge(healthWithBlood({ vit_d: 22 }));
  assert.equal(bridge.markerSignals[0]?.marker, "vit_d");
  const targets = buildActiveNutrientTargets({ cofactorStrings: bridge.cofactorStrings });
  assert.ok(targets.some((t) => t.nutrientId === "vitD_mcg"));
});

test("health-lab bridge: valori normali → nessun pathway extension", () => {
  const bridge = buildHealthLabPathwayBridge(
    healthWithBlood({ ferritin_ng_ml: 80, b12: 450, vit_d: 45 }),
  );
  assert.equal(bridge.pathwayExtension, null);
  assert.equal(bridge.cofactorStrings.length, 0);
});

test("health-lab bridge: merge in pathway modulation view model", () => {
  const bridge = buildHealthLabPathwayBridge(healthWithBlood({ ferritin_ng_ml: 20 }));
  const vm = buildNutritionPathwayModulationViewModel({
    date: "2026-05-30",
    plannedSessions: [],
    physiology: null,
    twin: null,
    healthLabBridge: bridge,
  });
  assert.ok(vm.pathways.some((p) => p.id === "health_lab_micronutrient_support"));
  assert.ok(vm.notes.some((n) => /ferritina bassa/i.test(n)));
});

test("readHealthLabMarkerValue: alias ontology ferritina", () => {
  const row = readHealthLabMarkerValue({ ferritina: 28 }, "ferritina");
  assert.equal(row?.value, 28);
  assert.equal(row?.sourceKey, "ferritina");
});
