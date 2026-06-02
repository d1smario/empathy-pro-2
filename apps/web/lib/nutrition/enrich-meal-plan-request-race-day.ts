/**
 * Ricalcolo canonico pre-gara sul request meal plan (server o client) da routine DB + sedute.
 * Evita piani con verdure generiche quando `week_plan[day].day_mode === "race"`.
 */

import type { IntelligentMealPlanRequest, IntelligentMealPlanRequestSlot } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildRacePreLunchDayContext,
  mapPlannedSessionsForRaceDetection,
  racePreLunchContextLine,
  type PlannedSessionForRaceDetection,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import { buildRoutineSyntheticPlannedSessionsForRaceDetection } from "@/lib/nutrition/routine-race-day-context";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";

function coerceDbNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function plannedSessionsForRaceFromDbRows(
  rows: Array<{
    duration_minutes?: unknown;
    type?: unknown;
    notes?: unknown;
  }>,
): PlannedSessionForRaceDetection[] {
  const mapped = rows.map((row) => {
    const bs = parsePro2BuilderSessionFromNotes(row.notes ?? null);
    return {
      duration_minutes: row.duration_minutes,
      type: row.type,
      notes: row.notes,
      sessionName: bs?.sessionName ?? null,
      adaptiveGoal: bs?.adaptationTarget ?? null,
    };
  });
  return mapPlannedSessionsForRaceDetection(mapped);
}

export function enrichIntelligentMealPlanRequestWithRaceDay(input: {
  request: IntelligentMealPlanRequest;
  routineConfig: Record<string, unknown> | null | undefined;
  weightKg: unknown;
  plannedSessions: PlannedSessionForRaceDetection[];
}): IntelligentMealPlanRequest {
  const routine = asRecord(input.routineConfig);
  const weightKg = coerceDbNumeric(input.weightKg);
  const planned =
    input.plannedSessions.length > 0
      ? input.plannedSessions
      : buildRoutineSyntheticPlannedSessionsForRaceDetection({
          routineConfig: routine,
          planDate: input.request.planDate,
        });

  const racePreLunch = buildRacePreLunchDayContext({
    weightKg,
    planDate: input.request.planDate,
    routineConfig: routine,
    plannedSessions: planned,
  });
  if (!racePreLunch) {
    return input.request;
  }

  const contextLine = racePreLunchContextLine(racePreLunch);
  const contextLines = [
    ...input.request.contextLines.filter((l) => !l.includes("Protocollo pre-gara")),
    contextLine,
  ];

  const slots: IntelligentMealPlanRequestSlot[] = input.request.slots.map((slot) =>
    slot.slot === "lunch" ? { ...slot, scheduledTimeLocal: racePreLunch.lunchTimeLocal } : slot,
  );

  return {
    ...input.request,
    slots,
    contextLines,
    racePreLunch,
    mealPlanSolverMeta: {
      ...input.request.mealPlanSolverMeta,
      integrationLeverLines: [
        ...(input.request.mealPlanSolverMeta?.integrationLeverLines ?? []),
        "Protocollo pre-gara attivo (routine · day_mode=race).",
      ].slice(0, 16),
    },
  };
}
