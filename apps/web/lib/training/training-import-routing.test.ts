import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeTrainingImportIntent } from "@/lib/training/training-import-intent";
import {
  fitPayloadLooksLikeWorkoutPlan,
  fitStructuredFallbackAfterEmptyExecuted,
  resolveTrainingImportRoute,
} from "@/lib/training/training-import-routing";

test("normalizeTrainingImportIntent maps calendar modes", () => {
  assert.equal(normalizeTrainingImportIntent("auto"), "auto");
  assert.equal(normalizeTrainingImportIntent("planned"), "planned");
  assert.equal(normalizeTrainingImportIntent("plan"), "planned");
  assert.equal(normalizeTrainingImportIntent("executed"), "executed");
  assert.equal(normalizeTrainingImportIntent(undefined), "executed");
});

test("resolveTrainingImportRoute: ZWO auto → planned_structured program", () => {
  const zwo = Buffer.from(
    `<?xml version="1.0"?><workout_file><name>Test</name><workout><SteadyState Duration="600" Power="0.75"/></workout></workout_file>`,
    "utf8",
  );
  const route = resolveTrainingImportRoute({
    intent: "auto",
    fileName: "session.zwo",
    mimeType: "application/xml",
    buffer: zwo,
  });
  assert.equal(route.kind, "planned_structured");
  assert.equal(route.detectedKind, "program");
  if (route.kind === "planned_structured") {
    assert.equal(route.format, "zwo");
    assert.equal(route.routeReason, "zwo_structured");
  }
});

test("resolveTrainingImportRoute: CSV activity log auto → executed", () => {
  const csv = Buffer.from("timestamp,power_w,heart_rate\n2026-05-27T10:00:00Z,200,140\n", "utf8");
  const route = resolveTrainingImportRoute({
    intent: "auto",
    fileName: "power_trace.csv",
    mimeType: "text/csv",
    buffer: csv,
  });
  assert.equal(route.kind, "executed_activity");
  assert.equal(route.detectedKind, "executed");
});

test("FIT workout fixture routing (optional _t.fit)", () => {
  const fitPath = join(process.cwd(), "apps/web/_t.fit");
  let fit: Buffer;
  try {
    fit = readFileSync(fitPath);
  } catch {
    return;
  }
  assert.ok(fitPayloadLooksLikeWorkoutPlan(fit), "fixture should look like workout plan");
  const route = resolveTrainingImportRoute({
    intent: "auto",
    fileName: "trainingpeaks-workout.fit",
    mimeType: "application/octet-stream",
    buffer: fit,
  });
  assert.equal(route.kind, "planned_structured");
  assert.equal(route.detectedKind, "program");

  const fb = fitStructuredFallbackAfterEmptyExecuted({
    fileName: "trainingpeaks-workout.fit",
    mimeType: "application/octet-stream",
    buffer: fit,
    durationMinutes: 0,
    intent: "auto",
  });
  assert.ok(fb);
  assert.equal(fb?.format, "fit_workout");
});
