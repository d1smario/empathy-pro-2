import assert from "node:assert/strict";
import test from "node:test";

import {
  wellnessDayKeyFromDeviceExportRow,
  wellnessExportMatchesPanelDate,
} from "@/lib/physiology/wellness-day-key-from-device-export";

test("WHOOP sleep: giorno chiave = inizio notte (start); recovery mattutino si associa al giorno dopo via panel matcher", () => {
  const row = {
    provider: "whoop",
    created_at: "2026-05-07T08:00:00.000Z",
    payload: {
      sourcePayload: {
        whoop_sleep: {
          start: "2026-05-06T23:00:00.000Z",
          end: "2026-05-07T06:30:00.000Z",
          score: { sleep_performance_percentage: 81 },
        },
      },
    },
  };
  assert.equal(wellnessDayKeyFromDeviceExportRow(row as Record<string, unknown>), "2026-05-06");
  assert.equal(wellnessExportMatchesPanelDate(row as Record<string, unknown>, "2026-05-06"), true);
  assert.equal(wellnessExportMatchesPanelDate(row as Record<string, unknown>, "2026-05-07"), true);
});

test("WHOOP recovery: giorno chiave = created_at; il giorno prima del rilevamento include la riga per il pannello", () => {
  const row = {
    provider: "whoop",
    payload: {
      sourcePayload: {
        whoop_recovery: {
          created_at: "2026-05-07T08:15:00.000Z",
          score: { recovery_score: 70, hrv_rmssd_milli: 45 },
        },
      },
    },
  };
  assert.equal(wellnessDayKeyFromDeviceExportRow(row as Record<string, unknown>), "2026-05-07");
  assert.equal(wellnessExportMatchesPanelDate(row as Record<string, unknown>, "2026-05-06"), true);
  assert.equal(wellnessExportMatchesPanelDate(row as Record<string, unknown>, "2026-05-07"), true);
});

test("Garmin dailies: CalendarDate PascalCase → giorno wellness (non si usa solo created_at della sync)", () => {
  const row = {
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
  assert.equal(wellnessDayKeyFromDeviceExportRow(row as Record<string, unknown>), "2026-05-07");
  assert.equal(wellnessExportMatchesPanelDate(row as Record<string, unknown>, "2026-05-07"), true);
  assert.equal(wellnessExportMatchesPanelDate(row as Record<string, unknown>, "2026-05-08"), false);
});

test("Garmin dailies: calendarDate numerico YYYYMMDD", () => {
  const row = {
    provider: "garmin",
    payload: {
      sourcePayload: {
        garmin_wellness_stream: "dailies",
        calendarDate: 20260507,
      },
    },
  };
  assert.equal(wellnessDayKeyFromDeviceExportRow(row as Record<string, unknown>), "2026-05-07");
});

test("Garmin bodyComps: measurementTimeInSeconds → giorno UTC ISO", () => {
  const row = {
    provider: "garmin",
    payload: {
      sourcePayload: {
        garmin_wellness_stream: "bodyComps",
        measurementTimeInSeconds: 1_457_702_400,
      },
    },
  };
  assert.equal(wellnessDayKeyFromDeviceExportRow(row as Record<string, unknown>), "2016-03-11");
});
