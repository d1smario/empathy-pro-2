import assert from "node:assert/strict";
import test from "node:test";

import { extractSleepStagesFromDevicePayload } from "@/lib/physiology/sleep-stages-from-device-payload";

test("WHOOP v2 score.stage_summary usa chiavi total_*_time_milli", () => {
  const payload = {
    whoop_sleep: {
      score_state: "SCORED",
      score: {
        sleep_performance_percentage: 81,
        stage_summary: {
          total_in_bed_time_milli: 30272735,
          total_awake_time_milli: 1403507,
          total_light_sleep_time_milli: 14905851,
          total_slow_wave_sleep_time_milli: 6630370,
          total_rem_sleep_time_milli: 5879573,
        },
      },
    },
  };
  const s = extractSleepStagesFromDevicePayload(payload);
  assert.ok(s.deepHours != null && s.deepHours >= 1.83 && s.deepHours <= 1.85);
  assert.ok(s.lightHours != null && s.lightHours >= 4.13 && s.lightHours <= 4.15);
  assert.ok(s.remHours != null && s.remHours >= 1.63 && s.remHours <= 1.64);
  assert.ok(s.awakeHours != null && s.awakeHours >= 0.38 && s.awakeHours <= 0.40);
  assert.equal(s.summaryLabel, "81% sleep");
});

test("legacy WHOOP fixture senza prefisso total_ resta supportato", () => {
  const payload = {
    whoop_sleep: {
      score: {
        sleep_performance_percentage: 92,
        stage_summary: {
          slow_wave_sleep_time_milli: 7200 * 1000,
          light_sleep_time_milli: 1800 * 1000,
          rem_sleep_time_milli: 5400 * 1000,
          wake_duration_milli: 300 * 1000,
        },
      },
    },
  };
  const s = extractSleepStagesFromDevicePayload(payload);
  assert.equal(s.deepHours, 2);
  assert.equal(s.lightHours, 0.5);
  assert.equal(s.remHours, 1.5);
  assert.ok(s.awakeHours != null && s.awakeHours >= 0.08 && s.awakeHours <= 0.09);
});
