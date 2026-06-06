/**
 * Ricalcolo canonico pre-gara sul request meal plan (server o client) da routine DB + sedute.
 * Evita piani con verdure generiche quando `week_plan[day].day_mode === "race"`.
 */

import type { IntelligentMealPlanRequest, IntelligentMealPlanRequestSlot } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildRacePostRecoveryContext,
  buildRacePreLunchDayContext,
  computeRaceDaySuppressedSlots,
  mapPlannedSessionsForRaceDetection,
  racePostRecoveryContextLine,
  racePreLunchContextLine,
  rebalanceMealRowsForRacePostRecovery,
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

function notesForBuilderParse(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function plannedSessionsForRaceFromDbRows(
  rows: Array<{
    duration_minutes?: unknown;
    type?: unknown;
    notes?: unknown;
  }>,
): PlannedSessionForRaceDetection[] {
  const mapped = rows.map((row) => {
    const bs = parsePro2BuilderSessionFromNotes(notesForBuilderParse(row.notes));
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

  const activeSlots = input.request.slots.map((s) => s.slot);
  const racePreLunch = buildRacePreLunchDayContext({
    weightKg,
    planDate: input.request.planDate,
    routineConfig: routine,
    plannedSessions: planned,
    activeMealSlots: activeSlots,
  });
  if (!racePreLunch) {
    return input.request;
  }

  const contextLine = racePreLunchContextLine(racePreLunch);
  const contextLines = [
    ...input.request.contextLines.filter((l) => !l.includes("Protocollo pre-gara")),
    contextLine,
  ];

  let slots: IntelligentMealPlanRequestSlot[] = input.request.slots.map((slot) =>
    slot.slot === racePreLunch.mealSlot
      ? { ...slot, scheduledTimeLocal: racePreLunch.lunchTimeLocal }
      : slot,
  );

  const mealTimesBySlot = Object.fromEntries(
    slots.map((s) => [s.slot, s.scheduledTimeLocal] as const),
  ) as Partial<Record<MealSlotKey, string>>;
  const racePostRecovery = buildRacePostRecoveryContext({
    weightKg,
    planDate: input.request.planDate,
    routineConfig: routine,
    plannedSessions: planned,
    activeMealSlots: activeSlots,
    mealTimesBySlot,
  });
  if (racePostRecovery) {
    const rows = slots.map((s) => ({
      key: s.slot,
      label: s.labelIt,
      kcal: s.targetKcal,
      carbs: s.targetCarbsG,
      protein: s.targetProteinG,
      fat: s.targetFatG,
      timeLocal: s.scheduledTimeLocal,
    }));
    const rebalanced = rebalanceMealRowsForRacePostRecovery(rows, racePostRecovery);
    const byKey = new Map(rebalanced.map((r) => [r.key, r] as const));
    slots = slots.map((slot) => {
      const row = byKey.get(slot.slot);
      if (!row) return slot;
      return {
        ...slot,
        scheduledTimeLocal: row.timeLocal,
        targetKcal: Math.max(50, Math.round(row.kcal)),
        targetCarbsG: Math.max(0, Math.round(row.carbs)),
        targetProteinG: Math.max(0, Math.round(row.protein)),
        targetFatG: Math.max(0, Math.round(row.fat)),
      };
    });
  }

  const mealTimesFinal = Object.fromEntries(
    slots.map((s) => [s.slot, s.scheduledTimeLocal] as const),
  ) as Partial<Record<MealSlotKey, string>>;
  const raceSuppressed = computeRaceDaySuppressedSlots({
    ctx: racePreLunch,
    activeSlots,
    mealTimesBySlot: mealTimesFinal,
    postRecoveryMealSlot: racePostRecovery?.mealSlot ?? null,
  });
  const suppressedSlots = [...new Set([...(input.request.suppressedSlots ?? []), ...raceSuppressed])];

  const integrationLeverLines = [
    ...(input.request.mealPlanSolverMeta?.integrationLeverLines ?? []),
    `Protocollo pre-gara attivo (${racePreLunch.mealSlot} ${racePreLunch.lunchTimeLocal} · routine race).`,
    ...(racePostRecovery
      ? [
          `Recovery post-gara (${racePostRecovery.mealSlot} ~${racePostRecovery.recoveryTimeLocal} · CHO ${racePostRecovery.choPerKgG} g/kg).`,
        ]
      : []),
  ].slice(0, 16);

  return {
    ...input.request,
    slots,
    postWorkoutMealBySlot: racePostRecovery
      ? { [racePostRecovery.mealSlot]: true }
      : input.request.postWorkoutMealBySlot,
    contextLines: [
      ...contextLines,
      ...(racePostRecovery ? [racePostRecoveryContextLine(racePostRecovery)] : []),
    ],
    racePreLunch,
    racePostRecovery: racePostRecovery ?? undefined,
    suppressedSlots: suppressedSlots.length ? suppressedSlots : undefined,
    mealPlanSolverMeta: {
      ...input.request.mealPlanSolverMeta,
      integrationLeverLines,
    },
  };
}
