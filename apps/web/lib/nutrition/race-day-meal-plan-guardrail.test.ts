import { test } from "node:test";
import assert from "node:assert/strict";
import { enrichIntelligentMealPlanRequestWithRaceDay } from "./enrich-meal-plan-request-race-day";
import {
  buildRacePostRecoveryContext,
  buildRacePreLunchDayContext,
  computeRaceDaySuppressedSlots,
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

test("guardrail: gara mattutina 09:00 2h30 — recovery su snack_am post-gara, merenda alle 16", () => {
  const ctx = buildRacePreLunchDayContext({
    weightKg: 70,
    planDate: "2026-06-06",
    routineConfig: {
      week_plan: {
        Sat: { day_mode: "race", training1_start_time: "09:00", training1_duration_minutes: 150 },
      },
      meal_times: { breakfast: "07:00", snack_am: "10:30", lunch: "13:00", snack_pm: "16:00", dinner: "20:00" },
    },
    plannedSessions: [{ duration_minutes: 150, type: "race", notes: "Gara" }],
    activeMealSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"],
  });
  assert.ok(ctx);
  assert.equal(ctx!.mealSlot, "breakfast");
  assert.equal(ctx!.lunchTimeLocal, "06:00");

  const recovery = buildRacePostRecoveryContext({
    weightKg: 70,
    planDate: "2026-06-06",
    routineConfig: ctx ? {
      week_plan: { Sat: { day_mode: "race", training1_start_time: "09:00", training1_duration_minutes: 150 } },
    } : null,
    plannedSessions: [{ duration_minutes: 150, type: "race", notes: "Gara" }],
    activeMealSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"],
    mealTimesBySlot: {
      breakfast: "06:00",
      snack_am: "10:30",
      lunch: "13:00",
      snack_pm: "16:00",
      dinner: "20:00",
    },
  });
  assert.ok(recovery);
  assert.equal(recovery!.mealSlot, "snack_am");
  assert.equal(recovery!.recoveryTimeLocal, "11:45");
});

test("computeRaceDaySuppressedSlots: gara 13:00 — colazione classica, pranzo pre-gara 10:00, snack_am fueling", () => {
  const ctx = buildRacePreLunchDayContext({
    weightKg: 70,
    planDate: "2026-06-05",
    routineConfig: {
      week_plan: { Fri: { day_mode: "race", training1_start_time: "13:00", training1_duration_minutes: 180 } },
    },
    plannedSessions: [],
    activeMealSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner", "snack_evening"],
  });
  assert.ok(ctx);
  assert.equal(ctx!.mealSlot, "lunch");
  assert.equal(ctx!.lunchTimeLocal, "10:00");
  const suppressed = computeRaceDaySuppressedSlots({
    ctx: ctx!,
    activeSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner", "snack_evening"],
    mealTimesBySlot: {
      breakfast: "08:00",
      snack_am: "12:00",
      lunch: "10:00",
      snack_pm: "16:30",
      dinner: "20:00",
      snack_evening: "22:00",
    },
    postRecoveryMealSlot: "snack_pm",
  });
  assert.ok(!suppressed.includes("breakfast"), `Colazione deve restare classica, got: ${suppressed.join(", ")}`);
  assert.ok(!suppressed.includes("lunch"), `Pranzo pre-gara deve restare classico, got: ${suppressed.join(", ")}`);
  assert.ok(suppressed.includes("snack_am"), `Spuntino 12:00 in finestra fueling, got: ${suppressed.join(", ")}`);
  assert.ok(!suppressed.includes("snack_pm"), `Recovery post-gara non soppresso, got: ${suppressed.join(", ")}`);
  assert.ok(!suppressed.includes("dinner"), `Cena classica, got: ${suppressed.join(", ")}`);
  assert.ok(!suppressed.includes("snack_evening"), `Spuntino serale classico, got: ${suppressed.join(", ")}`);
});

test("guardrail: gara 13:00 — colazione composer normale (no in-ride placeholder)", () => {
  const ctx = buildRacePreLunchDayContext({
    weightKg: 70,
    planDate: "2026-06-05",
    routineConfig: {
      week_plan: { Fri: { day_mode: "race", training1_start_time: "13:00", training1_duration_minutes: 180 } },
    },
    plannedSessions: [],
    activeMealSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"],
  });
  assert.ok(ctx);
  const suppressed = computeRaceDaySuppressedSlots({
    ctx: ctx!,
    activeSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"],
    mealTimesBySlot: { breakfast: "08:00", snack_am: "12:00", lunch: "10:00", snack_pm: "16:30", dinner: "20:00" },
    postRecoveryMealSlot: "snack_pm",
  });
  const dayCtx = createMediterraneanDayContext(
    "2026-06-05",
    undefined,
    undefined,
    "omnivore",
    undefined,
    suppressed,
    ctx!,
  );
  const breakfast = composeMediterraneanMeal(
    "breakfast",
    { kcal: 550, carbsG: 70, proteinG: 25, fatG: 15 },
    dayCtx,
  );
  assert.ok(!breakfast.items.some((i) => /in-ride fueling/i.test(i.name)));
  assert.ok(breakfast.items.length > 1);
});

test("guardrail: enrich + composer — recovery post-gara su slot dedicato", () => {
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
  assert.ok(enriched.racePostRecovery);
  const dayCtx = createMediterraneanDayContext(
    "2026-06-02",
    undefined,
    undefined,
    "omnivore",
    undefined,
    undefined,
    enriched.racePreLunch!,
    enriched.racePostRecovery!,
  );
  const recoverySlot = enriched.racePostRecovery!.mealSlot;
  const meal = composeMediterraneanMeal(
    recoverySlot,
    {
      kcal: enriched.racePostRecovery!.totalKcal,
      carbsG: enriched.racePostRecovery!.choG,
      proteinG: enriched.racePostRecovery!.proteinG,
      fatG: enriched.racePostRecovery!.mctG,
    },
    dayCtx,
  );
  const names = meal.items.map((i) => i.name.toLowerCase()).join(" ");
  assert.match(names, /riso|carbo recovery/);
  assert.match(names, /eaa|proteine isolate/);
  assert.match(names, /mct/);
});
