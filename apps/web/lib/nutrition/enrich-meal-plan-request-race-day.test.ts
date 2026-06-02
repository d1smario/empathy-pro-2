import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichIntelligentMealPlanRequestWithRaceDay } from "./enrich-meal-plan-request-race-day";
import { detectRoutineRaceDay } from "./routine-race-day-context";
import type { IntelligentMealPlanRequest } from "./intelligent-meal-plan-types";

const baseRequest = (planDate: string): IntelligentMealPlanRequest => ({
  athleteId: "a1",
  planDate,
  dietType: "omnivore",
  contextLines: [],
  trainingDayLines: [],
  pathwayTimingLines: [],
  slots: [
    {
      slot: "breakfast",
      labelIt: "Colazione",
      scheduledTimeLocal: "08:00",
      targetKcal: 600,
      targetCarbsG: 80,
      targetProteinG: 25,
      targetFatG: 15,
      functionalTargets: [],
      functionalFoodGroups: [],
      foodCandidates: [],
    },
    {
      slot: "lunch",
      labelIt: "Pranzo",
      scheduledTimeLocal: "13:00",
      targetKcal: 900,
      targetCarbsG: 120,
      targetProteinG: 40,
      targetFatG: 25,
      functionalTargets: [],
      functionalFoodGroups: [],
      foodCandidates: [],
    },
    {
      slot: "dinner",
      labelIt: "Cena",
      scheduledTimeLocal: "20:00",
      targetKcal: 800,
      targetCarbsG: 90,
      targetProteinG: 45,
      targetFatG: 30,
      functionalTargets: [],
      functionalFoodGroups: [],
      foodCandidates: [],
    },
  ],
  mealPlanSolverMeta: { dailyMealsKcalTotal: 2300, integrationLeverLines: [] },
});

test("detectRoutineRaceDay — martedì gara Nicola-like", () => {
  const race = detectRoutineRaceDay({
    planDate: "2026-06-02",
    routineConfig: {
      week_plan: {
        Tue: { day_mode: "race", training1_start_time: "14:00", training1_duration_minutes: 150 },
      },
    },
  });
  assert.ok(race);
  assert.equal(race!.startTimeLocal, "14:00");
  assert.equal(race!.durationMinutes, 150);
});

test("enrich meal plan — pranzo pre-gara senza sedute in calendario", () => {
  const out = enrichIntelligentMealPlanRequestWithRaceDay({
    request: baseRequest("2026-06-02"),
    routineConfig: {
      week_plan: {
        Tue: { day_mode: "race", training1_start_time: "14:00", training1_duration_minutes: 150 },
      },
    },
    weightKg: 67,
    plannedSessions: [],
  });
  assert.ok(out.racePreLunch);
  assert.equal(out.racePreLunch!.lunchTimeLocal, "11:00");
  const lunch = out.slots.find((s) => s.slot === "lunch");
  assert.equal(lunch?.scheduledTimeLocal, "11:00");
  assert.match(out.contextLines.join(" "), /Protocollo pre-gara/);
});

test("enrich meal plan — recovery post-gara su cena con totale kcal invariato", () => {
  const req = baseRequest("2026-06-02");
  const totalBefore = req.slots.reduce((s, slot) => s + slot.targetKcal, 0);
  const out = enrichIntelligentMealPlanRequestWithRaceDay({
    request: req,
    routineConfig: {
      week_plan: {
        Tue: { day_mode: "race", training1_start_time: "14:00", training1_duration_minutes: 150 },
      },
    },
    weightKg: 67,
    plannedSessions: [],
  });
  assert.ok(out.racePostRecovery);
  assert.equal(out.racePostRecovery!.mealSlot, "dinner");
  const dinner = out.slots.find((s) => s.slot === "dinner");
  assert.equal(dinner?.targetKcal, out.racePostRecovery!.totalKcal);
  assert.equal(dinner?.targetCarbsG, out.racePostRecovery!.choG);
  const totalAfter = out.slots.reduce((s, slot) => s + slot.targetKcal, 0);
  assert.equal(totalAfter, totalBefore);
  assert.match(out.contextLines.join(" "), /Recovery post-gara/);
});
