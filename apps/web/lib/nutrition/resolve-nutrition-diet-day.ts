/**
 * Lettura canonica Diet per **un giorno di piano** (data ISO → chiave Mon…Sun).
 *
 * Regola generativa: ogni giorno del meal plan usa **solo** ciò che l’utente ha salvato in
 * Profile → Diet per quel giorno della settimana (`nutrition_config.week_plan[wd]`).
 * Nessun preset globale 30/35/25/10: se il giorno non è configurato, `configured === false`.
 */

import type { CaloricDistribution, MacroSplitPct } from "@/lib/nutrition/diet-meal-slot-budgets";
import { normalizeCaloricDistribution } from "@/lib/nutrition/diet-meal-slot-budgets";
import { profileWeekDayKeyFromIsoLocal } from "@/lib/nutrition/routine-week-plan-meal-times";

export type NutritionDietDaySource = "week_plan" | "legacy_root" | "missing";

export type ResolvedNutritionDietDay = {
  planDate: string;
  weekDayKey: string;
  source: NutritionDietDaySource;
  configured: boolean;
  mealCountMode: string;
  caloricDistribution: CaloricDistribution | null;
  dailyMacros: MacroSplitPct | null;
  dayType: string;
  /** % calorie rispetto fabbisogno (Profile Diet → «% calorie rispetto fabbisogno»). */
  dayTypePct: number;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readCaloricDistribution(raw: Record<string, unknown>): CaloricDistribution | null {
  const cal = asRecord(raw.caloric_distribution);
  const breakfast = num(cal.breakfast);
  const lunch = num(cal.lunch);
  const dinner = num(cal.dinner);
  const snacks = num(cal.snacks);
  if (breakfast == null && lunch == null && dinner == null && snacks == null) return null;
  const dist: CaloricDistribution = {
    breakfast: breakfast ?? 0,
    lunch: lunch ?? 0,
    dinner: dinner ?? 0,
    snacks: snacks ?? 0,
  };
  return normalizeCaloricDistribution(dist);
}

/** Distribuzione utilizzabile dal solver (somma % > 0). */
export function isUsableCaloricDistribution(dist: CaloricDistribution | null): boolean {
  if (!dist) return false;
  return dist.breakfast + dist.lunch + dist.dinner + dist.snacks > 0;
}

/**
 * Allinea la lettura al merge Profile (`startEditProfile`): campi mancanti nel JSON
 * non devono bloccare il generativo se l’atleta ha già `meal_count_mode` per quel giorno.
 */
function profileParityCaloricDistribution(dayRaw: Record<string, unknown>): CaloricDistribution {
  const cal = asRecord(dayRaw.caloric_distribution);
  return normalizeCaloricDistribution({
    breakfast: num(cal.breakfast) ?? 30,
    lunch: num(cal.lunch) ?? 35,
    dinner: num(cal.dinner) ?? 25,
    snacks: num(cal.snacks) ?? 10,
  });
}

function resolveCaloricDistributionForDay(
  dayRaw: Record<string, unknown>,
  nc: Record<string, unknown>,
  weekMealMode: string,
): CaloricDistribution | null {
  const fromWeek = readCaloricDistribution(dayRaw);
  if (isUsableCaloricDistribution(fromWeek)) return fromWeek;

  const legacy = readFromLegacyRoot(nc);
  if (isUsableCaloricDistribution(legacy.caloricDistribution)) return legacy.caloricDistribution;

  if (weekMealMode.length > 0) {
    return profileParityCaloricDistribution(dayRaw);
  }
  return null;
}

function readDailyMacros(raw: Record<string, unknown>): MacroSplitPct | null {
  const macros = asRecord(raw.daily_macros);
  const carbs = num(macros.cho_pct ?? macros.carbs_pct);
  const protein = num(macros.pro_pct ?? macros.protein_pct);
  const fat = num(macros.fat_pct);
  if (carbs == null && protein == null && fat == null) return null;
  return {
    carbs: carbs ?? 50,
    protein: protein ?? 25,
    fat: fat ?? 25,
  };
}

function readFromLegacyRoot(nc: Record<string, unknown>): {
  mealCountMode: string;
  caloricDistribution: CaloricDistribution | null;
  dailyMacros: MacroSplitPct | null;
} {
  const split = asRecord(nc.caloric_split);
  const macro = asRecord(nc.macro_split);
  const dist =
    num(split.breakfast_pct) != null ||
    num(split.lunch_pct) != null ||
    num(split.dinner_pct) != null ||
    num(split.snacks_pct) != null
      ? normalizeCaloricDistribution({
          breakfast: num(split.breakfast_pct) ?? 0,
          lunch: num(split.lunch_pct) ?? 0,
          dinner: num(split.dinner_pct) ?? 0,
          snacks: num(split.snacks_pct) ?? 0,
        })
      : null;
  const dailyMacros =
    num(macro.carbs_pct) != null || num(macro.protein_pct) != null || num(macro.fat_pct) != null
      ? {
          carbs: num(macro.carbs_pct) ?? 50,
          protein: num(macro.protein_pct) ?? 25,
          fat: num(macro.fat_pct) ?? 25,
        }
      : null;
  const mealStrategy = String(nc.meal_strategy ?? "").trim();
  let mealCountMode = "4";
  if (mealStrategy === "6-meals") mealCountMode = "6";
  else if (mealStrategy === "5-meals") mealCountMode = "5";
  else if (mealStrategy === "3-meals") mealCountMode = "3";
  return { mealCountMode, caloricDistribution: dist, dailyMacros };
}

/**
 * Risolve Diet per `planDate` (YYYY-MM-DD) dal profilo atleta.
 * Priorità: `week_plan[weekday]` → legacy `caloric_split` root (profili vecchi) → non configurato.
 */
export function resolveNutritionDietDay(
  nutritionConfig: unknown,
  planDate: string,
): ResolvedNutritionDietDay {
  const iso = planDate.slice(0, 10);
  const weekDayKey = profileWeekDayKeyFromIsoLocal(iso);
  const nc = asRecord(nutritionConfig);
  const weekPlan = asRecord(nc.week_plan);
  const dayRaw = asRecord(weekPlan[weekDayKey]);

  const dayType = String(dayRaw.day_type ?? "normocaloric-100");
  const dayTypePctRaw = num(dayRaw.day_type_pct);
  const dayTypePct = dayTypePctRaw != null ? Math.max(0, Math.min(200, dayTypePctRaw)) : 100;

  const weekMacros = readDailyMacros(dayRaw);
  const weekMealMode = String(dayRaw.meal_count_mode ?? "").trim();
  const weekDist = resolveCaloricDistributionForDay(dayRaw, nc, weekMealMode);

  const weekConfigured =
    Boolean(weekMealMode) ||
    readCaloricDistribution(dayRaw) != null ||
    weekMacros != null ||
    dayTypePctRaw != null;

  if (weekConfigured) {
    const mealCountMode = weekMealMode || "4";
    return {
      planDate: iso,
      weekDayKey,
      source: "week_plan",
      configured: isUsableCaloricDistribution(weekDist) && mealCountMode.length > 0,
      mealCountMode,
      caloricDistribution: weekDist,
      dailyMacros: weekMacros,
      dayType,
      dayTypePct,
    };
  }

  const legacy = readFromLegacyRoot(nc);
  if (legacy.caloricDistribution) {
    return {
      planDate: iso,
      weekDayKey,
      source: "legacy_root",
      configured: true,
      mealCountMode: legacy.mealCountMode,
      caloricDistribution: legacy.caloricDistribution,
      dailyMacros: legacy.dailyMacros,
      dayType,
      dayTypePct,
    };
  }

  return {
    planDate: iso,
    weekDayKey,
    source: "missing",
    configured: false,
    mealCountMode: "4",
    caloricDistribution: null,
    dailyMacros: null,
    dayType,
    dayTypePct,
  };
}
