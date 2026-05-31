import "server-only";

/**
 * EPI resolver — assembles deterministic engine inputs from the canonical athlete-memory spine
 * (twin + physiology + diary), internal-load channels, training compliance, and the daily
 * subjective check-in. Calls the pure `computeEpi` engine. No parallel state: this is the single
 * EPI assembler (empathy_pro2_no_parallel_lines.mdc).
 */

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { resolveInternalLoadState } from "@/lib/internal-load/internal-load-resolver";
import { extractDiaryAdaptiveSignals } from "@/lib/nutrition/diary-adaptive-signals";
import { computeEpi } from "@/lib/epi/epi-engine";
import type { DailyCheckin, EpiInputs, EpiResult } from "@/lib/empathy/schemas";

function utcTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysUtcIso(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function scale(value: unknown): number | null {
  const n = num(value);
  if (n == null) return null;
  return n >= 1 && n <= 5 ? Math.round(n) : null;
}

/** Map a raw athlete_daily_checkins row to the contract type. */
export function dailyCheckinFromRow(athleteId: string, row: Record<string, unknown> | null): DailyCheckin | null {
  if (!row) return null;
  const flags = Array.isArray(row.illness_flags)
    ? (row.illness_flags as unknown[]).filter((f): f is string => typeof f === "string" && f.trim() !== "")
    : [];
  return {
    athleteId,
    checkinDate: typeof row.checkin_date === "string" ? row.checkin_date.slice(0, 10) : utcTodayIso(),
    energy: scale(row.energy) as DailyCheckin["energy"],
    mood: scale(row.mood) as DailyCheckin["mood"],
    sleepQuality: scale(row.sleep_quality) as DailyCheckin["sleepQuality"],
    soreness: scale(row.soreness) as DailyCheckin["soreness"],
    stress: scale(row.stress) as DailyCheckin["stress"],
    motivation: scale(row.motivation) as DailyCheckin["motivation"],
    illnessFlags: flags as DailyCheckin["illnessFlags"],
    note: typeof row.note === "string" ? row.note : null,
    source: typeof row.source === "string" ? row.source : "self_report",
    createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function channelScore(
  channels: Array<{ channel: string; score: number }> | undefined,
  id: string,
): number | null {
  const ch = (channels ?? []).find((c) => c.channel === id);
  return ch ? channelTo100(ch.score) : null;
}

/** Internal-load channel scores are already 0–100 in resolveInternalLoadState. */
function channelTo100(score: number): number {
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

async function complianceAndStreak(
  athleteId: string,
  endDateIso: string,
): Promise<{ compliancePct: number | null; plannedCount: number; streakDays: number }> {
  const supabase = createServerSupabaseClient();
  const from14 = addDaysUtcIso(endDateIso, -13);
  const from30 = addDaysUtcIso(endDateIso, -29);
  const [plannedRes, executedRes, streakRes] = await Promise.all([
    supabase
      .from("planned_workouts")
      .select("date, tss_target")
      .eq("athlete_id", athleteId)
      .gte("date", from14)
      .lte("date", endDateIso),
    supabase
      .from("executed_workouts")
      .select("date, tss")
      .eq("athlete_id", athleteId)
      .gte("date", from14)
      .lte("date", endDateIso),
    supabase
      .from("executed_workouts")
      .select("date")
      .eq("athlete_id", athleteId)
      .gte("date", from30)
      .lte("date", endDateIso)
      .order("date", { ascending: false }),
  ]);

  const plannedRows = (plannedRes.data ?? []) as Array<Record<string, unknown>>;
  const executedRows = (executedRes.data ?? []) as Array<Record<string, unknown>>;
  const plannedTss = plannedRows.reduce((s, r) => s + Math.max(0, num(r.tss_target) ?? 0), 0);
  const executedTss = executedRows.reduce((s, r) => s + Math.max(0, num(r.tss) ?? 0), 0);
  const compliancePct = plannedTss > 0 ? Math.round((executedTss / plannedTss) * 1000) / 10 : null;

  const dates = new Set<string>();
  for (const r of (streakRes.data ?? []) as Array<Record<string, unknown>>) {
    if (typeof r.date === "string") dates.add(r.date.slice(0, 10));
  }
  let streakDays = 0;
  // Streak may end today or yesterday (rest-day tolerance of 0 — consecutive trained days).
  let cursor = dates.has(endDateIso) ? endDateIso : addDaysUtcIso(endDateIso, -1);
  while (dates.has(cursor)) {
    streakDays += 1;
    cursor = addDaysUtcIso(cursor, -1);
  }

  return { compliancePct, plannedCount: plannedRows.length, streakDays };
}

export type ResolvedEpi = {
  epi: EpiResult;
  checkin: DailyCheckin | null;
  snapshotDate: string;
};

/**
 * Resolve the EPI for an athlete on a given date (default today, UTC). Authorization must already
 * have happened in the caller (route context); reads use the canonical resolvers.
 */
export async function resolveEpiForDate(athleteId: string, dateIso?: string): Promise<ResolvedEpi> {
  const snapshotDate = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : utcTodayIso();
  const supabase = createServerSupabaseClient();

  const [memory, checkinRes, compliance] = await Promise.all([
    resolveAthleteMemorySlice(athleteId, { slice: "bioenergetics" }),
    supabase
      .from("athlete_daily_checkins")
      .select("*")
      .eq("athlete_id", athleteId)
      .eq("checkin_date", snapshotDate)
      .maybeSingle(),
    complianceAndStreak(athleteId, snapshotDate),
  ]);

  const internalLoad = await resolveInternalLoadState({
    athleteId,
    physiologyState: memory.physiology ?? undefined,
  });

  const checkin = dailyCheckinFromRow(athleteId, (checkinRes.data ?? null) as Record<string, unknown> | null);
  const twin = memory.twin;
  const profile = memory.profile ?? null;

  const diarySignals = extractDiaryAdaptiveSignals({
    profile,
    diaryEntries: (memory.nutrition?.diary ?? []) as Array<Record<string, unknown>>,
  });

  const sex = profile?.sex === "male" || profile?.sex === "female" ? profile.sex : null;

  const inputs: EpiInputs = {
    athleteId,
    asOf: new Date().toISOString(),
    executionCompliancePct: compliance.compliancePct,
    fitnessChronic: num(twin?.fitnessChronic),
    activityStreakDays: compliance.streakDays,
    readiness: num(twin?.readiness),
    recoveryCapacity: num(internalLoad.recoveryCapacity) ?? num(twin?.recoveryCapacity),
    autonomicScore: channelScore(internalLoad.channels, "autonomic"),
    hrvMs: null,
    hrvBaselineMs: null,
    sleepCircadianScore: channelScore(internalLoad.channels, "sleep_circadian"),
    sleepRecovery: num(twin?.sleepRecovery),
    energyAdequacyRatio: diarySignals?.energyAdequacyRatio ?? null,
    proteinGPerKg: diarySignals?.proteinGPerKg ?? null,
    bodyFatPct: num(profile?.bodyFatPct),
    phaseAngleScore: null,
    sex,
    adherencePct: compliance.compliancePct,
    hasActivePlan: compliance.plannedCount > 0,
    subjEnergy: checkin?.energy ?? null,
    subjMood: checkin?.mood ?? null,
    subjSleepQuality: checkin?.sleepQuality ?? null,
    subjSoreness: checkin?.soreness ?? null,
    subjStress: checkin?.stress ?? null,
    illnessFlags: checkin?.illnessFlags ?? [],
  };

  const epi = computeEpi(inputs);
  return { epi, checkin, snapshotDate };
}
