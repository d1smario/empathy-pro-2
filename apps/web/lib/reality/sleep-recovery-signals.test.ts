import assert from "node:assert/strict";
import test from "node:test";

import { extractSleepRecoverySignal, extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";

test("WHOOP recovery annidato in score → HRV, RHR, recovery %", () => {
  const payload = {
    whoop_recovery: {
      cycle_id: 1,
      score: {
        recovery_score: 67,
        resting_heart_rate: 54,
        hrv_rmssd_milli: 48,
        spo2_percentage: 97,
      },
    },
  };
  const s = extractSleepRecoverySignal(payload);
  assert.equal(s.recoveryScore, 67);
  assert.equal(s.readinessScore, 67);
  assert.equal(s.restingHrBpm, 54);
  assert.equal(s.hrvMs, 48);
});

test("WHOOP sleep: score.stage_summary + sleep_performance_percentage", () => {
  const payload = {
    whoop_sleep: {
      start: "2026-05-06T23:00:00Z",
      end: "2026-05-07T06:30:00Z",
      score: {
        sleep_performance_percentage: 92,
        stage_summary: {
          total_in_bed_time_milli: 7 * 3600 * 1000 + 30 * 60 * 1000,
          slow_wave_sleep_time_milli: 7200 * 1000,
          rem_sleep_time_milli: 5400 * 1000,
          wake_duration_milli: 300 * 1000,
        },
      },
    },
  };
  const s = extractSleepRecoverySignal(payload);
  assert.equal(s.sleepScore, 92);
  assert.ok(s.sleepDurationHours != null && s.sleepDurationHours >= 7.4 && s.sleepDurationHours <= 7.6);
});

test("device_sync_exports row: metriche da sourcePayload whoop_*", () => {
  const row = {
    payload: {
      sourcePayload: {
        whoop_recovery: {
          score: { recovery_score: 71, hrv_rmssd_milli: 55 },
        },
      },
      realityIngestion: { canonicalPreview: { whoop_id: "x" } },
    },
  };
  const s = extractSignalFromDeviceExportRow(row as Record<string, unknown>);
  assert.equal(s.recoveryScore, 71);
  assert.equal(s.hrvMs, 55);
});

test("Garmin sleeps: overallSleepScore.value → sleepScore; durationInSeconds → ore", () => {
  const payload = {
    summaryId: "x",
    calendarDate: "2016-01-10",
    durationInSeconds: 3600 * 7 + 1800,
    overallSleepScore: { value: 87, qualifierKey: "GOOD" },
    restingHeartRateInBeatsPerMinute: 58,
  };
  const s = extractSleepRecoverySignal(payload);
  assert.equal(s.sleepScore, 87);
  assert.ok(s.sleepDurationHours != null && Math.abs(s.sleepDurationHours - 7.5) < 0.01);
  assert.equal(s.restingHrBpm, 58);
});

test("Garmin HRV summary: lastNightAvg", () => {
  const payload = {
    calendarDate: "2022-05-31",
    lastNightAvg: 44,
    lastNight5MinHigh: 72,
  };
  const s = extractSleepRecoverySignal(payload);
  assert.equal(s.hrvMs, 44);
});
