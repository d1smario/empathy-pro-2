import assert from "node:assert/strict";
import test from "node:test";
import { isMissingRelationError } from "./missing-relation-error";

test("isMissingRelationError: schema cache PostgREST", () => {
  assert.equal(
    isMissingRelationError({
      message: "Could not find the table 'public.athlete_coach_application_traces' in the schema cache",
      code: "",
    }),
    true,
  );
});

test("isMissingRelationError: 42P01", () => {
  assert.equal(isMissingRelationError({ message: "relation missing", code: "42P01" }), true);
});

test("isMissingRelationError: errore reale non mascherato", () => {
  assert.equal(isMissingRelationError({ message: "permission denied for table foo", code: "42501" }), false);
});
