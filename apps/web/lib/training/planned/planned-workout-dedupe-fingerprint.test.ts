import { describe, expect, test } from "vitest";
import { plannedWorkoutDedupeFingerprint } from "@/lib/training/planned/planned-workout-dedupe-fingerprint";

describe("plannedWorkoutDedupeFingerprint", () => {
  test("uses import checksum when present", () => {
    const fp = plannedWorkoutDedupeFingerprint({
      type: "ciclismo",
      duration_minutes: 60,
      tss_target: 50,
      kcal_target: null,
      notes: "foo [EMPATHY_IMPORT:checksum=abc123def] bar",
    });
    expect(fp).toBe("import:abc123def");
  });

  test("uses import_sha1 when present", () => {
    const fp = plannedWorkoutDedupeFingerprint({
      type: "pro2_builder_structured_zwo",
      duration_minutes: 60,
      tss_target: 50,
      kcal_target: null,
      notes: "[STRUCTURED_PLAN_IMPORT] zwo import_sha1=deadbeef",
    });
    expect(fp).toBe("import_sha1:deadbeef");
  });

  test("uses builder payload when present", () => {
    const payload = encodeURIComponent(JSON.stringify({ version: 1, discipline: "run" }));
    const fp = plannedWorkoutDedupeFingerprint({
      type: "pro2_builder",
      duration_minutes: 60,
      tss_target: 50,
      kcal_target: null,
      notes: `meta\nBUILDER_SESSION_JSON::${payload}`,
    });
    expect(fp).toBe(`builder:${payload}`);
  });

  test("falls back to operational fields", () => {
    const fp = plannedWorkoutDedupeFingerprint({
      type: "ciclismo",
      duration_minutes: 45,
      tss_target: 30,
      kcal_target: 400,
      notes: "plain notes",
    });
    expect(fp).toBe("ops:ciclismo|45|30|400");
  });
});
