import assert from "node:assert/strict";
import test from "node:test";

import { averagePowerWattsFromKjAndDuration, kilojoulesFromKcal, tssPlanExecutionRatio } from "@empathy/domain-bioenergetics";

test("averagePowerWattsFromKjAndDuration: 3600 kJ in 60 min => 1000 W", () => {
  const w = averagePowerWattsFromKjAndDuration(3600, 60);
  assert.equal(w, 1000);
});

test("kilojoulesFromKcal: 1000 kcal => 4184 kJ", () => {
  const kj = kilojoulesFromKcal(1000);
  assert.equal(kj, 4184);
});

test("tssPlanExecutionRatio: executed / planned", () => {
  assert.equal(tssPlanExecutionRatio(80, 100), 0.8);
  assert.equal(tssPlanExecutionRatio(0, 50), 0);
  assert.equal(tssPlanExecutionRatio(10, 0), null);
});
