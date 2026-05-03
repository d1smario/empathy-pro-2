import test from "node:test";
import assert from "node:assert/strict";
import { buildWahooPlanJsonFromGeneratedSession, sessionSupportsWahooStructuredPlan } from "./wahoo-plan-from-generated-session";
import type { GeneratedSession } from "@/lib/training/engine/types";

const minimalSession = (overrides: Partial<GeneratedSession> = {}): GeneratedSession => ({
  sport: "cycling",
  domain: "endurance",
  goalLabel: "Test",
  physiologicalTarget: "mitochondrial_density",
  expectedLoad: { loadBand: "moderate", tssHint: 60 },
  blocks: [
    {
      order: 1,
      label: "Riscaldamento",
      method: "steady",
      targetSystem: "aerobic",
      durationMinutes: 10,
      intensityCue: "Z2 easy",
      expectedAdaptation: "mitochondrial_density",
      exerciseIds: [],
    },
    {
      order: 2,
      label: "Lavoro",
      method: "interval",
      targetSystem: "aerobic",
      durationMinutes: 15,
      intensityCue: "Z4",
      expectedAdaptation: "vo2_max_support",
      exerciseIds: [],
    },
  ],
  rationale: [],
  ...overrides,
});

test("sessionSupportsWahooStructuredPlan: gym → false", () => {
  assert.equal(sessionSupportsWahooStructuredPlan(minimalSession({ domain: "gym" })), false);
});

test("buildWahooPlanJsonFromGeneratedSession: bike + watt", () => {
  const plan = buildWahooPlanJsonFromGeneratedSession({
    session: minimalSession(),
    planName: "Seduta test",
    intensityChannel: "watt",
    workoutTypeLocation: 0,
    ftpW: 250,
    hrMax: 180,
  });
  assert.ok(plan.header && typeof plan.header === "object");
  const h = plan.header as Record<string, unknown>;
  assert.equal(h.workout_type_family, 0);
  assert.equal(h.ftp, 250);
  assert.ok(Array.isArray(plan.intervals));
  assert.equal((plan.intervals as unknown[]).length, 2);
});

test("buildWahooPlanJsonFromGeneratedSession: run + threshold_hr header", () => {
  const plan = buildWahooPlanJsonFromGeneratedSession({
    session: minimalSession({ sport: "running" }),
    planName: "Easy run",
    intensityChannel: "hr",
    workoutTypeLocation: 1,
    ftpW: 250,
    hrMax: 190,
    thresholdHrBpm: 165,
  });
  const h = plan.header as Record<string, unknown>;
  assert.equal(h.workout_type_family, 1);
  assert.equal(h.max_hr, 190);
  assert.equal(h.threshold_hr, 165);
  const first = (plan.intervals as Array<Record<string, unknown>>)[0];
  const targets = first.targets as Array<Record<string, unknown>>;
  assert.equal(targets[0].type, "threshold_hr");
});
