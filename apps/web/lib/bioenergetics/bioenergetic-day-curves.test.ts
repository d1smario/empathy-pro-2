import assert from "node:assert/strict";
import test from "node:test";

import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { filterDeviceExportsForPanelDate } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { buildBioenergeticDaySeries, extractMeasuredGluLacFromSlice } from "@/lib/bioenergetics/day-curves-assembler";

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
  };
  const { glucoseMeasured } = extractMeasuredGluLacFromSlice(slice);
  assert.ok(glucoseMeasured.length >= 2);
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
