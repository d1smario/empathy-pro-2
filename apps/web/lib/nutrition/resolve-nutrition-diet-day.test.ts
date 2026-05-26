import { describe, expect, it } from "vitest";
import { resolveNutritionDietDay } from "./resolve-nutrition-diet-day";

describe("resolveNutritionDietDay", () => {
  it("legge week_plan per il weekday della data", () => {
    const nc = {
      week_plan: {
        Tue: {
          meal_count_mode: "6",
          day_type_pct: 100,
          caloric_distribution: { breakfast: 30, lunch: 30, dinner: 20, snacks: 10 },
          daily_macros: { cho_pct: 50, pro_pct: 25, fat_pct: 25 },
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    expect(r.weekDayKey).toBe("Tue");
    expect(r.source).toBe("week_plan");
    expect(r.configured).toBe(true);
    expect(r.mealCountMode).toBe("6");
    expect(r.caloricDistribution?.breakfast).toBeCloseTo(30, 0);
  });
});
