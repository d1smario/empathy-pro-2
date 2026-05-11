import assert from "node:assert/strict";
import test from "node:test";
import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";
import type { AthleteTimeSeriesSampleRowV1 } from "@empathy/contracts";
import {
  buildBioenergeticWindowStreamChartRows,
  buildBioenergeticWindowStreamDailyRollups,
  computeBioenergeticWindowStreamStats,
  computeBioenergeticWindowStreamVariability,
  utcCalendarDateFromObservedAt,
} from "./window-stream-stats";

const base = (over: Partial<AthleteTimeSeriesSampleRowV1>): AthleteTimeSeriesSampleRowV1 => ({
  athlete_id: "a1",
  observed_at: "2026-05-01T10:00:00.000Z",
  channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L,
  value: 5,
  unit: "mmol/L",
  source: "test",
  ...over,
});

test("computeBioenergeticWindowStreamStats aggregates per channel", () => {
  const s = computeBioenergeticWindowStreamStats([
    base({ value: 5, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
    base({ value: 7, observed_at: "2026-05-01T11:00:00.000Z", channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
    base({ value: 1.2, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L }),
  ]);
  assert.equal(s.totalSamples, 3);
  assert.equal(s.glucose.count, 2);
  assert.equal(s.glucose.min, 5);
  assert.equal(s.glucose.max, 7);
  assert.equal(s.glucose.mean, 6);
  assert.equal(s.lactate.count, 1);
  assert.equal(s.lactate.min, 1.2);
  assert.equal(s.lactate.max, 1.2);
  assert.equal(s.lactate.mean, 1.2);
});

test("buildBioenergeticWindowStreamChartRows merges same observed_at", () => {
  const t = "2026-05-01T12:00:00.000Z";
  const rows = buildBioenergeticWindowStreamChartRows([
    base({ observed_at: t, value: 5.5, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
    base({ observed_at: t, value: 1.1, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L }),
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.glucoseMmolL, 5.5);
  assert.equal(rows[0]!.lactateMmolL, 1.1);
});

test("utcCalendarDateFromObservedAt extracts UTC day", () => {
  assert.equal(utcCalendarDateFromObservedAt("2026-05-02T23:59:59.999Z"), "2026-05-02");
  assert.equal(utcCalendarDateFromObservedAt("x"), null);
});

test("buildBioenergeticWindowStreamDailyRollups groups by UTC day", () => {
  const daily = buildBioenergeticWindowStreamDailyRollups([
    base({ observed_at: "2026-05-01T08:00:00.000Z", value: 5, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
    base({ observed_at: "2026-05-01T20:00:00.000Z", value: 7, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
    base({ observed_at: "2026-05-02T10:00:00.000Z", value: 1.0, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L }),
    base({ observed_at: "2026-05-02T11:00:00.000Z", value: 2.0, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L }),
  ]);
  assert.equal(daily.length, 2);
  assert.equal(daily[0]!.dateUtc, "2026-05-01");
  assert.equal(daily[0]!.glucose.count, 2);
  assert.equal(daily[0]!.glucose.min, 5);
  assert.equal(daily[0]!.glucose.max, 7);
  assert.equal(daily[1]!.dateUtc, "2026-05-02");
  assert.equal(daily[1]!.lactate.count, 2);
  assert.equal(daily[1]!.lactate.min, 1);
  assert.equal(daily[1]!.lactate.max, 2);
});

test("computeBioenergeticWindowStreamVariability averages daily ranges when >=2 samples", () => {
  const daily = buildBioenergeticWindowStreamDailyRollups([
    base({ observed_at: "2026-05-01T08:00:00.000Z", value: 4, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
    base({ observed_at: "2026-05-01T09:00:00.000Z", value: 8, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
    base({ observed_at: "2026-05-02T08:00:00.000Z", value: 5, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
    base({ observed_at: "2026-05-02T09:00:00.000Z", value: 9, channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L }),
  ]);
  const v = computeBioenergeticWindowStreamVariability(daily);
  assert.equal(v.daysWithGlucoseGte2, 2);
  assert.equal(v.glucoseMeanDailyRange, 4);
});
