import assert from "node:assert/strict";
import test from "node:test";

import { wellnessDayKeyFromDeviceExportRow } from "@/lib/physiology/wellness-day-key-from-device-export";

test("WHOOP sleep: giorno logico = risveglio (end) così recovery HRV combacia sulla stessa data", () => {
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
  assert.equal(wellnessDayKeyFromDeviceExportRow(row as Record<string, unknown>), "2026-05-07");
});
