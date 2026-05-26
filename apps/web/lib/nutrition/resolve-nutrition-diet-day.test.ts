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

  it("legge meal_plan.caloric_split se week_plan del giorno è vuoto", () => {
    const nc = {
      meal_strategy: "6-meals",
      meal_plan: {
        caloric_split: {
          breakfast_pct: 30,
          lunch_pct: 30,
          dinner_pct: 20,
          snacks_pct: 10,
        },
      },
      week_plan: {},
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    expect(r.source).toBe("legacy_root");
    expect(r.configured).toBe(true);
    expect(r.mealCountMode).toBe("6");
    expect(r.caloricDistribution?.snacks).toBeCloseTo(10, 0);
  });

  it("inferisce 6 pasti da 25/25/20 + snacks=10 (tre spuntini da 10%) anche senza meal_count_mode in JSON", () => {
    const nc = {
      week_plan: {
        Tue: {
          day_type_pct: 100,
          caloric_distribution: { breakfast: 25, lunch: 25, dinner: 20, snacks: 10 },
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    expect(r.mealCountMode).toBe("6");
    expect(r.caloricDistribution?.snacks).toBe(30);
    expect(r.caloricDistribution?.snack_am).toBeCloseTo(10, 0);
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

  it("corregge meal_count_mode 4 → 6 se la ripartizione è 25/25/20 + tre spuntini da 10%", () => {
    const nc = {
      week_plan: {
        Tue: {
          meal_count_mode: "4",
          day_type_pct: 100,
          caloric_distribution: { breakfast: 25, lunch: 25, dinner: 20, snacks: 10 },
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    expect(r.mealCountMode).toBe("6");
    expect(r.caloricDistribution?.snack_am).toBeCloseTo(10, 0);
  });

  it("riconosce 6 pasti con snacks totale 30% (tre spuntini salvati in Profile)", () => {
    const nc = {
      week_plan: {
        Tue: {
          meal_count_mode: "6",
          day_type_pct: 100,
          caloric_distribution: { breakfast: 25, lunch: 25, dinner: 20, snacks: 30 },
        },
      },
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    expect(r.mealCountMode).toBe("6");
    expect(r.caloricDistribution?.snack_am).toBeCloseTo(10, 0);
  });

  it("legacy 4-meals + split 25/25/20/10 inferisce 6 pasti", () => {
    const nc = {
      meal_strategy: "4-meals",
      caloric_split: {
        breakfast_pct: 25,
        lunch_pct: 25,
        dinner_pct: 20,
        snacks_pct: 10,
      },
      week_plan: {},
    };
    const r = resolveNutritionDietDay(nc, "2026-05-26");
    expect(r.mealCountMode).toBe("6");
  });
});
