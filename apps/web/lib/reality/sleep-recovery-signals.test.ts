import assert from "node:assert/strict";
import test from "node:test";

import {
  extractSleepRecoverySignal,
  extractSignalFromDeviceExportRow,
  isSleepBearingDevicePayload,
  looksLikeGarminSleepRecord,
} from "@/lib/reality/sleep-recovery-signals";

test("Garmin / generic payload: respiratory rate rpm", () => {
  const payload = {
    garmin_sleep: {
      averageRespirationValue: 14.2,
      hrv_rmssd_ms: 42,
      resting_heart_rate: 52,
    },
  };
  const s = extractSleepRecoverySignal(payload);
  assert.equal(s.respiratoryRateRpm, 14.2);
});

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

/** WHOOP può avere `durationInSeconds` corto su root insieme a `*_milli` nello stage_summary: i milli devono vincere. */
test("WHOOP sleep: total_sleep_time_milli vince su durationInSeconds corto", () => {
  const payload = {
    whoop_sleep: {
      start: "2026-05-06T23:00:00Z",
      end: "2026-05-07T07:00:00Z",
      durationInSeconds: 11_052,
      score: {
        sleep_performance_percentage: 88,
        stage_summary: {
          total_sleep_time_milli: 7 * 3_600_000 + 15 * 60_000,
          slow_wave_sleep_time_milli: 3600_000,
          rem_sleep_time_milli: 5400_000,
          wake_duration_milli: 600_000,
        },
      },
    },
  };
  const s = extractSleepRecoverySignal(payload);
  assert.ok(s.sleepDurationHours != null && s.sleepDurationHours >= 7.2 && s.sleepDurationHours <= 7.35);
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

/** Preview DB può contenere sleep_duration_hours fasullo (persist pre-fix); la riga non è sleep-bearing → ignorare preview. */
test("device_export Garmin dailies: preview.sleep_duration_hours sporco non contamina signal", () => {
  const row = {
    payload: {
      sourcePayload: {
        summaryId: "x",
        calendarDate: "2026-05-10",
        durationInSeconds: 43_920,
        steps: 12_000,
        garmin_wellness_stream: "dailies",
      },
      realityIngestion: {
        canonicalPreview: {
          source_date: "2026-05-10",
          sleep_duration_hours: 12.2,
        },
      },
    },
  };
  const s = extractSignalFromDeviceExportRow(row as Record<string, unknown>);
  assert.equal(s.sleepDurationHours, null);
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

test("Garmin dailies: averageStressLevel NON è strain WHOOP (stress 0–100 separato)", () => {
  const dailies = {
    calendarDate: "2026-05-10",
    averageStressLevel: 22,
    garmin_wellness_stream: "dailies",
  };
  const s = extractSleepRecoverySignal(dailies);
  assert.equal(s.strainScore, null);
});

/**
 * Bug live osservato: Garmin pusha `dailies` e `allDayRespiration` con `durationInSeconds`
 * (durata della finestra giorno / respirazione, NON del sonno). Il decoder vecchio scriveva
 * `sleep_duration_hours` da quel valore corrompendo il KPI. Guardia: solo se Garmin sleep.
 */
test("Garmin dailies durationInSeconds NON è ore sonno", () => {
  const dailies = {
    summaryId: "x",
    calendarDate: "2026-05-10",
    durationInSeconds: 43920,
    steps: 12000,
    activeKilocalories: 850,
    bmrKilocalories: 1700,
    garmin_wellness_stream: "dailies",
  };
  const s = extractSleepRecoverySignal(dailies);
  assert.equal(s.sleepDurationHours, null, "dailies non deve produrre ore sonno");
  assert.equal(looksLikeGarminSleepRecord(dailies), false);
  assert.equal(isSleepBearingDevicePayload(dailies), false);
});

test("Garmin allDayRespiration durationInSeconds NON è ore sonno", () => {
  const respiration = {
    summaryId: "x",
    durationInSeconds: 900,
    timeOffsetEpochToBreaths: {},
    garmin_wellness_stream: "allDayRespiration",
  };
  const s = extractSleepRecoverySignal(respiration);
  assert.equal(s.sleepDurationHours, null);
  assert.equal(isSleepBearingDevicePayload(respiration), false);
});

test("Garmin sleeps stream: durationInSeconds → ore sonno + isSleepBearing", () => {
  const sleeps = {
    summaryId: "x",
    calendarDate: "2026-05-10",
    startTimeInSeconds: 1778357801,
    durationInSeconds: 26100,
    deepSleepDurationInSeconds: 2520,
    lightSleepDurationInSeconds: 19980,
    remSleepInSeconds: 3600,
    awakeDurationInSeconds: 2400,
    overallSleepScore: { value: 71, qualifierKey: "FAIR" },
    garmin_wellness_stream: "sleeps",
  };
  const s = extractSleepRecoverySignal(sleeps);
  assert.equal(s.sleepDurationHours, 7.25);
  assert.equal(looksLikeGarminSleepRecord(sleeps), true);
  assert.equal(isSleepBearingDevicePayload(sleeps), true);
});
