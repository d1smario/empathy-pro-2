import assert from "node:assert/strict";
import test from "node:test";
import { resolveExecutedAvgPowerW, resolveExecutedKcal } from "./resolve-executed-session-energy";

test("resolveExecutedKcal from kj when kcal column zero", () => {
  const kcal = resolveExecutedKcal({
    storedKcal: 0,
    storedKj: 6502,
    durationMinutes: 116,
    traceSummary: null,
  });
  assert.ok(kcal > 1500);
});

test("resolveExecutedAvgPowerW from kj and duration", () => {
  const w = resolveExecutedAvgPowerW({
    storedKj: 6502,
    durationMinutes: 116,
    traceSummary: null,
  });
  assert.ok(w != null && w > 50);
});
