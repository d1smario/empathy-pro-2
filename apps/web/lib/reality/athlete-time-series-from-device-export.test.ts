import assert from "node:assert/strict";
import test from "node:test";

import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";
import { buildAthleteTimeSeriesSampleRowsFromDeviceExport } from "@/lib/reality/athlete-time-series-from-device-export";

test("buildAthleteTimeSeriesSampleRowsFromDeviceExport: CGM payload con serie produce righe glucosio", () => {
  const rows = buildAthleteTimeSeriesSampleRowsFromDeviceExport({
    athleteId: "ath-1",
    deviceSyncExportId: "exp-1",
    provider: "cgm",
    payload: {
      samples: [
        { ts: "2026-06-01T08:00:00.000Z", glucose_mmol: 5.0 },
        { ts: "2026-06-01T08:05:00.000Z", glucose_mmol: 5.2 },
      ],
    },
    exportCreatedAt: "2026-06-01T07:00:00.000Z",
  });
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.channel === ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L));
  assert.ok(rows.every((r) => r.source === "device_sync_export"));
  assert.equal(rows[0].source_ref.device_sync_export_id, "exp-1");
});

test("buildAthleteTimeSeriesSampleRowsFromDeviceExport: provider non CGM non emette glucosio ma emette lattato se presente", () => {
  const rows = buildAthleteTimeSeriesSampleRowsFromDeviceExport({
    athleteId: "ath-1",
    deviceSyncExportId: "exp-2",
    provider: "garmin",
    payload: { lactate_mmoll: 1.8 },
    exportCreatedAt: "2026-06-01T10:00:00.000Z",
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].channel, ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L);
  assert.equal(rows[0].value, 1.8);
});
