import assert from "node:assert/strict";
import test from "node:test";

import { pickGarminActivityStableId } from "@/lib/integrations/garmin-activity-stable-id";

test("pickGarminActivityStableId: numeric activityId wins over composite summaryId", () => {
  const r = {
    summaryId: "x6309f27-6a03029@cycling2d0",
    activityId: 5703414415,
    activityType: "CYCLING",
  };
  assert.equal(pickGarminActivityStableId(r), "5703414415");
});

test("pickGarminActivityStableId: digit-only activityId string wins over summaryId", () => {
  const r = {
    summaryID: "composite",
    activityID: "22852904392",
  };
  assert.equal(pickGarminActivityStableId(r), "22852904392");
});

test("pickGarminActivityStableId: falls back to summaryId when no numeric activity id", () => {
  const r = { summaryId: "abc-123", activityType: "RUNNING" };
  assert.equal(pickGarminActivityStableId(r), "abc-123");
});

test("pickGarminActivityStableId: null when empty", () => {
  assert.equal(pickGarminActivityStableId({ activityType: "X" }), null);
});
