import type { EmpathyLoadWellnessInput } from "@empathy/domain-training";

type RowWithTrace = {
  date: string | null;
  duration_minutes?: number | null;
  trace_summary: Record<string, unknown> | null;
};

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pick(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const v = asNum(trace[key]);
    if (v != null) return v;
  }
  return null;
}

function mergeWellness(
  prev: EmpathyLoadWellnessInput | undefined,
  next: EmpathyLoadWellnessInput,
): EmpathyLoadWellnessInput {
  return {
    hrvMs: next.hrvMs ?? prev?.hrvMs ?? null,
    sleepHours: next.sleepHours ?? prev?.sleepHours ?? null,
    restingHrBpm: next.restingHrBpm ?? prev?.restingHrBpm ?? null,
    skinTempC: next.skinTempC ?? prev?.skinTempC ?? null,
  };
}

export function wellnessFromTrace(trace: Record<string, unknown> | null): EmpathyLoadWellnessInput | null {
  if (!trace) return null;
  const sleepHours =
    pick(trace, ["sleep_duration_hours", "sleep_hours", "total_sleep_hours"]) ??
    (() => {
      const sec = pick(trace, ["sleep_duration_sec", "sleep_seconds", "total_sleep_duration"]);
      return sec != null ? sec / 3600 : null;
    })();
  const hrvMs = pick(trace, ["hrv_ms", "hrv_rmssd_ms", "avg_hrv_ms", "rmssd_ms"]);
  const restingHrBpm = pick(trace, ["resting_hr_bpm", "resting_heart_rate", "rest_hr_bpm", "restingHeartRate"]);
  const skinTempC = pick(trace, ["skin_temp_c", "core_temp_c", "skin_temperature_c", "body_temperature_c"]);
  if (hrvMs == null && sleepHours == null && restingHrBpm == null && skinTempC == null) {
    return null;
  }
  return { hrvMs, sleepHours, restingHrBpm, skinTempC };
}

/** Best-effort wellness per giorno da trace merge (device export in analytics). */
export function wellnessSignalsByDateFromLoadRows(
  rows: RowWithTrace[],
): Map<string, EmpathyLoadWellnessInput> {
  const out = new Map<string, EmpathyLoadWellnessInput>();
  for (const row of rows) {
    if (typeof row.date !== "string" || row.date.length < 10) continue;
    const w = wellnessFromTrace(row.trace_summary);
    if (!w) continue;
    out.set(row.date, mergeWellness(out.get(row.date), w));
  }
  return out;
}
