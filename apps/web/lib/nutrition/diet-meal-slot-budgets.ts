/**
 * Regola generativa nutrizione (stabile):
 * - **Profilo Diet** (`meal_count_mode` + `caloric_distribution` per giorno settimana) definisce
 *   numero di pasti e ripartizione % del budget pasti — unica fonte per kcal/macro per slot.
 * - **USDA / banca canonica** servono solo alla composizione degli alimenti (nutrienti per voce),
 *   mai a ricalcolare la distribuzione calorica tra pasti.
 */

import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";

export type CaloricDistribution = {
  breakfast: number;
  lunch: number;
  dinner: number;
  snacks: number;
};

export type DietMealSlotBudget = {
  key: MealSlotKey;
  label: string;
  pct: number;
  time: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
};

export type MacroSplitPct = {
  carbs: number;
  protein: number;
  fat: number;
};

function round0(v: number): number {
  return Math.round(v);
}

/** Porta breakfast+lunch+dinner+snacks a 100% se l’utente ha inserito totali ≠ 100 (valori da Diet, mai preset fissi). */
export function normalizeCaloricDistribution(dist: CaloricDistribution): CaloricDistribution {
  const sum = dist.breakfast + dist.lunch + dist.dinner + dist.snacks;
  if (sum <= 0) return dist;
  if (Math.abs(sum - 100) < 0.05) return dist;
  const f = 100 / sum;
  return {
    breakfast: dist.breakfast * f,
    lunch: dist.lunch * f,
    dinner: dist.dinner * f,
    snacks: dist.snacks * f,
  };
}

/** Ridistribuisce la quota `snacks` sui pasti principali in proporzione al loro peso. */
function redistributeSnacksOntoMains(
  dist: CaloricDistribution,
): Pick<CaloricDistribution, "breakfast" | "lunch" | "dinner"> {
  const mainSum = dist.breakfast + dist.lunch + dist.dinner;
  if (mainSum <= 0) return { breakfast: 100 / 3, lunch: 100 / 3, dinner: 100 / 3 };
  const extra = dist.snacks;
  const scale = (mainSum + extra) / mainSum;
  return {
    breakfast: dist.breakfast * scale,
    lunch: dist.lunch * scale,
    dinner: dist.dinner * scale,
  };
}

type SlotSpec = {
  key: MealSlotKey;
  label: string;
  pct: (d: CaloricDistribution) => number;
};

/** Pasti attivi per `meal_count_mode` (allineato a Profile → Diet). */
export function activeMealSlotKeysForMode(mealCountMode: string): MealSlotKey[] {
  return dietMealSlotSpecsForMode(mealCountMode).map((s) => s.key);
}

export function dietMealSlotSpecsForMode(mealCountMode: string): SlotSpec[] {
  const m = String(mealCountMode ?? "").trim();
  const dist = (d: CaloricDistribution, fn: (x: CaloricDistribution) => number) => fn(d);

  if (m === "1") {
    return [{ key: "dinner", label: "Cena", pct: () => 100 }];
  }
  if (m === "2") {
    const mains = (d: CaloricDistribution) => redistributeSnacksOntoMains(d);
    return [
      { key: "lunch", label: "Pranzo", pct: (d) => dist(d, (x) => mains(x).lunch) },
      { key: "dinner", label: "Cena", pct: (d) => dist(d, (x) => mains(x).dinner) },
    ];
  }
  if (m === "3") {
    const mains = (d: CaloricDistribution) => redistributeSnacksOntoMains(d);
    return [
      { key: "breakfast", label: "Colazione", pct: (d) => dist(d, (x) => mains(x).breakfast) },
      { key: "lunch", label: "Pranzo", pct: (d) => dist(d, (x) => mains(x).lunch) },
      { key: "dinner", label: "Cena", pct: (d) => dist(d, (x) => mains(x).dinner) },
    ];
  }
  if (m === "4") {
    return [
      { key: "breakfast", label: "Colazione", pct: (d) => d.breakfast },
      { key: "lunch", label: "Pranzo", pct: (d) => d.lunch },
      { key: "dinner", label: "Cena", pct: (d) => d.dinner },
      { key: "snack_am", label: "Spuntino", pct: (d) => d.snacks },
    ];
  }
  if (m === "6") {
    const third = (d: CaloricDistribution) => d.snacks / 3;
    return [
      { key: "breakfast", label: "Colazione", pct: (d) => d.breakfast },
      { key: "snack_am", label: "Spuntino · mattina", pct: third },
      { key: "lunch", label: "Pranzo", pct: (d) => d.lunch },
      { key: "snack_pm", label: "Spuntino · pomeriggio", pct: third },
      { key: "dinner", label: "Cena", pct: (d) => d.dinner },
      { key: "snack_evening", label: "Spuntino · serale", pct: third },
    ];
  }
  /* 5 pasti (default esplicito) e fallback */
  const half = (d: CaloricDistribution) => d.snacks / 2;
  return [
    { key: "breakfast", label: "Colazione", pct: (d) => d.breakfast },
    { key: "snack_am", label: "Spuntino · mattina", pct: half },
    { key: "lunch", label: "Pranzo", pct: (d) => d.lunch },
    { key: "snack_pm", label: "Spuntino · pomeriggio", pct: half },
    { key: "dinner", label: "Cena", pct: (d) => d.dinner },
  ];
}

export function buildDietMealSlotBudgets(input: {
  mealCountMode: string;
  caloricDistribution: CaloricDistribution;
  dailyKcal: number;
  macroSplit: MacroSplitPct;
  mealTimes: FlatMealTimes & { snack_evening?: string };
  round?: (v: number) => number;
}): DietMealSlotBudget[] {
  const round = input.round ?? round0;
  const dist = normalizeCaloricDistribution(input.caloricDistribution);
  const specs = dietMealSlotSpecsForMode(input.mealCountMode);
  const t = input.mealTimes;

  const timeFor = (key: MealSlotKey): string => {
    switch (key) {
      case "breakfast":
        return t.breakfast;
      case "lunch":
        return t.lunch;
      case "dinner":
        return t.dinner;
      case "snack_am":
        return t.snack_am;
      case "snack_pm":
        return t.snack_pm;
      case "snack_evening":
        return t.snack_evening?.trim() || "22:00";
      default:
        return "12:00";
    }
  };

  return specs.map((spec) => {
    const pct = spec.pct(dist);
    const kcal = (input.dailyKcal * pct) / 100;
    const macro = input.macroSplit;
    return {
      key: spec.key,
      label: spec.label,
      pct,
      time: timeFor(spec.key),
      kcal: round(kcal),
      carbs: round((kcal * (macro.carbs / 100)) / 4),
      protein: round((kcal * (macro.protein / 100)) / 4),
      fat: round((kcal * (macro.fat / 100)) / 9),
    };
  });
}
