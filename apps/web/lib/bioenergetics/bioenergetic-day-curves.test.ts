import assert from "node:assert/strict";
import test from "node:test";

import type { ExecutedWorkout, PlannedWorkout } from "@empathy/contracts";
import { averagePowerWattsFromKjAndDuration } from "@empathy/domain-bioenergetics";
import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { EMPTY_NUTRITION_PLAN_DAY } from "@/lib/bioenergetics/nutrition-plan-day-empty";
import { filterDeviceExportsForPanelDate } from "@/lib/bioenergetics/bioenergetic-device-exports-panel-date";
import {
  buildBioenergeticDaySeries,
  extractMeasuredGluLacFromSlice,
  timeWindowMsForExecutedSession,
} from "@/lib/bioenergetics/day-curves-assembler";

test("filterDeviceExportsForPanelDate include Garmin dailies per giorno logico non created_at", () => {
  const garminRow = {
    provider: "garmin",
    created_at: "2026-05-08T14:00:00.000Z",
    payload: {
      sourcePayload: {
        garmin_wellness_stream: "dailies",
        CalendarDate: "2026-05-07",
        steps: 5123,
      },
    },
  };
  const candidates = [garminRow as Record<string, unknown>];
  const out = filterDeviceExportsForPanelDate(candidates, "2026-05-07");
  assert.equal(out.length, 1);
  const noise = { provider: "garmin", created_at: "2026-05-09T10:00:00.000Z", payload: {} };
  const out2 = filterDeviceExportsForPanelDate([noise as Record<string, unknown>], "2026-05-07");
  assert.equal(out2.length, 0);
});

test("extractMeasuredGluLacFromSlice legge CGM e lab", () => {
  const slice: BioenergeticDayMemorySlice = {
    athleteId: "a1",
    date: "2026-05-01",
    planned: [],
    executed: [],
    diaryRows: [],
    biomarkerRows: [
      {
        id: "p1",
        sample_date: "2026-05-01",
        values: { glucose_mmol_l: 5.1 },
      } as Record<string, unknown>,
    ],
    deviceExportRows: [
      {
        id: "e1",
        provider: "cgm",
        created_at: "2026-05-01T10:00:00Z",
        payload: { glucose_mmol: 5.3 },
      } as Record<string, unknown>,
    ],
    nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
  };
  const { glucoseMeasured } = extractMeasuredGluLacFromSlice(slice);
  assert.ok(glucoseMeasured.length >= 2);
});

test("extractMeasuredGluLacFromSlice unisce athlete_time_series_samples e vince su stesso ts vs CGM export", () => {
  const sameTs = "2026-05-01T10:00:00.000Z";
  const slice: BioenergeticDayMemorySlice = {
    athleteId: "a1",
    date: "2026-05-01",
    planned: [],
    executed: [],
    diaryRows: [],
    biomarkerRows: [],
    deviceExportRows: [
      {
        id: "e1",
        provider: "cgm",
        created_at: sameTs,
        payload: { glucose_mmol: 5.9 },
      } as Record<string, unknown>,
    ],
    timeSeriesSamplesRows: [
      {
        channel: ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L,
        observed_at: sameTs,
        value: 5.2,
        source: "cgm_adapter",
      } as Record<string, unknown>,
    ],
    nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
  };
  const { glucoseMeasured } = extractMeasuredGluLacFromSlice(slice);
  assert.equal(glucoseMeasured.length, 1);
  assert.equal(glucoseMeasured[0].value, 5.2);
  assert.equal(glucoseMeasured[0].source, "cgm_adapter");
});

test("buildBioenergeticDaySeries produce canali glucosio e CHO cumulativo", () => {
  const slice: BioenergeticDayMemorySlice = {
    athleteId: "a1",
    date: "2026-05-01",
    planned: [],
    executed: [],
    diaryRows: [
      { id: "d1", entry_time: "08:00:00", carbs_g: 40 } as Record<string, unknown>,
      { id: "d2", entry_time: "13:00:00", carbs_g: 50 } as Record<string, unknown>,
    ],
    biomarkerRows: [],
    deviceExportRows: [],
    nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
  };
  const channels = {
    glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "k" }],
    lactate: [{ ts: "2026-05-01T12:00:00", value: 1.2, source: "k" }],
  };
  const series = buildBioenergeticDaySeries({
    slice,
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels,
  });
  assert.ok(series.some((s) => s.id === "glucose_mmol"));
  const meal = series.find((s) => s.id === "meal_carbs_g_cumulative");
  assert.ok(meal && meal.points.length === 2);
  assert.equal(meal.points[meal.points.length - 1].value, 90);
});

test("buildBioenergeticDaySeries include potenza da trace_summary seduta eseguita", () => {
  const slice: BioenergeticDayMemorySlice = {
    athleteId: "a1",
    date: "2026-04-20",
    planned: [],
    executed: [
      {
        id: "e1",
        athleteId: "a1",
        date: "2026-04-20",
        durationMinutes: 60,
        tss: 80,
        traceSummary: {
          power_series_w: [100, 200, 150, 180],
        },
      } as ExecutedWorkout,
    ],
    diaryRows: [],
    biomarkerRows: [],
    deviceExportRows: [],
    nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
  };
  const series = buildBioenergeticDaySeries({
    slice,
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: { glucose: null, lactate: null },
  });
  const power = series.find((s) => s.id === "power_w");
  assert.ok(power, "canale power_w");
  assert.equal(power!.points.length, 4);
  assert.equal(power!.points[0].source, "executed_trace");
});

test("timeWindowMsForExecutedSession usa started_at / ended_at se presenti", () => {
  const { startMs, spanMs } = timeWindowMsForExecutedSession(
    {
      date: "2026-04-20",
      durationMinutes: 60,
      startedAt: "2026-04-20T08:00:00.000Z",
      endedAt: "2026-04-20T09:00:00.000Z",
    },
    "2026-04-20",
    2,
    0,
  );
  assert.equal(spanMs, 3600000);
  assert.equal(new Date(startMs).toISOString(), "2026-04-20T08:00:00.000Z");
});

test("buildBioenergeticDaySeries include planned_power_w da kj_target piano", () => {
  const slice: BioenergeticDayMemorySlice = {
    athleteId: "a1",
    date: "2026-04-20",
    planned: [
      {
        id: "p1",
        athleteId: "a1",
        date: "2026-04-20",
        type: "endurance",
        durationMinutes: 60,
        tssTarget: 70,
        kjTarget: 1800,
      } as PlannedWorkout,
    ],
    executed: [],
    diaryRows: [],
    biomarkerRows: [],
    deviceExportRows: [],
    nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
  };
  const series = buildBioenergeticDaySeries({
    slice,
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: { glucose: null, lactate: null },
  });
  const planned = series.find((s) => s.id === "planned_power_w");
  assert.ok(planned);
  assert.equal(planned!.provenance, "planned");
  assert.ok(planned!.points.length >= 2);
  const w = averagePowerWattsFromKjAndDuration(1800, 60);
  assert.equal(planned!.points[0].value, w);
});
