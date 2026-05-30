import { test } from "node:test";
import assert from "node:assert/strict";
import { getMemorySliceQueryFlags, type MemorySlice } from "@/lib/memory/athlete-memory-slice-types";

test("training slice skips health graph and food diary", () => {
  const flags = getMemorySliceQueryFlags("training");
  assert.equal(flags.healthSystemGraph, false);
  assert.equal(flags.foodDiary, false);
  assert.equal(flags.trainingArchetypeTraces, true);
  assert.equal(flags.realityIngest, true);
});

test("nutrition slice loads diary and constraints but not training traces", () => {
  const flags = getMemorySliceQueryFlags("nutrition");
  assert.equal(flags.foodDiary, true);
  assert.equal(flags.nutritionConstraints, true);
  assert.equal(flags.trainingArchetypeTraces, false);
  assert.equal(flags.healthSystemGraph, false);
});

test("dashboard slice loads evidence and recovery signals but not diary", () => {
  const flags = getMemorySliceQueryFlags("dashboard");
  assert.equal(flags.evidenceHits, true);
  assert.equal(flags.systemicModulation, true);
  assert.equal(flags.bioenergeticsResponses, true);
  assert.equal(flags.foodDiary, false);
  assert.equal(flags.healthSystemGraph, false);
});

test("full slice enables all domains", () => {
  const flags = getMemorySliceQueryFlags("full");
  for (const key of Object.keys(flags) as Array<keyof ReturnType<typeof getMemorySliceQueryFlags>>) {
    assert.equal(flags[key], true);
  }
});

test("non-full slices omit ingest payload on list queries", () => {
  for (const slice of ["training", "nutrition", "dashboard"] as MemorySlice[]) {
    assert.equal(getMemorySliceQueryFlags(slice).includeIngestPayload, false);
  }
});
