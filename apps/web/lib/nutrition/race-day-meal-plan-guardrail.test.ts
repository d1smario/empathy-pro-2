import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichIntelligentMealPlanRequestWithRaceDay } from "./enrich-meal-plan-request-race-day";
import {
  buildRacePreLunchDayContext,
  resolvePreRaceMealSlot,
} from "./race-day-pre-race-lunch";
import { composeMediterraneanMeal, createMediterraneanDayContext } from "./mediterranean-meal-composer";
import type { IntelligentMealPlanRequest, IntelligentMealPlanRequestSlot } from "./intelligent-meal-plan-types";

const slots3 = (): IntelligentMealPlanRequestSlot[] => [
  {
    slot: "breakfast",
    labelIt: "Colazione",
    scheduledTimeLocal: "08:00",
    targetKcal: 500,
    targetCarbsG: 80,
    targetProteinG: 20,
    targetFatG: 12,
    functionalTargets: [],
    functionalFoodGroups: [],
    foodCandidates: [],
  },
  {
    slot: "lunch",
    labelIt: "Pranzo",
    scheduledTimeLocal: "13:00",
    targetKcal: 800,
    targetCarbsG: 120,
    targetProteinG: 35,
    targetFatG: 22,
    functionalTargets: [],
    functionalFoodGroups: [],
    foodCandidates: [],
  },
  {
    slot: "dinner",
    labelIt: "Cena",
    scheduledTimeLocal: "20:00",
    targetKcal: 700,
    targetCarbsG: 90,
    targetProteinG: 40,
    targetFatG: 25,
    functionalTargets: [],
    functionalFoodGroups: [],
    foodCandidates: [],
  },
];

test("resolvePreRaceMealSlot: gara 10 → colazione, gara 14 → pranzo", () => {
  const active = ["breakfast", "lunch", "dinner"] as const;
  assert.equal(resolvePreRaceMealSlot(7 * 60, active), "breakfast");
  assert.equal(resolvePreRaceMealSlot(10 * 60, active), "lunch");
  assert.equal(resolvePreRaceMealSlot(11 * 60, active), "lunch");
});

test("guardrail: enrich + composer — pasta/riso nello slot pre-gara (no spinaci)", () => {
  const base: IntelligentMealPlanRequest = {
    athleteId: "test",
    planDate: "2026-06-02",
    dietType: "omnivore",
    contextLines: [],
    trainingDayLines: [],
    pathwayTimingLines: [],
    slots: slots3(),
    mealPlanSolverMeta: { dailyMealsKcalTotal: 2000, integrationLeverLines: [] },
  };
  const enriched = enrichIntelligentMealPlanRequestWithRaceDay({
    request: base,
    routineConfig: {
      week_plan: { Tue: { day_mode: "race", training1_start_time: "14:00", training1_duration_minutes: 150 } },
    },
    weightKg: 67,
    plannedSessions: [],
  });
  assert.ok(enriched.racePreLunch);
  assert.equal(enriched.racePreLunch!.mealSlot, "lunch");
  const dayCtx = createMediterraneanDayContext(
    "2026-06-02",
    undefined,
    undefined,
    "omnivore",
    undefined,
    undefined,
    enriched.racePreLunch!,
  );
  const lunch = composeMediterraneanMeal(
    "lunch",
    { kcal: 800, carbsG: 200, proteinG: 30, fatG: 20 },
    dayCtx,
  );
  const names = lunch.items.map((i) => i.name.toLowerCase()).join(" ");
  assert.match(names, /pasta|riso/);
  assert.doesNotMatch(names, /spinac/);
  assert.ok(lunch.items.some((i) => /grana/i.test(i.name)));
});

test("guardrail: gara mattutina 10:00 → pre-gara in colazione alle 07:00", () => {
  const ctx = buildRacePreLunchDayContext({
    weightKg: 70,
    planDate: "2026-06-02",
    routineConfig: {
      week_plan: { Tue: { day_mode: "race", training1_start_time: "10:00", training1_duration_minutes: 90 } },
    },
    plannedSessions: [],
    activeMealSlots: ["breakfast", "lunch", "dinner"],
  });
  assert.ok(ctx);
  assert.equal(ctx!.mealSlot, "breakfast");
  assert.equal(ctx!.lunchTimeLocal, "07:00");
});
