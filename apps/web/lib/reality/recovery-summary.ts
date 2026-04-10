import { createServerSupabaseClient } from "@/lib/supabase-server";
import { extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";

export type RecoveryStatus = "good" | "moderate" | "poor" | "unknown";

export type RecoverySummary = {
  status: RecoveryStatus;
  guidance: string;
  sleepScore: number | null;
  readinessScore: number | null;
  recoveryScore: number | null;
  hrvMs: number | null;
  restingHrBpm: number | null;
  sleepDurationHours: number | null;
  strainScore: number | null;
  sourceDate: string | null;
  provider: string | null;
  importedAt: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function weightedAverage(values: Array<number | null | undefined>, weights: number[]) {
  let weightedSum = 0;
  let totalWeight = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const weight = weights[index] ?? 0;
    if (value == null || !Number.isFinite(value) || weight <= 0) continue;
    weightedSum += value * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) return null;
  return weightedSum / totalWeight;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number) {
  const base = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return dateIso;
  base.setDate(base.getDate() + days);
  return toDateOnly(base);
}

function computeRecoveryStatus(input: {
  sleepScore: number | null;
  readinessScore: number | null;
  recoveryScore: number | null;
  sleepDurationHours: number | null;
  strainScore: number | null;
}): RecoveryStatus {
  const compositeBase =
    input.readinessScore ?? input.recoveryScore ?? input.sleepScore;
  const sleepAdj =
    input.sleepDurationHours != null ? clamp((input.sleepDurationHours - 7) * 4, -12, 8) : 0;
  const strainPenalty =
    input.strainScore != null ? clamp((input.strainScore - 12) * 1.4, 0, 18) : 0;

  if (compositeBase == null) return "unknown";
  const finalScore = clamp(compositeBase + sleepAdj - strainPenalty, 0, 100);
  if (finalScore >= 80) return "good";
  if (finalScore >= 60) return "moderate";
  return "poor";
}

function guidanceForStatus(status: RecoveryStatus) {
  if (status === "good") {
    return "Recovery favorevole: il sistema puo' sostenere la giornata prevista senza protezioni aggiuntive.";
  }
  if (status === "moderate") {
    return "Recovery intermedia: mantieni attenzione su carico interno, fueling e densita' della giornata.";
  }
  if (status === "poor") {
    return "Recovery bassa: attiva modalita' protettiva, riduci aggressivita' operativa e privilegia ripristino.";
  }
  return "Nessun segnale recovery recente disponibile dai device.";
}

export function buildRecoverySummaryFromRows(rows: Array<Record<string, unknown>>): RecoverySummary | null {
  if (!rows.length) return null;
  const recentRows = rows.slice(0, 3);
  const recentSignals = recentRows.map((row) => ({
    row,
    signal: extractSignalFromDeviceExportRow(row),
  }));
  const weights = [1, 0.7, 0.45];
  const primary = recentSignals[0];
  const sleepScore = weightedAverage(
    recentSignals.map(({ signal }) => signal.sleepScore ?? null),
    weights,
  );
  const readinessScore = weightedAverage(
    recentSignals.map(({ signal }) => signal.readinessScore ?? null),
    weights,
  );
  const recoveryScore = weightedAverage(
    recentSignals.map(({ signal }) => signal.recoveryScore ?? null),
    weights,
  );
  const hrvMs = weightedAverage(
    recentSignals.map(({ signal }) => signal.hrvMs ?? null),
    weights,
  );
  const restingHrBpm = weightedAverage(
    recentSignals.map(({ signal }) => signal.restingHrBpm ?? null),
    weights,
  );
  const sleepDurationHours = weightedAverage(
    recentSignals.map(({ signal }) => signal.sleepDurationHours ?? null),
    weights,
  );
  const strainScore = weightedAverage(
    recentSignals.map(({ signal }) => signal.strainScore ?? null),
    weights,
  );
  const status = computeRecoveryStatus({
    sleepScore,
    readinessScore,
    recoveryScore,
    sleepDurationHours,
    strainScore,
  });

  return {
    status,
    guidance: guidanceForStatus(status),
    sleepScore: sleepScore != null ? round(sleepScore) : null,
    readinessScore: readinessScore != null ? round(readinessScore) : null,
    recoveryScore: recoveryScore != null ? round(recoveryScore) : null,
    hrvMs: hrvMs != null ? round(hrvMs) : null,
    restingHrBpm: restingHrBpm != null ? round(restingHrBpm) : null,
    sleepDurationHours: sleepDurationHours != null ? round(sleepDurationHours, 2) : null,
    strainScore: strainScore != null ? round(strainScore) : null,
    sourceDate: primary?.signal.sourceDate ?? null,
    provider: typeof primary?.row.provider === "string" ? primary.row.provider : null,
    importedAt: typeof primary?.row.created_at === "string" ? primary.row.created_at : null,
  };
}

export async function resolveLatestRecoverySummary(athleteId: string, lookbackDays = 16): Promise<RecoverySummary | null> {
  const supabase = createServerSupabaseClient();
  const today = toDateOnly(new Date());
  const from = addDays(today, -Math.max(1, lookbackDays));
  const { data, error } = await supabase
    .from("device_sync_exports")
    .select("provider, payload, created_at")
    .eq("athlete_id", athleteId)
    .gte("created_at", `${from}T00:00:00.000Z`)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => {
    const signal = extractSignalFromDeviceExportRow(row);
    return (
      signal.sleepScore != null ||
      signal.readinessScore != null ||
      signal.recoveryScore != null ||
      signal.hrvMs != null ||
      signal.sleepDurationHours != null
    );
  });

  return buildRecoverySummaryFromRows(rows);
}
