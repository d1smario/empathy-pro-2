import assert from "node:assert/strict";
import test from "node:test";
import {
  computeSubstrateFuelingPlan,
  intraChoReplaceFractionFromEnergyShare,
} from "@/lib/nutrition/v2/fueling-from-substrates";

test("alta intensità → replace CHO più alto che Z2", () => {
  const high = computeSubstrateFuelingPlan({
    sessions: [{ label: "Threshold", avgPowerW: 270, durationMin: 240 }],
    ftpW: 313,
    weightKg: 70,
  });
  const z2 = computeSubstrateFuelingPlan({
    sessions: [{ label: "Z2", avgPowerW: 180, durationMin: 240 }],
    ftpW: 313,
    weightKg: 70,
  });
  const hi = high.sessions[0]!;
  const lo = z2.sessions[0]!;
  assert.ok(hi.choEnergyShare > lo.choEnergyShare);
  assert.ok(hi.intraChoReplaceFraction >= lo.intraChoReplaceFraction);
  assert.ok(hi.intraChoG > lo.intraChoG, `intra CHO threshold ${hi.intraChoG} vs Z2 ${lo.intraChoG}`);
  assert.ok(high.totals.fuelingKcal > z2.totals.fuelingKcal);
});

test("intraChoReplaceFraction: share alto → ~85%", () => {
  assert.equal(intraChoReplaceFractionFromEnergyShare(0.92), 0.85);
  assert.equal(intraChoReplaceFractionFromEnergyShare(0.55), 0.55);
});

test("fueling kcal ≈ somma pre+intra+post CHO", () => {
  const plan = computeSubstrateFuelingPlan({
    sessions: [{ label: "Long", avgPowerW: 220, durationMin: 300 }],
    ftpW: 300,
    weightKg: 68,
  });
  const choKcal =
    plan.totals.preChoG * 4 + plan.totals.intraChoG * 4 + plan.totals.postChoG * 4;
  assert.equal(plan.totals.fuelingKcal, Math.round(choKcal));
});
