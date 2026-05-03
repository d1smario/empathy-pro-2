import test from "node:test";
import assert from "node:assert/strict";
import {
  dedupeWhoopRecordsById,
  extractWhoopListRecords,
  extractWhoopNextToken,
  whoopRecordPrimaryId,
} from "@/lib/integrations/whoop-collection-response";

test("extractWhoopNextToken accetta next_token e nextToken", () => {
  assert.equal(extractWhoopNextToken({ records: [], next_token: "abc" }), "abc");
  assert.equal(extractWhoopNextToken({ records: [], nextToken: " def " }), "def");
  assert.equal(extractWhoopNextToken({ records: [], next_token: "" }), null);
  assert.equal(extractWhoopNextToken({ records: [] }), null);
});

test("extractWhoopListRecords legge records", () => {
  const r = extractWhoopListRecords({ records: [{ id: "1" }, { id: "2" }] });
  assert.equal(r.length, 2);
});

test("whoopRecordPrimaryId stringa o numero", () => {
  assert.equal(whoopRecordPrimaryId({ id: "uuid-here" }), "uuid-here");
  assert.equal(whoopRecordPrimaryId({ id: 42 }), "42");
  assert.equal(whoopRecordPrimaryId({}), null);
});

test("dedupeWhoopRecordsById mantiene ultima occorrenza", () => {
  const out = dedupeWhoopRecordsById([
    { id: "a", v: 1 },
    { id: "a", v: 2 },
    { id: "b", v: 3 },
  ]);
  assert.equal(out.length, 2);
  assert.equal((out.find((x) => x.id === "a") as { v: number }).v, 2);
});
