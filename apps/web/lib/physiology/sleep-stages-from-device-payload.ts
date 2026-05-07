/**
 * Ore per stadio di sonno + ipnogramma da payload vendor (WHOOP v2 `score.stage_summary`, Garmin, ecc.).
 * Logica pura — importabile dai test senza `daily-wellness-panel` / Supabase.
 */
import { expandDevicePayloadMetricRecords } from "@/lib/reality/sleep-recovery-signals";

export type SleepStageHours = {
  deepHours: number | null;
  lightHours: number | null;
  remHours: number | null;
  awakeHours: number | null;
  summaryLabel: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(record: Record<string, unknown> | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function hoursFromSleepMilli(record: Record<string, unknown>, keys: string[]): number | null {
  const milli = pickNumber(record, keys);
  if (milli == null || milli <= 0) return null;
  return Number((milli / 3_600_000).toFixed(2));
}

function sleepStageFieldCount(s: SleepStageHours): number {
  return [s.deepHours, s.lightHours, s.remHours, s.awakeHours].filter((x) => x != null).length;
}

function mergeSleepStageCandidates(a: SleepStageHours, b: SleepStageHours): SleepStageHours {
  const ra = sleepStageFieldCount(a);
  const rb = sleepStageFieldCount(b);
  const primary = rb > ra ? b : a;
  const secondary = rb > ra ? a : b;
  return {
    deepHours: primary.deepHours ?? secondary.deepHours,
    lightHours: primary.lightHours ?? secondary.lightHours,
    remHours: primary.remHours ?? secondary.remHours,
    awakeHours: primary.awakeHours ?? secondary.awakeHours,
    summaryLabel: primary.summaryLabel ?? secondary.summaryLabel,
  };
}

/** WHOOP v2: https://developer.whoop.com/docs/developing/user-data/sleep — `stage_summary` usa prefissi `total_*`. */
export function extractSleepStagesFromDevicePayload(payload: Record<string, unknown> | null): SleepStageHours {
  const empty: SleepStageHours = {
    deepHours: null,
    lightHours: null,
    remHours: null,
    awakeHours: null,
    summaryLabel: null,
  };
  if (!payload) return empty;

  let acc = empty;

  for (const rec of expandDevicePayloadMetricRecords(payload)) {
    const deep =
      pickNumber(rec, ["deep_sleep_duration_hours", "deep_sleep_hours", "deep_sleep_duration"]) ??
      (() => {
        const min = pickNumber(rec, ["deep_sleep_duration_min", "deep_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })() ??
      hoursFromSleepMilli(rec, [
        "slow_wave_sleep_time_milli",
        "total_slow_wave_sleep_time_milli",
        "deep_sleep_duration_milli",
      ]);
    const light =
      pickNumber(rec, ["light_sleep_duration_hours", "light_sleep_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["light_sleep_duration_min", "light_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })() ??
      hoursFromSleepMilli(rec, ["light_sleep_time_milli", "total_light_sleep_time_milli"]);
    const rem =
      pickNumber(rec, ["rem_duration_hours", "rem_sleep_hours", "rem_sleep_duration_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["rem_duration_min", "rem_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })() ??
      hoursFromSleepMilli(rec, ["rem_sleep_time_milli", "total_rem_sleep_time_milli"]);
    const awake =
      pickNumber(rec, ["awake_duration_hours", "awake_time_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["awake_duration_min", "awake_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })() ??
      hoursFromSleepMilli(rec, ["wake_duration_milli", "awake_time_milli", "total_awake_time_milli"]);
    const perfPct = pickNumber(rec, ["sleep_performance_percentage"]);
    const labelStr = typeof rec.sleep_performance === "string" ? rec.sleep_performance.trim() : "";
    const summaryLabel = labelStr || (perfPct != null ? `${Math.round(perfPct)}% sleep` : null);

    const candidate: SleepStageHours = {
      deepHours: deep,
      lightHours: light,
      remHours: rem,
      awakeHours: awake,
      summaryLabel,
    };

    if (sleepStageFieldCount(candidate) > 0 || summaryLabel) {
      acc = mergeSleepStageCandidates(acc, candidate);
    }
  }

  return sleepStageFieldCount(acc) > 0 || acc.summaryLabel ? acc : empty;
}

export function tryBuildSleepHypnogramFromDevicePayload(
  payload: Record<string, unknown> | null,
): Array<{ t: number; stage: number }> {
  if (!payload) return [];
  const merged = expandDevicePayloadMetricRecords(payload);
  for (const rec of merged) {
    const phases = rec.sleep_phase_minutes ?? rec.phases_minutes ?? rec.sleep_phases;
    if (Array.isArray(phases) && phases.length > 0) {
      const series: Array<{ t: number; stage: number }> = [];
      let acc = 0;
      for (const chunk of phases) {
        const o = asRecord(chunk);
        if (!o) continue;
        const minutes = asNumber(o.minutes ?? o.duration_min ?? o.m) ?? 0;
        const stage = asNumber(o.stage ?? o.type ?? o.code) ?? 0;
        const start = acc / 60;
        acc += minutes;
        series.push({ t: start, stage });
      }
      if (series.length) return series;
    }
  }
  return [];
}
