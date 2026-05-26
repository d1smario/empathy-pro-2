import { describe, expect, it } from "vitest";
import { reconcileMealPlanSlotsWithDiet } from "./reconcile-meal-plan-slots-with-diet";
import type { IntelligentMealPlanRequestSlot } from "./intelligent-meal-plan-types";

describe("reconcileMealPlanSlotsWithDiet", () => {
  it("ricostruisce 6 slot da Diet DB anche se il client invia 4 pasti", () => {
    const nc = {
      week_plan: {
        Tue: {
          meal_count_mode: "6",
          day_type_pct: 100,
          caloric_distribution: {
            breakfast: 25,
            lunch: 25,
            dinner: 20,
            snacks: 30,
            snack_am: 10,
            snack_pm: 10,
            snack_evening: 10,
          },
        },
      },
    };
    const clientSlots: IntelligentMealPlanRequestSlot[] = [
      {
        slot: "breakfast",
        labelIt: "Colazione",
        scheduledTimeLocal: "07:30",
        targetKcal: 500,
        targetCarbsG: 60,
        targetProteinG: 20,
        targetFatG: 15,
        functionalTargets: [],
        functionalFoodGroups: [],
        foodCandidates: [],
      },
      {
        slot: "lunch",
        labelIt: "Pranzo",
        scheduledTimeLocal: "13:00",
        targetKcal: 500,
        targetCarbsG: 60,
        targetProteinG: 20,
        targetFatG: 15,
        functionalTargets: [],
        functionalFoodGroups: [],
        foodCandidates: [],
      },
      {
        slot: "dinner",
        labelIt: "Cena",
        scheduledTimeLocal: "20:00",
        targetKcal: 400,
        targetCarbsG: 48,
        targetProteinG: 16,
        targetFatG: 12,
        functionalTargets: [],
        functionalFoodGroups: [],
        foodCandidates: [],
      },
      {
        slot: "snack_am",
        labelIt: "Spuntino",
        scheduledTimeLocal: "10:30",
        targetKcal: 200,
        targetCarbsG: 24,
        targetProteinG: 8,
        targetFatG: 6,
        functionalTargets: [],
        functionalFoodGroups: [],
        foodCandidates: [],
      },
    ];

    const r = reconcileMealPlanSlotsWithDiet({
      planDate: "2026-05-26",
      nutritionConfig: nc,
      routineConfig: null,
      dailyMealsKcalTotal: 2000,
      clientSlots,
      preferredMealCount: 6,
    });

    expect(r.dietConfigured).toBe(true);
    expect(r.mealCountMode).toBe("6");
    expect(r.slots).toHaveLength(6);
    expect(r.rebuiltFromDiet).toBe(true);
    expect(r.slots.some((s) => s.slot === "snack_evening")).toBe(true);
    expect(r.slots.some((s) => s.slot === "snack_pm")).toBe(true);
    const sumKcal = r.slots.reduce((a, s) => a + s.targetKcal, 0);
    expect(sumKcal).toBeGreaterThan(1900);
  });
});
