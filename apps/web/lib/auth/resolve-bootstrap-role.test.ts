import assert from "node:assert/strict";
import test from "node:test";
import { resolveBootstrapRole } from "./resolve-bootstrap-role";

test("resolveBootstrapRole: new profile uses requested", () => {
  assert.equal(resolveBootstrapRole("private", null), "private");
  assert.equal(resolveBootstrapRole("coach", null), "coach");
});

test("resolveBootstrapRole: never downgrades coach to private", () => {
  assert.equal(
    resolveBootstrapRole("private", { role: "coach", platform_coach_status: "approved" }),
    "coach",
  );
  assert.equal(
    resolveBootstrapRole("private", { role: "coach", platform_coach_status: "pending" }),
    "coach",
  );
});

test("resolveBootstrapRole: private may request coach", () => {
  assert.equal(resolveBootstrapRole("coach", { role: "private" }), "coach");
  assert.equal(resolveBootstrapRole("private", { role: "private" }), "private");
});
