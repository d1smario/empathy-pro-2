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
  /** Totale % spuntini (5 pasti: diviso in 2; 6 pasti: vedi `snack_*` o `snacks`/3). */
  snacks: number;
  /** Solo con 6 pasti: % per spuntino mattina (se assenti, derivati da `snacks`). */
  snack_am?: number;
  snack_pm?: number;
  snack_evening?: number;
};

/** Per `meal_count_mode = 6`: tre quote spuntino (es. 10+10+10 → `snacks` totale 30). */
export function resolveSixMealSnackPercentages(dist: CaloricDistribution): {
  snack_am: number;
  snack_pm: number;
  snack_evening: number;
  snacksTotal: number;
} {
  const am = dist.snack_am;
  const pm = dist.snack_pm;
  const ev = dist.snack_evening;
  const hasExplicit =
    (am != null && Number.isFinite(am)) ||
    (pm != null && Number.isFinite(pm)) ||
    (ev != null && Number.isFinite(ev));

  if (hasExplicit) {
    const snack_am = am ?? 0;
    const snack_pm = pm ?? 0;
    const snack_evening = ev ?? 0;
    const snacksTotal = snack_am + snack_pm + snack_evening;
    return { snack_am, snack_pm, snack_evening, snacksTotal };
  }

  const mains = dist.breakfast + dist.lunch + dist.dinner;
  const s = dist.snacks;
  /** Profilo con un solo campo «Spuntini»=10 ma intenzione 10%×3 (25+25+20+10+10+10). */
  if (s > 0 && s * 3 + mains <= 100.5) {
    return { snack_am: s, snack_pm: s, snack_evening: s, snacksTotal: s * 3 };
  }

  const third = s / 3;
  return { snack_am: third, snack_pm: third, snack_evening: third, snacksTotal: s };
}

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
    const snackPct = (which: "am" | "pm" | "evening") => (d: CaloricDistribution) => {
      const r = resolveSixMealSnackPercentages(d);
      if (which === "am") return r.snack_am;
      if (which === "pm") return r.snack_pm;
      return r.snack_evening;
    };
    return [
      { key: "breakfast", label: "Colazione", pct: (d) => d.breakfast },
      { key: "snack_am", label: "Spuntino · mattina", pct: snackPct("am") },
      { key: "lunch", label: "Pranzo", pct: (d) => d.lunch },
      { key: "snack_pm", label: "Spuntino · pomeriggio", pct: snackPct("pm") },
      { key: "dinner", label: "Cena", pct: (d) => d.dinner },
      { key: "snack_evening", label: "Spuntino · serale", pct: snackPct("evening") },
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
