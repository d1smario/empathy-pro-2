import assert from "node:assert/strict";
import test from "node:test";
import {
  wellnessFromTrace,
  wellnessSignalsByDateFromLoadRows,
} from "./wellness-signals-from-load-rows";

test("wellnessFromTrace picks HRV sleep RHR from device keys", () => {
  const w = wellnessFromTrace({
    hrv_rmssd_ms: 62,
    sleep_duration_hours: 7.5,
    resting_hr_bpm: 48,
  });
  assert.ok(w);
  assert.equal(w.hrvMs, 62);
  assert.equal(w.sleepHours, 7.5);
  assert.equal(w.restingHrBpm, 48);
});

test("wellnessSignalsByDateFromLoadRows merges multiple traces per day", () => {
  const map = wellnessSignalsByDateFromLoadRows([
    { date: "2026-05-10", trace_summary: { hrv_ms: 55 } },
    { date: "2026-05-10", trace_summary: { sleep_duration_hours: 8 } },
    { date: "2026-05-11", trace_summary: { resting_hr_bpm: 50 } },
  ]);
  assert.equal(map.get("2026-05-10")?.hrvMs, 55);
  assert.equal(map.get("2026-05-10")?.sleepHours, 8);
  assert.equal(map.get("2026-05-11")?.restingHrBpm, 50);
});
