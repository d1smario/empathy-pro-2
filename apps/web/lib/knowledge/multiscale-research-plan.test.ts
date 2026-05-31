import assert from "node:assert/strict";
import test from "node:test";
import {
  buildResearchPlanFromMultiscaleActivation,
  meetsMultiscaleResearchActivationGate,
  plansToSyncFromMultiscaleActivation,
} from "./multiscale-research-plan";
import { buildMultiscalePathwayBridge } from "@/lib/nutrition/multiscale-pathway-bridge";

const physiology = {
  performanceProfile: { redoxStressIndex: 58, oxidativeBottleneckIndex: 65 },
  lactateProfile: { gutStressScore: 0.1, bloodDeliveryPctOfIngested: 95 },
  bioenergeticProfile: {},
  metabolicProfile: {},
  recoveryProfile: {},
  physiologicalProfile: {},
} as never;

test("multiscale research plan: gate attivo con redox + nodi", () => {
  const bridge = buildMultiscalePathwayBridge({ physiology, twin: { inflammationRisk: 60, glycogenStatus: 35 } });
  assert.ok(bridge);
  assert.ok(meetsMultiscaleResearchActivationGate(bridge!));
});

test("multiscale research plan: produce piani nutrition deterministici", () => {
  const bridge = buildMultiscalePathwayBridge({ physiology, twin: { inflammationRisk: 60, glycogenStatus: 35 } })!;
  const plans = buildResearchPlanFromMultiscaleActivation({
    athleteId: "ath-1",
    anchorDate: "2026-05-30",
    bridge,
  });
  assert.ok(plans.length >= 1 && plans.length <= 3);
  assert.ok(plans.every((p) => p.trigger.module === "nutrition"));
  assert.ok(plans.some((p) => p.trigger.kind === "modulation_followup"));
});

test("multiscale research plan: dedup su summary esistente", () => {
  const bridge = buildMultiscalePathwayBridge({ physiology, twin: { inflammationRisk: 60 } })!;
  const plans = buildResearchPlanFromMultiscaleActivation({
    athleteId: "ath-1",
    anchorDate: "2026-05-30",
    bridge,
  });
  const existing = plans.map((plan) => ({
    traceId: "t1",
    status: "ready" as const,
    trigger: plan.trigger,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hopCounts: { total: 4, planned: 4, running: 0, complete: 0 },
    linkCounts: { documents: 0, assertions: 0 },
  }));
  const toSync = plansToSyncFromMultiscaleActivation(
    { athleteId: "ath-1", anchorDate: "2026-05-30", bridge },
    existing,
  );
  assert.equal(toSync.length, 0);
});
