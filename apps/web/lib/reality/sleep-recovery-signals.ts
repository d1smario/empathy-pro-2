import { summarizeSignalPresence } from "@/lib/data-sufficiency/coverage";

type SleepRecoverySignal = {
  sleepScore?: number | null;
  readinessScore?: number | null;
  recoveryScore?: number | null;
  hrvMs?: number | null;
  restingHrBpm?: number | null;
  sleepDurationHours?: number | null;
  strainScore?: number | null;
  sourceDate?: string | null;
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

function pickString(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function collectCandidateRecords(payload: Record<string, unknown> | null): Array<Record<string, unknown>> {
  if (!payload) return [];
  const directChildren = Object.values(payload)
    .map((value) => asRecord(value))
    .filter((value): value is Record<string, unknown> => value != null);
  return [payload, ...directChildren];
}

function normalizeSleepDurationHours(record: Record<string, unknown> | null): number | null {
  const hours = pickNumber(record, ["sleep_duration_hours", "sleepHours", "sleep_hours", "total_sleep_hours"]);
  if (hours != null) return hours;

  const minutes = pickNumber(record, [
    "sleep_duration_min",
    "sleep_duration_minutes",
    "total_sleep_minutes",
    "total_sleep_duration_min",
    "totalSleepMinutes",
  ]);
  if (minutes != null) return Number((minutes / 60).toFixed(2));

  const seconds = pickNumber(record, ["total_sleep_duration", "sleep_duration_seconds", "total_sleep_seconds"]);
  if (seconds != null) return Number((seconds / 3600).toFixed(2));

  return null;
}

export function extractSleepRecoverySignal(payload: Record<string, unknown> | null): SleepRecoverySignal {
  const records = collectCandidateRecords(payload);
  const merged: SleepRecoverySignal = {};

  for (const record of records) {
    merged.sleepScore ??=
      pickNumber(record, ["sleep_score", "sleepScore", "sleep_quality_score", "sleepQualityScore"]);
    merged.readinessScore ??=
      pickNumber(record, ["readiness_score", "readinessScore", "readiness", "recovery_index"]);
    merged.recoveryScore ??=
      pickNumber(record, ["recovery_score", "recoveryScore", "recovery", "recovery_index"]);
    merged.hrvMs ??=
      pickNumber(record, ["hrv_ms", "hrv", "avg_hrv_ms", "average_hrv", "rmssd", "rmssd_ms"]);
    merged.restingHrBpm ??=
      pickNumber(record, ["resting_hr_bpm", "resting_hr", "rhr", "lowest_hr_bpm", "lowest_heart_rate"]);
    merged.sleepDurationHours ??= normalizeSleepDurationHours(record);
    merged.strainScore ??=
      pickNumber(record, ["strain_score", "strainScore", "day_strain", "recovery_strain"]);
    merged.sourceDate ??=
      pickString(record, ["date", "day", "summary_date", "sleep_date", "recovery_date", "timestamp"]);
  }

  return merged;
}

export function buildSleepRecoveryCanonicalPreview(payload: Record<string, unknown>): Record<string, unknown> {
  const signal = extractSleepRecoverySignal(payload);
  return {
    payload_keys: Object.keys(payload),
    sleep_score: signal.sleepScore ?? null,
    readiness_score: signal.readinessScore ?? null,
    recovery_score: signal.recoveryScore ?? null,
    hrv_ms: signal.hrvMs ?? null,
    resting_hr_bpm: signal.restingHrBpm ?? null,
    sleep_duration_hours: signal.sleepDurationHours ?? null,
    strain_score: signal.strainScore ?? null,
    source_date: signal.sourceDate ?? null,
  };
}

export function buildSleepRecoveryCoverage(payload: Record<string, unknown>) {
  const signal = extractSleepRecoverySignal(payload);
  const summarized = summarizeSignalPresence([
    { key: "sleep_score", present: signal.sleepScore != null, recommendedInput: "sleep_score" },
    {
      key: "readiness_recovery_score",
      present: signal.readinessScore != null || signal.recoveryScore != null,
      recommendedInput: "readiness_or_recovery_score",
    },
    { key: "hrv", present: signal.hrvMs != null, recommendedInput: "night_hrv" },
    { key: "resting_hr", present: signal.restingHrBpm != null, recommendedInput: "resting_hr" },
    { key: "sleep_duration", present: signal.sleepDurationHours != null, recommendedInput: "sleep_duration" },
    { key: "strain", present: signal.strainScore != null, recommendedInput: "strain_score" },
  ]);

  return {
    signal,
    channelCoverage: {
      sleep_score: signal.sleepScore != null ? 100 : 0,
      readiness_recovery: signal.readinessScore != null || signal.recoveryScore != null ? 100 : 0,
      hrv: signal.hrvMs != null ? 100 : 0,
      resting_hr: signal.restingHrBpm != null ? 100 : 0,
      sleep_duration: signal.sleepDurationHours != null ? 100 : 0,
      strain: signal.strainScore != null ? 100 : 0,
    },
    missingChannels: summarized.missingSignals,
    recommendedInputs: summarized.recommendedInputs,
    coveragePct: summarized.coveragePct,
    inputUncertaintyPct: summarized.inputUncertaintyPct,
  };
}

export function extractSignalFromDeviceExportRow(row: Record<string, unknown>): SleepRecoverySignal {
  const payload = asRecord(row.payload);
  const sourcePayload = asRecord(payload?.sourcePayload);
  const previewPayload = asRecord(payload?.realityIngestion)?.canonicalPreview;
  const preview = asRecord(previewPayload);

  const sourceSignal = extractSleepRecoverySignal(sourcePayload);
  const previewSignal = extractSleepRecoverySignal(preview);

  return {
    sleepScore: sourceSignal.sleepScore ?? previewSignal.sleepScore ?? null,
    readinessScore: sourceSignal.readinessScore ?? previewSignal.readinessScore ?? null,
    recoveryScore: sourceSignal.recoveryScore ?? previewSignal.recoveryScore ?? null,
    hrvMs: sourceSignal.hrvMs ?? previewSignal.hrvMs ?? null,
    restingHrBpm: sourceSignal.restingHrBpm ?? previewSignal.restingHrBpm ?? null,
    sleepDurationHours: sourceSignal.sleepDurationHours ?? previewSignal.sleepDurationHours ?? null,
    strainScore: sourceSignal.strainScore ?? previewSignal.strainScore ?? null,
    sourceDate: sourceSignal.sourceDate ?? previewSignal.sourceDate ?? null,
  };
}
