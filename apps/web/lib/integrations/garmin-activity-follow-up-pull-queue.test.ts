import assert from "node:assert/strict";
import test from "node:test";

import {
  extractGarminPullTokenFromCallbackUrl,
  readUploadWindowFromCallbackUrl,
  scanJsonForGarminPullToken,
} from "@/lib/integrations/garmin-activity-follow-up-url";
import { garminActivitySummaryNeedsBinaryFollowUp } from "@/lib/integrations/garmin-activity-materialize";

test("extractGarminPullTokenFromCallbackUrl reads token query", () => {
  const url =
    "https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=1&uploadEndTimeInSeconds=2&token=abc%2Bdef";
  assert.equal(extractGarminPullTokenFromCallbackUrl(url), "abc+def");
});

test("readUploadWindowFromCallbackUrl parses upload pair", () => {
  const url =
    "https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=100&uploadEndTimeInSeconds=200&token=t";
  assert.deepEqual(readUploadWindowFromCallbackUrl(url), { start: 100, end: 200 });
});

test("scanJsonForGarminPullToken finds nested callback URL", () => {
  const payload = {
    activities: [
      {
        summaryId: "9",
        startTimeInSeconds: 1_700_000_000,
        durationInSeconds: 120,
        activityType: "WALKING",
        samples: [{ heartRate: 100 }],
        deep: {
          other: "https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=1&uploadEndTimeInSeconds=9&token=inlineTok%2Bxx",
        },
      },
    ],
  };
  assert.equal(scanJsonForGarminPullToken(payload), "inlineTok+xx");
});

test("garminActivitySummaryNeedsBinaryFollowUp: sparse samples -> true", () => {
  assert.equal(garminActivitySummaryNeedsBinaryFollowUp({ samples: [{ heartRate: 120 }] }), true);
});

test("garminActivitySummaryNeedsBinaryFollowUp: many HR-only samples still need FIT/GPX path", () => {
  const samples = Array.from({ length: 30 }, (_, i) => ({ heartRate: 120 + i }));
  assert.equal(garminActivitySummaryNeedsBinaryFollowUp({ samples }), true);
});

test("garminActivitySummaryNeedsBinaryFollowUp: one GPS point with rich HR is not enough polyline", () => {
  const samples = [
    ...Array.from({ length: 28 }, (_, i) => ({ heartRate: 120 + i })),
    { latitudeInDegree: 45.0, longitudeInDegree: 9.0, heartRate: 140 },
  ];
  assert.equal(samples.length >= 24, true);
  assert.equal(garminActivitySummaryNeedsBinaryFollowUp({ samples }), true);
});

test("garminActivitySummaryNeedsBinaryFollowUp: 24+ samples and 2+ GPS -> skip binary follow-up", () => {
  const samples = [
    ...Array.from({ length: 22 }, () => ({ heartRate: 120 })),
    { latitudeInDegree: 45.0, longitudeInDegree: 9.0, heartRate: 120 },
    { latitudeInDegree: 45.01, longitudeInDegree: 9.01, heartRate: 121 },
  ];
  assert.equal(samples.length, 24);
  assert.equal(garminActivitySummaryNeedsBinaryFollowUp({ samples }), false);
});

test("garminActivitySummaryNeedsBinaryFollowUp: duplicate GPS coords still need FIT (no real polyline)", () => {
  const samples = [
    ...Array.from({ length: 22 }, () => ({ heartRate: 120 })),
    { latitudeInDegree: 45.0, longitudeInDegree: 9.0, heartRate: 120 },
    { latitudeInDegree: 45.0, longitudeInDegree: 9.0, heartRate: 121 },
  ];
  assert.equal(samples.length, 24);
  assert.equal(garminActivitySummaryNeedsBinaryFollowUp({ samples }), true);
});
