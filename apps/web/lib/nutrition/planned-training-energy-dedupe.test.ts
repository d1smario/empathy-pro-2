import test from "node:test";
import assert from "node:assert/strict";
import { dedupePlannedTrainingForNutritionEnergy } from "@/lib/nutrition/planned-training-energy-dedupe";

test("dedupePlannedTrainingForNutritionEnergy drops VIRYA when Builder exists", () => {
  const rows = dedupePlannedTrainingForNutritionEnergy([
    {
      notes: "[VIRYA:Plan A]\nBUILDER_SESSION_JSON::%7B%7D",
      durationMinutes: 90,
      kcalTarget: 800,
    },
    {
      notes: "[PRO2_BUILDER_ENGINE]\nBUILDER_SESSION_JSON::%7B%7D",
      durationMinutes: 60,
      kcalTarget: 500,
    },
  ]);
  assert.equal(rows.length, 1);
  assert.match(rows[0]?.notes ?? "", /PRO2_BUILDER/);
  assert.doesNotMatch(rows[0]?.notes ?? "", /\[VIRYA:/);
});
