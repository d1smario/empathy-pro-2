import assert from "node:assert/strict";
import test from "node:test";
import type { BioenergeticDayKernelOutput } from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { EMPTY_NUTRITION_PLAN_DAY } from "@/lib/bioenergetics/nutrition-plan-day-empty";
import {
  PLAN_REALITY_FULL_PLAN_SENTINEL,
  buildPlanPredictiveTimeline,
  fusePlanRealityGluLacSim,
  resolvePlanRealityAdaptFromHour,
} from "@/lib/bioenergetics/plan-reality-curve-fusion";

const kernel: BioenergeticDayKernelOutput = {
  modelVersion: 1,
  glucoseHandlingScore: 55,
  insulinDemandScore: 48,
  oxidationDriveScore: 52,
  anabolicSuppressionScore: 40,
  efficiencyBand: "moderate",
  pathwayState: "mixed",
  keyDrivers: [],
};

function baseSlice(overrides: Partial<BioenergeticDayMemorySlice> = {}): BioenergeticDayMemorySlice {
  return {
    athleteId: "a1",
    date: "2026-05-10",
    planned: [],
    executed: [],
    diaryRows: [],
    biomarkerRows: [],
    deviceExportRows: [],
    nutritionPlan: {
      ...EMPTY_NUTRITION_PLAN_DAY,
      planSource: "nutrition_plans",
      dailyCarbsG: 250,
      dailyKcal: 2400,
      plannedMeals: [
        {
          slot: "breakfast",
          entry_time: "2026-05-10T08:00:00",
          food_label: "Piano · breakfast",
          carbs_g: 55,
          protein_g: 30,
          fat_g: 12,
          kcal: 528,
          insulin_load: 35,
          glycemic_load: 40,
        },
        {
          slot: "lunch",
          entry_time: "2026-05-10T13:00:00",
          food_label: "Piano · lunch",
          carbs_g: 80,
          protein_g: 45,
          fat_g: 18,
          kcal: 768,
          insulin_load: 50,
          glycemic_load: 58,
        },
      ],
    },
    ...overrides,
  };
}

test("resolvePlanRealityAdaptFromHour: senza diario né eseguito → tutta giornata piano", () => {
  assert.equal(resolvePlanRealityAdaptFromHour("2026-05-10", baseSlice()), PLAN_REALITY_FULL_PLAN_SENTINEL);
});

test("resolvePlanRealityAdaptFromHour: diario pomeridiano → adattamento da ore >= 12", () => {
  const slice = baseSlice({
    diaryRows: [
      {
        id: "d1",
        entry_date: "2026-05-10",
        entry_time: "18:30:00",
        meal_slot: "dinner",
        food_label: "Cena reale",
        carbs_g: 70,
        kcal: 600,
      },
    ],
  });
  assert.equal(resolvePlanRealityAdaptFromHour("2026-05-10", slice), 17);
});

test("buildPlanPredictiveTimeline include pasti piano e sedute pianificate", () => {
  const slice = baseSlice({
    planned: [
      {
        id: "p1",
        athleteId: "a1",
        date: "2026-05-10",
        type: "ride",
        durationMinutes: 90,
        tssTarget: 80,
      } as BioenergeticDayMemorySlice["planned"][number],
    ],
  });
  const tl = buildPlanPredictiveTimeline("2026-05-10", slice, slice.nutritionPlan);
  assert.ok(tl.some((e) => e.type === "meal" && e.payload?.plannedMeal === true));
  assert.ok(tl.some((e) => e.type === "planned_session"));
});

test("fusePlanRealityGluLacSim: con piano produce serie dense", () => {
  const fused = fusePlanRealityGluLacSim({
    date: "2026-05-10",
    kernel,
    slice: baseSlice(),
    nutritionPlan: baseSlice().nutritionPlan,
    mealResponseScale01: 1,
    activityResponseScale01: 1,
  });
  assert.ok(fused);
  assert.ok((fused!.glucose.length ?? 0) >= 72);
  assert.equal(fused!.meta.planSource, "nutrition_plans");
});

test("fusePlanRealityGluLacSim: diario serale modifica traccia vs solo piano", () => {
  const planOnly = fusePlanRealityGluLacSim({
    date: "2026-05-10",
    kernel,
    slice: baseSlice(),
    nutritionPlan: baseSlice().nutritionPlan,
    mealResponseScale01: 1,
    activityResponseScale01: 1,
  });
  const withDiary = fusePlanRealityGluLacSim({
    date: "2026-05-10",
    kernel,
    slice: baseSlice({
      diaryRows: [
        {
          id: "d1",
          entry_date: "2026-05-10",
          entry_time: "19:00:00",
          meal_slot: "dinner",
          food_label: "Cena",
          carbs_g: 120,
          kcal: 900,
        },
      ],
    }),
    nutritionPlan: baseSlice().nutritionPlan,
    mealResponseScale01: 1,
    activityResponseScale01: 1,
  });
  assert.ok(planOnly && withDiary);
  const eveningPlan = planOnly!.glucose.filter((p) => p.ts.includes("T19:") || p.ts.includes("T20:"));
  const eveningReal = withDiary!.glucose.filter((p) => p.ts.includes("T19:") || p.ts.includes("T20:"));
  assert.ok(eveningPlan.length > 0 && eveningReal.length > 0);
  const planAvg = eveningPlan.reduce((s, p) => s + p.value, 0) / eveningPlan.length;
  const realAvg = eveningReal.reduce((s, p) => s + p.value, 0) / eveningReal.length;
  assert.notEqual(Math.round(planAvg * 100), Math.round(realAvg * 100));
});
