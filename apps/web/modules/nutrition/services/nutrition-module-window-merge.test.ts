import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeNutritionTrainingRowsById,
  nutritionModuleWindowKeys,
} from "@/modules/nutrition/services/nutrition-module-window-merge";

test("nutritionModuleWindowKeys spans back and forward from anchor", () => {
  const anchor = new Date("2026-06-15T12:00:00");
  const w = nutritionModuleWindowKeys(7, 7, anchor);
  assert.equal(w.from, "2026-06-08");
  assert.equal(w.to, "2026-06-22");
});

test("mergeNutritionTrainingRowsById dedupes by id and prefers next row", () => {
  const merged = mergeNutritionTrainingRowsById(
    [{ id: "a", date: "2026-06-01", type: "old" }],
    [{ id: "a", date: "2026-06-01", type: "new" }, { id: "b", date: "2026-06-02", type: "x" }],
  );
  assert.equal(merged.length, 2);
  assert.equal((merged[0] as { type?: string }).type, "new");
  assert.equal(merged[1].id, "b");
});
