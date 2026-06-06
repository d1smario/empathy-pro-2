import assert from "node:assert/strict";
import test from "node:test";
import type { MealPlanV2DietSlotBudget } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { buildRacePreLunchDayContext } from "@/lib/nutrition/race-day-pre-race-lunch";

const requirements = { energy: { mealsKcal: 3500 } } as import("@empathy/contracts").DailyNutritionRequirementsV2;

test("race pre-lunch: pasta/riso + grana + olio, no verdura voluminosa", () => {
  const raceCtx = buildRacePreLunchDayContext({
    weightKg: 70,
    planDate: "2026-06-15",
    routineConfig: {
      week_plan: {
        sun: { day_mode: "race", race_start: "10:00" },
      },
    },
    plannedSessions: [{ duration_minutes: 180, type: "race", notes: "Gran fondo" }],
    activeMealSlots: ["breakfast", "lunch", "dinner", "snack_am", "snack_pm"],
  });
  assert.ok(raceCtx);

  const lunchSlot: MealPlanV2DietSlotBudget = {
    key: raceCtx!.mealSlot,
    label: "Pre-gara",
    pct: 30,
    kcal: 1200,
    carbs: 210,
    protein: 45,
    fat: 25,
  };

  const request: IntelligentMealPlanRequest = {
    athleteId: "test",
    planDate: "2026-06-15",
    dietType: "omnivore",
    intolerances: null,
    allergies: null,
    foodExclusions: null,
    foodPreferences: null,
    supplements: null,
    aggregateInhibitors: null,
    pathwayTimingLines: [],
    trainingDayLines: [],
    routineDigest: null,
    contextLines: [],
    mealPlanSolverMeta: { dailyMealsKcalTotal: 3500, integrationLeverLines: [] },
    slots: [],
    racePreLunch: raceCtx,
  };

  const out = composeMealPlanV2(requirements, [lunchSlot], new Map() as FdcPoolMap, { request });
  const slot = out[0]!;
  assert.ok(slot.items.length >= 3);
  assert.ok(slot.items.some((i) => /pasta|riso/i.test(i.description)));
  assert.ok(slot.items.some((i) => /grana|formaggio/i.test(i.description)));
  assert.ok(!slot.items.some((i) => /spinac|insalat|broccoli/i.test(i.description)));
});
