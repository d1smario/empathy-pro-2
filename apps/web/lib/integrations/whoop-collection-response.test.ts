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

test("whoopRecordPrimaryId: recovery usa cycle_id / sleep_id", () => {
  assert.equal(whoopRecordPrimaryId({ cycle_id: 93845, sleep_id: "abc" }), "whoop_cycle:93845");
  assert.equal(whoopRecordPrimaryId({ sleep_id: "solo-sleep" }), "whoop_sleep_ref:solo-sleep");
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
