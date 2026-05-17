import assert from "node:assert/strict";
import test from "node:test";
import type { ExecutedWorkout } from "@empathy/domain-training";
import { buildSessionDetailVM } from "./session-detail-summary";

test("buildSessionDetailVM infers carico when stored tss is zero", () => {
  const vm = buildSessionDetailVM({
    id: "w1",
    athleteId: "a1",
    date: "2026-05-16",
    source: "garmin",
    durationMinutes: 116,
    tss: 0,
    kj: 6502,
    kcal: 1554,
    traceSummary: { hr_avg_bpm: 142 },
  } as ExecutedWorkout);
  const load = vm.kpi.find((t) => t.label === "Carico");
  assert.ok(load);
  assert.notEqual(load!.value, "0");
  assert.notEqual(load!.value, "—");
});
