import assert from "node:assert/strict";
import test from "node:test";
import { addIsoDays, mondayOfIsoWeek } from "./iso-day-arithmetic";

test("addIsoDays: weekStart + offsets match calendar Mon–Sun", () => {
  const weekStart = "2026-06-01";
  assert.equal(addIsoDays(weekStart, 0), "2026-06-01");
  assert.equal(addIsoDays(weekStart, 3), "2026-06-04");
  assert.equal(addIsoDays(weekStart, 4), "2026-06-05");
  assert.equal(addIsoDays(weekStart, 5), "2026-06-06");
  assert.equal(addIsoDays(weekStart, 6), "2026-06-07");
});

test("mondayOfIsoWeek: giovedì → lunedì stessa settimana", () => {
  assert.equal(mondayOfIsoWeek("2026-06-04"), "2026-06-01");
});
