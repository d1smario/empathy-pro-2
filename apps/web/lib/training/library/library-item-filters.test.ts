import test from "node:test";
import assert from "node:assert/strict";
import {
  filterCoachLibraryItemRows,
  libraryRowMatchesTag,
} from "./library-item-filters";
import type { CoachWorkoutLibraryItemRow } from "./coach-workout-library-types";

function row(partial: Partial<CoachWorkoutLibraryItemRow>): CoachWorkoutLibraryItemRow {
  return {
    id: "1",
    org_id: "o",
    coach_user_id: "c",
    folder_id: null,
    title: "Test",
    description: "",
    family: "aerobic",
    discipline: "Cycling",
    sport_tags: ["Cycling"],
    duration_minutes: 60,
    tss_target: 50,
    contract_json: {} as CoachWorkoutLibraryItemRow["contract_json"],
    source_planned_workout_id: null,
    metadata: {},
    created_at: "",
    updated_at: "",
    ...partial,
  };
}

test("libraryRowMatchesTag: metadata.tags", () => {
  const r = row({ metadata: { tags: ["norwegian", "z4"] } });
  assert.equal(libraryRowMatchesTag(r, "norwegian"), true);
  assert.equal(libraryRowMatchesTag(r, "vo2"), false);
});

test("filterCoachLibraryItemRows: discipline + tag", () => {
  const rows = [
    row({ id: "a", discipline: "Running", metadata: { tags: ["polarized"] }, title: "Polarized run" }),
    row({ id: "b", discipline: "Cycling", metadata: { tags: ["polarized"] }, title: "Polarized bike" }),
    row({ id: "c", discipline: "Running", metadata: { tags: ["recovery"] }, title: "Recovery run" }),
  ];
  const filtered = filterCoachLibraryItemRows(rows, { discipline: "Running", tag: "polarized" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "a");
});

test("filterCoachLibraryItemRows: virya phase on metadata", () => {
  const rows = [
    row({ id: "a", metadata: { virya_phase: "build" } }),
    row({ id: "b", metadata: { virya_phase: "base" } }),
  ];
  const filtered = filterCoachLibraryItemRows(rows, { viryaPhase: "build" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, "a");
});
