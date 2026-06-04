import test from "node:test";
import assert from "node:assert/strict";
import {
  dedupePlannedWorkoutDbRows,
  plannedWorkoutDedupeFingerprint,
} from "@/lib/training/planned/planned-workout-dedupe-fingerprint";

test("plannedWorkoutDedupeFingerprint uses import checksum when present", () => {
  const fp = plannedWorkoutDedupeFingerprint({
    type: "ciclismo",
    duration_minutes: 60,
    tss_target: 50,
    kcal_target: null,
    notes: "foo [EMPATHY_IMPORT:checksum=abc123def] bar",
  });
  assert.equal(fp, "import:abc123def");
});

test("plannedWorkoutDedupeFingerprint uses import_sha1 when present", () => {
  const fp = plannedWorkoutDedupeFingerprint({
    type: "pro2_builder_structured_zwo",
    duration_minutes: 60,
    tss_target: 50,
    kcal_target: null,
    notes: "[STRUCTURED_PLAN_IMPORT] zwo import_sha1=deadbeef",
  });
  assert.equal(fp, "import_sha1:deadbeef");
});

test("plannedWorkoutDedupeFingerprint uses builder payload when present", () => {
  const payload = encodeURIComponent(JSON.stringify({ version: 1, discipline: "run" }));
  const fp = plannedWorkoutDedupeFingerprint({
    type: "pro2_builder",
    duration_minutes: 60,
    tss_target: 50,
    kcal_target: null,
    notes: `meta\nBUILDER_SESSION_JSON::${payload}`,
  });
  assert.equal(fp, `builder:${payload}`);
});

test("plannedWorkoutDedupeFingerprint falls back to operational fields", () => {
  const fp = plannedWorkoutDedupeFingerprint({
    type: "ciclismo",
    duration_minutes: 45,
    tss_target: 30,
    kcal_target: 400,
    notes: "plain notes",
  });
  assert.equal(fp, "ops:ciclismo|45|30|400");
});

test("dedupePlannedWorkoutDbRows collapses builder same type same day", () => {
  const payload = encodeURIComponent(JSON.stringify({ version: 1, discipline: "run", summary: { durationSec: 3600 } }));
  const notesA = `[PRO2_BUILDER]\nBUILDER_SESSION_JSON::${payload}`;
  const notesB = `[PRO2_BUILDER]\nBUILDER_SESSION_JSON::${encodeURIComponent(JSON.stringify({ version: 1, discipline: "run", summary: { durationSec: 7200 } }))}`;
  const out = dedupePlannedWorkoutDbRows([
    {
      id: "a",
      date: "2026-05-27",
      type: "pro2_builder_mitochondrial_density",
      duration_minutes: 60,
      tss_target: 50,
      kcal_target: null,
      notes: notesA,
      created_at: "2026-05-26T10:00:00+00:00",
    },
    {
      id: "b",
      date: "2026-05-27",
      type: "pro2_builder_mitochondrial_density",
      duration_minutes: 120,
      tss_target: 100,
      kcal_target: null,
      notes: notesB,
      created_at: "2026-05-26T20:00:00+00:00",
    },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.id, "b");
});

test("dedupePlannedWorkoutDbRows collapses pro2_builder type without notes (calendar lite select)", () => {
  const out = dedupePlannedWorkoutDbRows([
    {
      id: "old",
      date: "2026-06-05",
      type: "pro2_builder_mitochondrial_density",
      duration_minutes: 60,
      tss_target: 50,
      kcal_target: null,
      notes: null,
      created_at: "2026-06-04T10:00:00+00:00",
    },
    {
      id: "new",
      date: "2026-06-05",
      type: "pro2_builder_mitochondrial_density",
      duration_minutes: 75,
      tss_target: 55,
      kcal_target: null,
      notes: null,
      created_at: "2026-06-04T18:00:00+00:00",
    },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.id, "new");
});
