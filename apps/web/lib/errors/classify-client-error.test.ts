import assert from "node:assert/strict";
import test from "node:test";
import { classifyClientError } from "./classify-client-error";

test("classify: chunk load → stale_bundle", () => {
  const c = classifyClientError(new Error("Loading chunk 123 failed"));
  assert.equal(c.kind, "stale_bundle");
  assert.equal(c.suggestHardReload, true);
});

test("classify: failed to fetch → network", () => {
  const c = classifyClientError(new Error("Failed to fetch"));
  assert.equal(c.kind, "network");
  assert.match(c.titleIt, /Connessione/i);
});

test("classify: unknown → generic", () => {
  const c = classifyClientError(new Error("Cannot read properties of undefined"));
  assert.equal(c.kind, "generic");
});
