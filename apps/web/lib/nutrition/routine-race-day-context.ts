/**
 * Giorno gara da `routine_config.week_plan` — seduta sintetica per fueling / race detection
 * quando il calendario non ha (ancora) una riga pianificata.
 */

import { profileWeekDayKeyFromIsoLocal } from "@/lib/nutrition/routine-week-plan-meal-times";
import type { PlannedSessionForRaceDetection } from "@/lib/nutrition/race-day-pre-race-lunch";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function numFromUnknown(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function nonEmptyTime(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export type RoutineRaceDayInfo = {
  label: string;
  startTimeLocal: string;
  durationMinutes: number;
};

export function detectRoutineRaceDay(input: {
  routineConfig: Record<string, unknown> | null | undefined;
  planDate: string;
}): RoutineRaceDayInfo | null {
  const rc = input.routineConfig;
  if (!rc) return null;
  const wd = profileWeekDayKeyFromIsoLocal(input.planDate);
  const day = asRecord(asRecord(rc.week_plan)[wd]);
  const dayMode = String(day.day_mode ?? "").toLowerCase();
  if (dayMode !== "race") return null;
  const startTimeLocal =
    nonEmptyTime(day.training1_start_time) ??
    nonEmptyTime(asRecord(rc.training_1).start_time) ??
    nonEmptyTime(rc.training1_start_time) ??
    null;
  if (!startTimeLocal) return null;
  const durationMinutes = Math.max(
    30,
    numFromUnknown(day.training1_duration_minutes, numFromUnknown(day.training2_duration_minutes, 120)),
  );
  return {
    label: "Gara (routine)",
    startTimeLocal,
    durationMinutes,
  };
}

export function buildRoutineSyntheticPlannedSessionsForRaceDetection(input: {
  routineConfig: Record<string, unknown> | null | undefined;
  planDate: string;
}): PlannedSessionForRaceDetection[] {
  const race = detectRoutineRaceDay(input);
  if (!race) return [];
  return [
    {
      duration_minutes: race.durationMinutes,
      type: "race",
      sessionName: race.label,
      adaptiveGoal: "race",
    },
  ];
}

/** Stima TSS per fueling quando esiste solo la routine gara (no builder in calendario). */
export function estimateRaceDayTssFromRoutine(durationMinutes: number): number {
  const hours = Math.max(0.5, durationMinutes / 60);
  return Math.round(hours * 88);
}

export type RoutineSyntheticFuelingSessionInput = {
  id: string;
  title: string;
  durationMinutesDb: number;
  tssTargetDb: number;
  kcalTargetDb: number | null;
  builderSession: null;
};

export function buildRoutineSyntheticFuelingSessionInput(input: {
  routineConfig: Record<string, unknown> | null | undefined;
  planDate: string;
}): RoutineSyntheticFuelingSessionInput | null {
  const race = detectRoutineRaceDay(input);
  if (!race) return null;
  const durationMinutesDb = race.durationMinutes;
  return {
    id: `routine-race-${input.planDate}`,
    title: race.label,
    durationMinutesDb,
    tssTargetDb: estimateRaceDayTssFromRoutine(durationMinutesDb),
    kcalTargetDb: null,
    builderSession: null,
  };
}
