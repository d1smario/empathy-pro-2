import { summarizeSignalPresence } from "@/lib/data-sufficiency/coverage";
import { parseGarminWellnessLogicalDay } from "@/lib/integrations/garmin-wellness-day-parse";

type SleepRecoverySignal = {
  sleepScore?: number | null;
  readinessScore?: number | null;
  recoveryScore?: number | null;
  hrvMs?: number | null;
  restingHrBpm?: number | null;
  sleepDurationHours?: number | null;
  /** Respiri/min (notte o media vendor) — ingest, non clone score vendor. */
  respiratoryRateRpm?: number | null;
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

/**
 * WHOOP v2 (e vendor simili) annidano metriche in `score` / `score.stage_summary`.
 * Espande ricorsivamente così `extractSleepRecoverySignal` legge le stesse chiavi del matrix docs.
 */
function flattenVendorMetricRecords(record: Record<string, unknown>): Record<string, unknown>[] {
  const list: Record<string, unknown>[] = [record];
  const score = asRecord(record.score);
  if (score) {
    list.push(score, { ...record, ...score });
    const stage = asRecord(score.stage_summary);
    if (stage) list.push(stage, { ...record, ...score, ...stage });
  }
  const stageTop = asRecord(record.stage_summary);
  if (stageTop) {
    list.push(stageTop, { ...record, ...stageTop });
  }
  /** Garmin Wellness: HRV summary blob */
  const hrvSummary = asRecord(record.hrvSummary);
  if (hrvSummary) {
    list.push(hrvSummary, { ...record, ...hrvSummary });
  }
  return list;
}

/** Espande payload device (incluso annidamento WHOOP `score` / `stage_summary`) per KPI wellness. */
export function expandDevicePayloadMetricRecords(payload: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!payload) return [];
  const bases = collectCandidateRecords(payload);
  const out: Record<string, unknown>[] = [];
  for (const b of bases) {
    out.push(...flattenVendorMetricRecords(b));
  }
  return out;
}

/**
 * Vero solo per record che provengono dallo stream **Garmin sleeps**:
 * presenti `overallSleepScore` o secondi per stadio (`deepSleepDurationInSeconds`, ecc.).
 * Esportato perché serve anche al pannello daily per evitare di leggere `durationInSeconds`
 * da `dailies` / `allDayRespiration` come "ore sonno".
 */
export function looksLikeGarminSleepRecord(record: Record<string, unknown> | null): boolean {
  if (!record) return false;
  if (record.overallSleepScore != null || record.OverallSleepScore != null) return true;
  return (
    pickNumber(record, ["deepSleepDurationInSeconds", "lightSleepDurationInSeconds", "remSleepInSeconds"]) != null
  );
}

/** Vero per payload che è realmente un sleep record (Garmin sleeps stream o WHOOP sleep / stage_summary). */
export function isSleepBearingDevicePayload(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  const stream = payload.garmin_wellness_stream;
  if (typeof stream === "string" && stream.toLowerCase() === "sleeps") return true;
  for (const rec of expandDevicePayloadMetricRecords(payload)) {
    if (looksLikeGarminSleepRecord(rec)) return true;
    if (rec.stage_summary != null) return true;
    if (rec.sleep_performance_percentage != null) return true;
    if (typeof rec.sleep_id === "string" || typeof rec.sleep_id === "number") return true;
  }
  return false;
}

/**
 * Durata sonno in ore · ordine **intenzionale**:
 *
 * WHOOP v2 mette tempi affidabili in `score.stage_summary` come `*_milli` (letto qui
 * **prima** dei secondi generici). Il campo `durationInSeconds` compare anche su
 * record non “notte intera” (o con semantica diversa): se lo leggiamo prima dei milli
 * vince un valore corto (~3 h) mentre le fasi sommano ~7 h — bug UI “ore sonno”.
 *
 * `durationInSeconds` / `DurationInSeconds` restano supportati per **Garmin sleeps**
 * (summary notturno) dove spesso non ci sono i milli WHOOP-like.
 */
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

  const milli = pickNumber(record, [
    /** Sonno effettivo (WHOOP) — preferito rispetto al solo “in bed”. */
    "total_sleep_time_milli",
    "total_in_bed_time_milli",
    "sleep_duration_milli",
    "in_bed_duration_milli",
  ]);
  if (milli != null && milli > 0) return Number((milli / 3_600_000).toFixed(2));

  const secondsGeneric = pickNumber(record, [
    "total_sleep_duration",
    "sleep_duration_seconds",
    "total_sleep_seconds",
    "sleepTimeInSeconds",
    "sleep_time_seconds",
  ]);
  if (secondsGeneric != null) return Number((secondsGeneric / 3600).toFixed(2));

  const garminSleepSeconds = pickNumber(record, ["durationInSeconds", "DurationInSeconds"]);
  if (garminSleepSeconds != null && record != null && looksLikeGarminSleepRecord(record)) {
    return Number((garminSleepSeconds / 3600).toFixed(2));
  }

  return null;
}

