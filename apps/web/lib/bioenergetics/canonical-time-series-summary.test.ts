import assert from "node:assert/strict";
import test from "node:test";

import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";
import { summarizeCanonicalTimeSeriesRows } from "@/lib/bioenergetics/canonical-time-series-summary";

test("summarizeCanonicalTimeSeriesRows conta canali noti", () => {
  const rows = [
    { channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L },
    { channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L },
    { channel: ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L },
  ] as Array<Record<string, unknown>>;
  const s = summarizeCanonicalTimeSeriesRows(rows);
  assert.equal(s.glucoseSampleCount, 2);
  assert.equal(s.lactateSampleCount, 1);
});

test("summarizeCanonicalTimeSeriesRows assente o vuoto → zeri", () => {
  assert.deepEqual(summarizeCanonicalTimeSeriesRows(undefined), { glucoseSampleCount: 0, lactateSampleCount: 0 });
  assert.deepEqual(summarizeCanonicalTimeSeriesRows([]), { glucoseSampleCount: 0, lactateSampleCount: 0 });
});
