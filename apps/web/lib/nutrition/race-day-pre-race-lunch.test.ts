import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRacePostRecoveryContext,
  buildRacePreLunchDayContext,
  choosePostRaceChoPerKg,
  composeRacePostRecoveryMeal,
  getRaceDayPostRecoveryRule,
  rebalanceMealRowsForRacePostRecovery,
  buildRacePreRaceKcalTopUpItem,
  computePreRaceLunchMinutes,
  dryStapleGramsForTargetCarbs,
  getRaceDayPreRaceLunchProtocol,
  isPlannedSessionRaceLike,
  mapPlannedSessionsForRaceDetection,
  RACE_DAY_PRE_RACE_LUNCH_PROTOCOL,
} from "./race-day-pre-race-lunch";
import { nutrientsForMealPlanItem } from "./canonical-food-composition";
import { composeMediterraneanMeal, createMediterraneanDayContext } from "./mediterranean-meal-composer";
import {
  formatMinutesToLocalHHmm,
  parseLocalTimeToMinutes,
  resolveMealTimesForNutritionPlanDate,
} from "./nutrition-meal-times-training-coherence";

test("protocollo pre-gara canonico: valori fissi piattaforma", () => {
  const p = getRaceDayPreRaceLunchProtocol();
  assert.deepEqual(p, RACE_DAY_PRE_RACE_LUNCH_PROTOCOL);
  assert.equal(p.hoursBeforeRace, 3);
  assert.equal(p.carbsPerKgG, 3);
  assert.equal(p.oliveOilG, 15);
});

test("gara 220 min start 13:30 → pranzo 10:30 (3 h prima)", () => {
  const ctx = buildRacePreLunchDayContext({
    weightKg: 70,
    planDate: "2026-05-31",
    routineConfig: {
      week_plan: {
        Sun: {
          day_mode: "race",
          has_training: true,
          training1_start_time: "13:30",
          training1_duration_minutes: 220,
        },
      },
    },
    plannedSessions: [
      {
        duration_minutes: 220,
        type: "race",
        sessionName: "Gara",
      },
    ],
  });
  assert.ok(ctx);
  assert.equal(ctx!.lunchTimeLocal, "10:30");
  assert.equal(ctx!.raceStartLocal, "13:30");
  assert.equal(Math.round(ctx!.weightKg * ctx!.rule.carbsPerKgG), 210);
});

test("resolveMealTimesForNutritionPlanDate: gara non sposta pranzo dopo fine seduta", () => {
  const times = resolveMealTimesForNutritionPlanDate({
    routineConfig: {
      week_plan: {
        Sun: {
          day_mode: "race",
          has_training: true,
          training1_start_time: "13:30",
          training1_duration_minutes: 220,
        },
      },
      meal_times: { breakfast: "07:00", lunch: "13:00", dinner: "20:00", snack_am: "10:00", snack_pm: "16:00" },
    },
    planDate: "2026-05-31",
    mealTimesFlatFromRoot: {
      breakfast: "07:00",
      lunch: "13:00",
      dinner: "20:00",
      snack_am: "10:00",
      snack_pm: "16:00",
    },
    plannedSessions: [{ duration_minutes: 220, type: "race", sessionName: "Gara lunga" }],
    weightKg: 72,
  });
  assert.equal(times.lunch, "10:30");
});

test("composeMediterraneanMeal lunch pre-gara: niente spinaci nel piatto base", () => {
  const raceCtx = buildRacePreLunchDayContext({
    weightKg: 67,
    planDate: "2026-06-02",
    routineConfig: {
      week_plan: { Tue: { day_mode: "race", training1_start_time: "14:00" } },
    },
    plannedSessions: [],
  });
  assert.ok(raceCtx);
  const dayCtx = createMediterraneanDayContext("2026-06-02", undefined, undefined, "omnivore", undefined, undefined, raceCtx!);
  const meal = composeMediterraneanMeal("lunch", { kcal: 900, carbsG: 200, proteinG: 30, fatG: 20 }, dayCtx);
  const names = meal.items.map((i) => i.name.toLowerCase()).join(" ");
  assert.match(names, /pasta|riso/);
  assert.doesNotMatch(names, /spinac/);
});

test("composeMediterraneanMeal lunch pre-gara: pasta/riso + grana + olio", () => {
  const raceCtx = buildRacePreLunchDayContext({
    weightKg: 70,
    planDate: "2026-05-31",
    routineConfig: {
      week_plan: { Sun: { day_mode: "race", training1_start_time: "13:30" } },
    },
    plannedSessions: [{ duration_minutes: 220, type: "race" }],
  });
  assert.ok(raceCtx);
  const dayCtx = createMediterraneanDayContext("2026-05-31", undefined, undefined, "omnivore", undefined, undefined, raceCtx!);
  const meal = composeMediterraneanMeal(
    "lunch",
    { kcal: 1400, carbsG: 210, proteinG: 45, fatG: 25 },
    dayCtx,
  );
  const names = meal.items.map((i) => i.name).join(" ");
  assert.match(names, /Pasta|Riso/);
  assert.ok(meal.items.some((i) => /grana/i.test(i.name)));
  assert.ok(meal.items.some((i) => /olio/i.test(i.name)));
  assert.ok(!meal.items.some((i) => /verdure/i.test(i.name)));
  assert.ok(meal.items.some((i) => /Crostata|Torta/i.test(i.name)));
});