export function extractSleepRecoverySignal(payload: Record<string, unknown> | null): SleepRecoverySignal {
  const merged: SleepRecoverySignal = {};

  for (const record of expandDevicePayloadMetricRecords(payload)) {
    merged.sleepScore ??= pickNumber(record, [
      "sleep_performance_percentage",
      "sleep_score",
      "sleepScore",
      "sleep_quality_score",
      "sleepQualityScore",
    ]);
    merged.sleepScore ??= pickNumber(asRecord(record.overallSleepScore ?? record.OverallSleepScore), ["value", "Value"]);
    merged.readinessScore ??= pickNumber(record, [
      "readiness_score",
      "readinessScore",
      "readiness",
      "recovery_index",
    ]);
    merged.recoveryScore ??= pickNumber(record, [
      "recovery_score",
      "recoveryScore",
      "recovery",
      "recovery_index",
    ]);
    merged.hrvMs ??= pickNumber(record, [
      "hrv_rmssd_milli",
      "hrv_rmssd_ms",
      "hrv_ms",
      "hrv",
      "avg_hrv_ms",
      "average_hrv",
      "lastNightAvg",
      "last_night_avg",
      "rmssd",
      "rmssd_ms",
    ]);
    merged.restingHrBpm ??= pickNumber(record, [
      "resting_heart_rate",
      "resting_hr_bpm",
      "resting_hr",
      "restingHeartRateInBeatsPerMinute",
      "restingHeartRate",
      "rhr",
      "lowest_hr_bpm",
      "lowest_heart_rate",
    ]);
    merged.sleepDurationHours ??= normalizeSleepDurationHours(record);
    merged.respiratoryRateRpm ??= pickNumber(record, [
      "average_respiration_value",
      "averageRespirationValue",
      "avg_respiration_value",
      "avgRespirationValue",
      "resting_respiration_rate",
      "restingRespirationRate",
      "respiration_rate",
      "respirationRate",
      "breaths_per_minute",
      "breathsPerMinute",
      "breath_rate",
      "breathRate",
      "average_breath",
      "averageBreath",
      "waking_respiration_value",
      "wakingRespirationValue",
    ]);
    /**
     * Strain = carico giornaliero WHOOP-like (`day_strain`, `strain`, …).
     * **Non** mappare `averageStressLevel` / stress Garmin dailies qui: è stress 0–100,
     * non strain — altrimenti la UI mostra "Strain 22" mentre Recovery resta vuoto.
     */
    merged.strainScore ??= pickNumber(record, [
      "strain_score",
      "strainScore",
      "day_strain",
      "recovery_strain",
      "strain",
    ]);
    merged.sourceDate ??= pickString(record, [
      "calendarDate",
      "CalendarDate",
      "calendar_date",
      "date",
      "Date",
      "day",
      "summary_date",
      "sleep_date",
      "recovery_date",
      "timestamp",
      "source_date",
    ]);
    merged.sourceDate ??= parseGarminWellnessLogicalDay(record);
  }

  if (merged.readinessScore == null && merged.recoveryScore != null) {
    merged.readinessScore = merged.recoveryScore;
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
    respiratory_rate_rpm: signal.respiratoryRateRpm ?? null,
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
    { key: "respiratory_rate", present: signal.respiratoryRateRpm != null, recommendedInput: "respiration_rpm" },
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
      respiratory_rate: signal.respiratoryRateRpm != null ? 100 : 0,
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

  /**
   * Preview storici possono avere `sleep_duration_hours` scritto da `buildSleepRecoveryCanonicalPreview`
   * prima del fix decoder (dailies / respiration / stress → ore fasulle). La sorgente raw post-fix
   * non le ha più, ma il merge `source ?? preview` ripropone il garbage dal DB.
   * Accettiamo `sleepDurationHours` dal preview **solo** se il payload sorgente è realmente sleep-bearing.
   */
  const allowPreviewSleep =
    sourcePayload != null
      ? isSleepBearingDevicePayload(sourcePayload)
      : preview != null && isSleepBearingDevicePayload(preview);

  return {
    sleepScore: sourceSignal.sleepScore ?? previewSignal.sleepScore ?? null,
    readinessScore: sourceSignal.readinessScore ?? previewSignal.readinessScore ?? null,
    recoveryScore: sourceSignal.recoveryScore ?? previewSignal.recoveryScore ?? null,
    hrvMs: sourceSignal.hrvMs ?? previewSignal.hrvMs ?? null,
    restingHrBpm: sourceSignal.restingHrBpm ?? previewSignal.restingHrBpm ?? null,
    sleepDurationHours:
      sourceSignal.sleepDurationHours ?? (allowPreviewSleep ? previewSignal.sleepDurationHours : null) ?? null,
    respiratoryRateRpm: sourceSignal.respiratoryRateRpm ?? previewSignal.respiratoryRateRpm ?? null,
    strainScore: sourceSignal.strainScore ?? previewSignal.strainScore ?? null,
    sourceDate: sourceSignal.sourceDate ?? previewSignal.sourceDate ?? null,
  };
}
