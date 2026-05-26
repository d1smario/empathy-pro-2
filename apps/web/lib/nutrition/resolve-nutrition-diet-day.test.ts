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

  it("usa caloric_split legacy se week_plan ha solo meal_count_mode", () => {
    const nc = {
      caloric_split: {
        breakfast_pct: 30,
        lunch_pct: 30,
        dinner_pct: 20,
        snacks_pct: 10,
      },
      week_plan: {
        Tue: {
          meal_count_mode: "6",
          day_type_pct: 100,
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    expect(r.configured).toBe(true);
    expect(r.mealCountMode).toBe("6");
    expect(r.caloricDistribution?.lunch).toBeCloseTo(30, 0);
  });

  it("completa % mancanti in parity Profile se c’è meal_count_mode ma nessuno split", () => {
    const nc = {
      week_plan: {
        Tue: { meal_count_mode: "4", day_type_pct: 100 },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    expect(r.configured).toBe(true);
    expect(r.caloricDistribution?.breakfast).toBeCloseTo(30, 0);
  });
});
