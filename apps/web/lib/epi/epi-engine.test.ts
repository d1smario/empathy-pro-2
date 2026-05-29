import test from "node:test";
import assert from "node:assert/strict";
import { computeEpi } from "./epi-engine";
import {
  COIN_PER_EFFICIENT_DAY,
  EPI_ALGORITHM_VERSION,
  EPI_EFFICIENT_DAY_MIN_SCORE,
  type EpiInputs,
} from "@/lib/empathy/schemas";

const AS_OF = "2026-05-29T08:00:00.000Z";

function baseInputs(overrides: Partial<EpiInputs> = {}): EpiInputs {
  return {
    athleteId: "athlete-1",
    asOf: AS_OF,
    ...overrides,
  };
}

test("full-data healthy athlete -> high score, extended tier, efficient day", () => {
  const out = computeEpi(
    baseInputs({
      executionCompliancePct: 98,
      fitnessChronic: 75,
      activityStreakDays: 12,
      readiness: 82,
      recoveryCapacity: 80,
      autonomicScore: 78,
      hrvMs: 95,
      hrvBaselineMs: 80,
      sleepCircadianScore: 85,
      sleepRecovery: 84,
      energyAdequacyRatio: 1.0,
      proteinGPerKg: 1.8,
      bodyFatPct: 12,
      phaseAngleScore: 80,
      sex: "male",
      adherencePct: 95,
      hasActivePlan: true,
      subjEnergy: 5,
      subjMood: 5,
      subjSleepQuality: 4,
      subjSoreness: 1,
      subjStress: 1,
      illnessFlags: [],
    }),
  );
  assert.equal(out.algorithmVersion, EPI_ALGORITHM_VERSION);
  assert.ok(out.score >= 80, `expected high score, got ${out.score}`);
  assert.equal(out.dataTier, "extended");
  assert.equal(out.illnessDay, false);
  assert.equal(out.efficientDay, true);
  assert.equal(out.coinAwardForDay, COIN_PER_EFFICIENT_DAY);
  assert.equal(out.provenance.pillarsMissing.length, 0);
});

test("score always within 0..100 and confidence within 0..1", () => {
  const out = computeEpi(
    baseInputs({
      executionCompliancePct: 250,
      fitnessChronic: 999,
      readiness: 100,
      energyAdequacyRatio: 5,
      subjEnergy: 5,
    }),
  );
  assert.ok(out.score >= 0 && out.score <= 100);
  assert.ok(out.confidence >= 0 && out.confidence <= 1);
});

test("no-device athlete with only check-in is not zeroed", () => {
  const out = computeEpi(
    baseInputs({
      subjEnergy: 4,
      subjMood: 4,
      subjSleepQuality: 4,
      subjSoreness: 2,
      subjStress: 2,
    }),
  );
  assert.ok(out.score > 0, "subjective-only should still produce a positive score");
  assert.equal(out.provenance.subjectiveCheckinPresent, true);
  assert.ok(out.dataTier === "minimal" || out.dataTier === "standard");
});

test("illness day suspends efficiency and awards no coins", () => {
  const out = computeEpi(
    baseInputs({
      executionCompliancePct: 100,
      readiness: 90,
      recoveryCapacity: 90,
      sleepCircadianScore: 90,
      sleepRecovery: 90,
      energyAdequacyRatio: 1,
      proteinGPerKg: 1.8,
      subjEnergy: 5,
      subjMood: 5,
      illnessFlags: ["fever", "headache"],
    }),
  );
  assert.equal(out.illnessDay, true);
  assert.equal(out.efficientDay, false);
  assert.equal(out.coinAwardForDay, 0);
  assert.deepEqual(out.provenance.illnessFlags, ["fever", "headache"]);
});

test("no efficient day without a completed check-in", () => {
  const out = computeEpi(
    baseInputs({
      executionCompliancePct: 100,
      readiness: 95,
      recoveryCapacity: 95,
      sleepCircadianScore: 95,
      sleepRecovery: 95,
      energyAdequacyRatio: 1,
      proteinGPerKg: 1.8,
      // no subjective scales -> check-in not completed
    }),
  );
  assert.ok(out.score >= EPI_EFFICIENT_DAY_MIN_SCORE, "score should be high");
  assert.equal(out.provenance.subjectiveCheckinPresent, false);
  assert.equal(out.efficientDay, false);
});

test("deterministic: same inputs -> identical output", () => {
  const inputs = baseInputs({
    executionCompliancePct: 88,
    readiness: 70,
    hrvMs: 70,
    hrvBaselineMs: 75,
    energyAdequacyRatio: 0.9,
    subjEnergy: 3,
    subjStress: 3,
  });
  const a = computeEpi(inputs);
  const b = computeEpi(inputs);
  assert.deepEqual(a, b);
});

test("empty inputs -> score 0, tier none, not efficient (no throw)", () => {
  const out = computeEpi(baseInputs());
  assert.equal(out.score, 0);
  assert.equal(out.dataTier, "none");
  assert.equal(out.efficientDay, false);
  assert.equal(out.provenance.pillarsAvailable.length, 0);
});

test("effective pillar weights renormalize to ~1 across available pillars", () => {
  const out = computeEpi(
    baseInputs({
      readiness: 80,
      sleepRecovery: 80,
    }),
  );
  const sum = out.pillars.filter((p) => p.available).reduce((s, p) => s + p.weight, 0);
  assert.ok(Math.abs(sum - 1) < 0.01, `expected weights ~1, got ${sum}`);
});
