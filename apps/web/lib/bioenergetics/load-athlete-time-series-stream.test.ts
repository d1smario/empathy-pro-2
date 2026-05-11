import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAthleteTimeSeriesSamplesForRange } from "./load-athlete-time-series-stream";

test("loadAthleteTimeSeriesSamplesForRange rejects invalid date range before DB", async () => {
  const stubDb = {} as SupabaseClient;
  const r = await loadAthleteTimeSeriesSamplesForRange(stubDb, {
    athleteId: "ath-1",
    fromDate: "not-a-date",
    toDate: "2026-01-01",
    channel: "all",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "invalid_date_range");
});

test("loadAthleteTimeSeriesSamplesForRange rejects span over window max", async () => {
  const stubDb = {} as SupabaseClient;
  const r = await loadAthleteTimeSeriesSamplesForRange(stubDb, {
    athleteId: "ath-1",
    fromDate: "2026-01-01",
    toDate: "2026-01-20",
    channel: "all",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "window_max_14_days");
});
