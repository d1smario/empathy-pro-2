import test from "node:test";
import assert from "node:assert/strict";
import { buildGrantNoticeCopy } from "./grant-user-notice-copy";

test("buildGrantNoticeCopy: ambassador note in title", () => {
  const { title, body } = buildGrantNoticeCopy({
    kind: "comp",
    durationMonths: 12,
    endsAt: "2026-12-31T00:00:00.000Z",
    note: "Ambassador program",
  });
  assert.match(title, /Ambassador/i);
  assert.match(body, /12 mesi/i);
});
