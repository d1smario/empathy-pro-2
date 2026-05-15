import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveMealTimelineIsoTs } from "@/lib/bioenergetics/bioenergetic-day-timeline";

test("resolveMealTimelineIsoTs: entry_time HH:MM", () => {
  const ts = resolveMealTimelineIsoTs("2026-04-20", { entry_time: "07:45", meal_slot: "breakfast" }, 0);
  assert.equal(ts, "2026-04-20T07:45:00");
});

test("resolveMealTimelineIsoTs: senza orario usa meal_slot + scarto indice", () => {
  const b = resolveMealTimelineIsoTs("2026-04-20", { meal_slot: "breakfast" }, 0);
  const l = resolveMealTimelineIsoTs("2026-04-20", { meal_slot: "lunch" }, 1);
  assert.ok(b.includes("T08:15:00"));
  assert.match(l, /^2026-04-20T13:/);
  assert.notEqual(b, l);
});

test("resolveMealTimelineIsoTs: ISO con T prende solo l'ora", () => {
  const ts = resolveMealTimelineIsoTs("2026-04-20", { entry_time: "2026-04-20T09:12:33Z", meal_slot: "snack" }, 0);
  assert.equal(ts, "2026-04-20T09:12:33");
});