test("gap kcal pre-gara: crostata/torta risolve in memoria canonica", () => {
  const topUp = buildRacePreRaceKcalTopUpItem(220, 3);
  assert.ok(topUp);
  const res = nutrientsForMealPlanItem({ name: topUp!.name, portionHint: topUp!.portionHint, approxKcal: topUp!.approxKcal });
  assert.notEqual(res.compositionStatus, "unresolved");
});

test("gap kcal sotto soglia: nessun top-up", () => {
  assert.equal(buildRacePreRaceKcalTopUpItem(40, 1), null);
});

test("isPlannedSessionRaceLike riconosce type race e keyword gara", () => {
  assert.equal(isPlannedSessionRaceLike({ type: "race" }), true);
  assert.equal(isPlannedSessionRaceLike({ sessionName: "Gran fondo Dolomiti" }), true);
  assert.equal(isPlannedSessionRaceLike({ type: "endurance", sessionName: "Z2 long" }), false);
});

test("dryStapleGramsForTargetCarbs coerente con 3 g/kg @ 70 kg", () => {
  const g = dryStapleGramsForTargetCarbs("pasta", 210);
  assert.ok(g >= 250 && g <= 290);
});

test("mapPlannedSessionsForRaceDetection legge builder session name", () => {
  const mapped = mapPlannedSessionsForRaceDetection([
    {
      duration_minutes: 220,
      type: "cycling",
      builderSession: { sessionName: "Gara Ironman", adaptationTarget: "race_pace" },
    },
  ]);
  assert.equal(mapped[0]?.sessionName, "Gara Ironman");
});

test("computePreRaceLunchMinutes", () => {
  const start = parseLocalTimeToMinutes("13:30");
  assert.ok(start != null);
  assert.equal(formatMinutesToLocalHHmm(computePreRaceLunchMinutes(start!, 3)), "10:30");
});

test("post-recovery C: CHO dinamico 1.2 g/kg per gara 150 min", () => {
  const ctx = buildRacePostRecoveryContext({
    weightKg: 67,
    planDate: "2026-06-02",
    routineConfig: {
      week_plan: {
        Tue: {
          day_mode: "race",
          training1_start_time: "14:00",
          training1_duration_minutes: 150,
        },
      },
    },
    plannedSessions: [{ duration_minutes: 150, type: "race", sessionName: "Gara test" }],
    activeMealSlots: ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"],
    mealTimesBySlot: {
      breakfast: "07:00",
      snack_am: "10:00",
      lunch: "12:30",
      snack_pm: "16:30",
      dinner: "20:00",
    },
  });
  assert.ok(ctx);
  assert.equal(ctx!.choPerKgG, 1.2);
  assert.equal(ctx!.choG, Math.round(67 * 1.2));
  assert.equal(ctx!.proteinG, Math.round(67 * 0.6));
  assert.equal(ctx!.mctG, Math.round(67 * 0.2));
  assert.ok(ctx!.totalKcal > 0);
  assert.equal(ctx!.mealSlot, "dinner");
});

test("composeRacePostRecoveryMeal: include CHO + PRO + MCT items", () => {
  const ctx = {
    weightKg: 67,
    raceLabel: "Gara test",
    raceEndMinutes: 16 * 60 + 30,
    recoveryTimeLocal: "16:45",
    mealSlot: "snack_pm",
    choPerKgG: 1.2,
    choG: Math.round(67 * 1.2),
    proteinG: Math.round(67 * 0.6),
    mctG: Math.round(67 * 0.2),
    totalKcal: Math.round(Math.round(67 * 1.2) * 4 + Math.round(67 * 0.6) * 4 + Math.round(67 * 0.2) * 8.3),
  } as const;
  const meal = composeRacePostRecoveryMeal("snack_pm", 2, ctx);
  const labels = meal.items.map((i) => i.name.toLowerCase()).join(" | ");
  assert.match(labels, /riso|carbo recovery/);
  assert.match(labels, /eaa|proteine isolate/);
  assert.match(labels, /mct/);
  assert.ok(meal.totalApproxKcal > 0);
});

test("CHO post-gara per durata: 90 / 150 / 200 min", () => {
  const rule = getRaceDayPostRecoveryRule();
  assert.equal(choosePostRaceChoPerKg(90, rule), 1.0);
  assert.equal(choosePostRaceChoPerKg(150, rule), 1.2);
  assert.equal(choosePostRaceChoPerKg(200, rule), 1.5);
});

test("rebalanceMealRowsForRacePostRecovery: totale kcal giorno invariato", () => {
  const recovery = {
    weightKg: 67,
    raceLabel: "Gara",
    raceEndMinutes: 16 * 60 + 30,
    recoveryTimeLocal: "16:45",
    mealSlot: "dinner" as const,
    choPerKgG: 1.2,
    choG: 80,
    proteinG: 40,
    mctG: 13,
    totalKcal: 536,
  };
  const rows = [
    { key: "breakfast", label: "Colazione", kcal: 600, carbs: 80, protein: 25, fat: 15, timeLocal: "07:00" },
    { key: "lunch", label: "Pranzo", kcal: 900, carbs: 120, protein: 40, fat: 25, timeLocal: "11:00" },
    { key: "dinner", label: "Cena", kcal: 800, carbs: 90, protein: 45, fat: 30, timeLocal: "20:00" },
  ];
  const before = rows.reduce((s, r) => s + r.kcal, 0);
  const out = rebalanceMealRowsForRacePostRecovery(rows, recovery);
  const after = out.reduce((s, r) => s + r.kcal, 0);
  assert.equal(after, before);
  assert.equal(out.find((r) => r.key === "dinner")!.kcal, 536);
});
