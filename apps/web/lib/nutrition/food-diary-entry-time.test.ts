import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultFoodDiaryEntryTimeHmsForMealSlot,
  normalizeFoodDiaryEntryTimeHms,
  resolveFoodDiaryEntryTimeForInsert,
} from "@/lib/nutrition/food-diary-entry-time";

test("normalizeFoodDiaryEntryTimeHms", () => {
  assert.equal(normalizeFoodDiaryEntryTimeHms("9:05"), "09:05:00");
  assert.equal(normalizeFoodDiaryEntryTimeHms("13:00:00"), "13:00:00");
});

test("resolveFoodDiaryEntryTimeForInsert: fallback slot se input non valido", () => {
  assert.equal(resolveFoodDiaryEntryTimeForInsert(null, "breakfast"), defaultFoodDiaryEntryTimeHmsForMealSlot("breakfast"));
  assert.equal(resolveFoodDiaryEntryTimeForInsert("xx", "lunch"), "13:00:00");
});
