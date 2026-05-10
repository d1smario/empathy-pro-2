import test from "node:test";
import assert from "node:assert/strict";
import {
  METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1,
  buildMetabolicEndocrineInteractionReportV1,
} from "./metabolic-endocrine-interaction-skeleton-v1";

const richMealSnapshot = {
  mealEntryCount: 2,
  mealWithMacroCount: 2,
  executedSessionCount: 1,
  plannedSessionCount: 0,
  stress01: 0.42,
  longestInterMealGapHours: 6.2 as number | null,
};

test("grafo v1 include arco sleep → gh_pulse e igf1_lab → gh_pulse", () => {
  const arcS = METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1.find((e) => e.from === "sleep" && e.to === "gh_pulse");
  assert.ok(arcS);
  assert.ok(arcS!.requires.includes("sleep_context"));
  const arcI = METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1.find((e) => e.from === "igf1_lab" && e.to === "gh_pulse");
  assert.ok(arcI);
  assert.ok(arcI!.requires.includes("lab_anchor"));
});

test("senza sleepContext: nodo sleep blocked, ghrelin high → GH resta partial", () => {
  const r = buildMetabolicEndocrineInteractionReportV1(richMealSnapshot);
  const sleep = r.nodes.find((n) => n.nodeId === "sleep");
  const gh = r.nodes.find((n) => n.nodeId === "gh_pulse");
  assert.equal(sleep?.observability, "blocked");
  assert.equal(gh?.observability, "partial");
});

test("con sleepContext presente e ore: sleep high e GH high se ghrelin high", () => {
  const r = buildMetabolicEndocrineInteractionReportV1({
    ...richMealSnapshot,
    sleepContext: { present: true, maxSleepHours: 8 },
  });
  const sleep = r.nodes.find((n) => n.nodeId === "sleep");
  const gh = r.nodes.find((n) => n.nodeId === "gh_pulse");
  assert.equal(sleep?.observability, "high");
  assert.equal(gh?.observability, "high");
});

test("report espone 7 nodi (sleep, leptin, ghrelin, gh, insulin, lactate, cortisol)", () => {
  const r = buildMetabolicEndocrineInteractionReportV1({
    mealEntryCount: 0,
    mealWithMacroCount: 0,
    executedSessionCount: 0,
    plannedSessionCount: 0,
    stress01: 0.3,
    longestInterMealGapHours: null,
  });
  assert.equal(r.nodes.length, 7);
  assert.ok(r.nodes.some((n) => n.nodeId === "leptin_energy_balance"));
});

test("leptin/energia blocked senza diario né CHO", () => {
  const r = buildMetabolicEndocrineInteractionReportV1({
    mealEntryCount: 0,
    mealWithMacroCount: 0,
    executedSessionCount: 0,
    plannedSessionCount: 0,
    stress01: 0.3,
    longestInterMealGapHours: null,
    choIntakeGramsDay: 0,
  });
  const lep = r.nodes.find((n) => n.nodeId === "leptin_energy_balance");
  assert.equal(lep?.observability, "blocked");
});

test("leptin/energia high con CHO elevato e insulinica kernel", () => {
  const r = buildMetabolicEndocrineInteractionReportV1({
    mealEntryCount: 3,
    mealWithMacroCount: 3,
    executedSessionCount: 0,
    plannedSessionCount: 0,
    stress01: 0.35,
    longestInterMealGapHours: 4,
    choIntakeGramsDay: 300,
    insulinDemandScore01: 60,
  });
  const lep = r.nodes.find((n) => n.nodeId === "leptin_energy_balance");
  assert.equal(lep?.observability, "high");
});

test("GH: ghrelina blocked ma IGF-1 in panel → osservabilità partial (lab)", () => {
  const r = buildMetabolicEndocrineInteractionReportV1({
    mealEntryCount: 0,
    mealWithMacroCount: 0,
    executedSessionCount: 0,
    plannedSessionCount: 0,
    stress01: 0.3,
    longestInterMealGapHours: null,
    somatoaxisLab: { hasGhLab: false, hasIgf1Lab: true },
  });
  const gh = r.nodes.find((n) => n.nodeId === "gh_pulse");
  assert.equal(gh?.observability, "partial");
  assert.ok(gh?.rationaleIt.includes("IGF-1"));
});
