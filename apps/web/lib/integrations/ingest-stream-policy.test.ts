import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WHOOP_INGEST_STREAMS,
  mergeIngestStreamsWithDefaults,
  parseIngestStreamEnabled,
} from "@empathy/contracts";

test("parseIngestStreamEnabled accetta boolean e oggetto { enabled }", () => {
  assert.equal(parseIngestStreamEnabled(true), true);
  assert.equal(parseIngestStreamEnabled(false), false);
  assert.equal(parseIngestStreamEnabled({ enabled: true }), true);
  assert.equal(parseIngestStreamEnabled({ enabled: false }), false);
  assert.equal(parseIngestStreamEnabled({}), false);
  assert.equal(parseIngestStreamEnabled(null), false);
});

test("mergeIngestStreamsWithDefaults: senza DB restano default WHOOP (workout false)", () => {
  const m = mergeIngestStreamsWithDefaults(undefined, { ...DEFAULT_WHOOP_INGEST_STREAMS });
  assert.equal(m.whoop_workout, false);
  assert.equal(m.whoop_sleep, true);
});

test("mergeIngestStreamsWithDefaults: DB abilita workout WHOOP", () => {
  const m = mergeIngestStreamsWithDefaults({ whoop_workout: true }, { ...DEFAULT_WHOOP_INGEST_STREAMS });
  assert.equal(m.whoop_workout, true);
  assert.equal(m.whoop_sleep, true);
});

test("mergeIngestStreamsWithDefaults: ignora chiavi sconosciute nel JSON", () => {
  const m = mergeIngestStreamsWithDefaults({ whoop_workout: false, other: true } as Record<string, unknown>, {
    ...DEFAULT_WHOOP_INGEST_STREAMS,
  });
  assert.equal(m.whoop_workout, false);
});
