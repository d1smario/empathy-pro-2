import assert from "node:assert/strict";
import test from "node:test";
import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";
import { buildCrossDomainInterpretationRoadmapV1 } from "./cross-domain-interpretation-roadmap";
import { buildHealthLabPathwayBridge } from "./health-lab-pathway-bridge";
import { buildNutritionPathwayModulationViewModel } from "./pathway-modulation-model";

test("cross-domain roadmap: grafo stabile con domini deferred quando non ci sono dati ricchi", () => {
  const r = buildCrossDomainInterpretationRoadmapV1({
    athleteId: "ath-test",
    anchorDate: "2026-05-07",
    pathwayModulation: null,
    plannedSessions: [],
    twin: null,
    physiology: null,
    recoverySummary: null,
    researchTraceSummaries: [],
    hasNutritionPerformanceIntegration: false,
  });
  assert.equal(r.schemaVersion, 1);
  assert.equal(r.layer, "interpretation_bridge_stub_v1");
  assert.ok(r.policyVersion.includes("cross_domain_interpretation"));
  assert.ok(r.nodes.some((n) => n.domainId === "epigenetics"));
  assert.ok(r.edges.some((e) => e.id === "e_food_nut"));
});

test("cross-domain roadmap: health lab pathway cabla physiology_engine", () => {
  const lab = buildHealthLabPathwayBridge({
    blood: { ferritin_ng_ml: 20 },
    panels: [],
    systemicModulationSnapshots: [],
  });
  const mod = buildNutritionPathwayModulationViewModel({
    date: "2026-05-30",
    plannedSessions: [],
    physiology: null,
    twin: null,
    healthLabBridge: lab,
  });
  const r = buildCrossDomainInterpretationRoadmapV1({
    athleteId: "a1",
    anchorDate: "2026-05-30",
    pathwayModulation: mod,
    plannedSessions: [],
    twin: null,
    physiology: null,
    recoverySummary: null,
    researchTraceSummaries: [],
    hasNutritionPerformanceIntegration: true,
  });
  const phys = r.nodes.find((n) => n.domainId === "physiology_engine");
  assert.equal(phys?.probeStatus, "wired_deterministic");
  assert.ok(r.edges.some((e) => e.id === "e_health_nut"));
});

test("cross-domain roadmap: microbiota cablato se compare nel riepilogo multilevel pathway", () => {
  const mod = {
    modelVersion: 1,
    layer: "deterministic_pathway_template",
    sessionDate: "2026-05-07",
    pathways: [],
    aggregateInhibitors: [],
    multiLevelSummary: {
      biochemical: ["Assorbimento CHO / barriera intestinale"],
      genetic: [],
      hormonal: [],
      neurologic: [],
      microbiota: ["Assorbimento CHO / barriera intestinale"],
    },
    notes: [],
  } satisfies NutritionPathwayModulationViewModel;

  const r = buildCrossDomainInterpretationRoadmapV1({
    athleteId: "ath-test",
    anchorDate: "2026-05-07",
    pathwayModulation: mod,
    plannedSessions: [{ label: "Endurance Z2", adaptationTarget: "aerobic_base" }],
    twin: { readiness: 70 },
    physiology: {
      performanceProfile: { redoxStressIndex: 40 },
      lactateProfile: { gutStressScore: 0.2, bloodDeliveryPctOfIngested: 90 },
    },
    recoverySummary: { status: "good", guidance: "Riposo adeguato" },
    researchTraceSummaries: [],
    hasNutritionPerformanceIntegration: true,
  });

  const gut = r.nodes.find((n) => n.domainId === "gut_microbiome");
  assert.equal(gut?.probeStatus, "wired_deterministic");
  assert.ok(r.edges.some((e) => e.fromDomain === "gut_microbiome"));
  assert.ok(r.stimulusAnchorsIt.some((s) => s.includes("Endurance")));
});
