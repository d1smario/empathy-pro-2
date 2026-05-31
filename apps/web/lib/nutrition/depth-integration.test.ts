import { test } from "node:test";
import assert from "node:assert/strict";
import { readFastingGlucoseMmolL, readLabMarkerValue } from "@/lib/health/lab-marker-resolver";
import { buildEvidencePathwayBridge } from "./evidence-pathway-bridge";
import { buildPathwayAbsorptionHints } from "./pathway-absorption-hints";
import { deriveBioDaySignalsFromAthleteMemory } from "./derive-bio-day-signals-from-memory";
import { buildNutritionPathwayModulationViewModel } from "./pathway-modulation-model";
import { buildHealthLabPathwayBridge } from "./health-lab-pathway-bridge";

test("lab-marker-resolver: glucose mg/dL → mmol/L", () => {
  const g = readFastingGlucoseMmolL({ glicemia: 90 });
  assert.ok(g != null && g > 4.8 && g < 5.2);
});

test("lab-marker-resolver: ferritin alias", () => {
  const row = readLabMarkerValue({ ferritin_ng_ml: 22 }, ["ferritin", "ferritin_ng_ml"]);
  assert.equal(row?.value, 22);
});

test("evidence-pathway-bridge: nutrition evidence item → cofactors", () => {
  const bridge = buildEvidencePathwayBridge({
    evidenceItems: [
      {
        id: "e1",
        module: "nutrition",
        title: "Iron absorption",
        nutritionTags: ["iron", "vitamin_c"],
      },
    ],
  });
  assert.ok(bridge.pathwayExtensions.length >= 1);
  assert.ok(bridge.cofactorStrings.some((c) => /ferro/i.test(c)));
});

test("pathway-absorption-hints: ferro pathway → iron hint", () => {
  const lab = buildHealthLabPathwayBridge({
    blood: { ferritin_ng_ml: 18 },
    panels: [],
    systemicModulationSnapshots: [],
  });
  const vm = buildNutritionPathwayModulationViewModel({
    date: "2026-05-30",
    plannedSessions: [],
    physiology: null,
    twin: null,
    healthLabBridge: lab,
  });
  const hints = buildPathwayAbsorptionHints(vm);
  assert.ok(hints.some((h) => h.nutrientId === "fe_mg"));
});

test("bio day signals lite: diary + low glycogen → suggestPeriChoBoost", () => {
  const sig = deriveBioDaySignalsFromAthleteMemory({
    profile: { id: "a1" },
    physiology: {},
    twin: { glycogenStatus: 40, readiness: 48 },
    nutrition: {
      diary: [{ date: "2026-05-28" }, { date: "2026-05-29" }, { date: "2026-05-30" }],
    },
    health: { panels: [], systemicModulationSnapshots: [] },
  } as never);
  assert.equal(sig.suggestPeriChoBoost, true);
});
