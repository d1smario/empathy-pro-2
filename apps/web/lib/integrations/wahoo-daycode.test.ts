import test from "node:test";
import assert from "node:assert/strict";
import { wahooDayCodeFromUtcDate } from "./wahoo-daycode";

test("wahooDayCodeFromUtcDate: 2020-01-01 → 1", () => {
  assert.equal(wahooDayCodeFromUtcDate("2020-01-01"), 1);
});

test("wahooDayCodeFromUtcDate: 2021-01-01 → 367 (366 giorni dopo 2020-01-01, 2020 bisestile)", () => {
  assert.equal(wahooDayCodeFromUtcDate("2021-01-01"), 367);
});
