import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTrainingImportIntent } from "@/lib/training/training-import-intent";

test("normalizeTrainingImportIntent maps calendar modes", () => {
  assert.equal(normalizeTrainingImportIntent("auto"), "auto");
  assert.equal(normalizeTrainingImportIntent("planned"), "planned");
  assert.equal(normalizeTrainingImportIntent("plan"), "planned");
  assert.equal(normalizeTrainingImportIntent("executed"), "executed");
  assert.equal(normalizeTrainingImportIntent(undefined), "executed");
});
