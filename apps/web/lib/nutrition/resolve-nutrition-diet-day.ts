/**
 * Lettura canonica Diet per **un giorno di piano** (data ISO → chiave Mon…Sun).
 *
 * Regola generativa: ogni giorno del meal plan usa **solo** ciò che l’utente ha salvato in
 * Profile → Diet per quel giorno della settimana (`nutrition_config.week_plan[wd]`).
 * Nessun preset globale 30/35/25/10: se il giorno non è configurato, `configured === false`.
 */

import type { CaloricDistribution, MacroSplitPct } from "@/lib/nutrition/diet-meal-slot-budgets";
import { normalizeCaloricDistribution, resolveSixMealSnackPercentages } from "@/lib/nutrition/diet-meal-slot-budgets";
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

/** JSONB a volte arriva come stringa da API/cache — normalizza prima della lettura Diet. */
export function parseNutritionConfigRecord(nutritionConfig: unknown): Record<string, unknown> {
  if (typeof nutritionConfig === "string") {
    const t = nutritionConfig.trim();
    if (!t) return {};
    try {
      return asRecord(JSON.parse(t) as unknown);
    } catch {
      return {};
    }
  }
  return asRecord(nutritionConfig);
}

/**
 * Unisce due `nutrition_config`: il secondo argomento (`db`) vince su chiavi in conflitto;
 * per `week_plan` ogni giorno nel DB sovrascrive la memoria atleta (Profile → Diet è su `athlete_profiles`).
 */
export function mergeNutritionConfigRecords(
  memoryNc: Record<string, unknown>,
  dbNc: Record<string, unknown>,
): Record<string, unknown> {
  const mem = parseNutritionConfigRecord(memoryNc);
  const db = parseNutritionConfigRecord(dbNc);
  if (!Object.keys(mem).length) return db;
  if (!Object.keys(db).length) return mem;
  return {
    ...mem,
    ...db,
    week_plan: {
      ...asRecord(mem.week_plan),
      ...asRecord(db.week_plan),
    },
  };
}

/** Pattern 25/25/20 + snacks=10 (tre spuntini da 10%) o tre campi spuntino espliciti. */
export function distributionImpliesSixMeals(
  dist: CaloricDistribution,
  dayRaw?: Record<string, unknown>,
): boolean {
  const cal = asRecord(dayRaw?.caloric_distribution);
  if (
    num(cal.snack_am) != null ||
    num(cal.snack_pm) != null ||
    num(cal.snack_evening) != null
  ) {
    return true;
  }
  const r = resolveSixMealSnackPercentages(dist);
  const mains = dist.breakfast + dist.lunch + dist.dinner;
  const daySum = mains + dist.snacks;
  /** Profile 6 pasti con campo «Spuntini» = somma tre quote (es. 30%) senza snack_am/pm/evening separati. */
  if (dist.snacks >= 20 && mains >= 55 && Math.abs(daySum - 100) < 2) return true;
  if (r.snacksTotal >= 24 && Math.abs(r.snack_am - r.snack_pm) < 2 && Math.abs(r.snack_pm - r.snack_evening) < 2) {
    return true;
  }
  if (dist.snacks > 0 && dist.snacks * 3 + mains <= 100.5) return true;
  return false;
}

export function hasNutritionMealSplitData(nc: Record<string, unknown>): boolean {
  const weekPlan = asRecord(nc.week_plan);
  for (const day of Object.values(weekPlan)) {
    const dayRaw = asRecord(day);
    if (isUsableCaloricDistribution(readCaloricDistribution(dayRaw))) return true;
  }
  const legacy = readFromLegacyRoot(nc);
  return isUsableCaloricDistribution(legacy.caloricDistribution);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readCaloricDistributionFields(
  cal: Record<string, unknown>,
  pctSuffix: boolean,
): CaloricDistribution | null {
  const bKey = pctSuffix ? "breakfast_pct" : "breakfast";
  const lKey = pctSuffix ? "lunch_pct" : "lunch";
  const dKey = pctSuffix ? "dinner_pct" : "dinner";
  const sKey = pctSuffix ? "snacks_pct" : "snacks";
  const breakfast = num(cal[bKey] ?? cal.breakfast);
  const lunch = num(cal[lKey] ?? cal.lunch);
  const dinner = num(cal[dKey] ?? cal.dinner);
  const snacks = num(cal[sKey] ?? cal.snacks);
  const snackAm = num(cal.snack_am ?? cal.snack_am_pct);
  const snackPm = num(cal.snack_pm ?? cal.snack_pm_pct);
  const snackEvening = num(cal.snack_evening ?? cal.snack_evening_pct);
  if (breakfast == null && lunch == null && dinner == null && snacks == null && snackAm == null && snackPm == null && snackEvening == null) {
    return null;
  }
  return normalizeCaloricDistribution({
    breakfast: breakfast ?? 0,
    lunch: lunch ?? 0,
    dinner: dinner ?? 0,
    snacks: snacks ?? 0,
    ...(snackAm != null ? { snack_am: snackAm } : {}),
    ...(snackPm != null ? { snack_pm: snackPm } : {}),
    ...(snackEvening != null ? { snack_evening: snackEvening } : {}),
  });
}

/** `caloric_distribution` (Profile Diet) oppure `caloric_split` sullo stesso giorno. */
function readCaloricDistribution(raw: Record<string, unknown>): CaloricDistribution | null {
  const fromDiet = readCaloricDistributionFields(asRecord(raw.caloric_distribution), false);
  if (isUsableCaloricDistribution(fromDiet)) return fromDiet;
  const fromSplit = readCaloricDistributionFields(asRecord(raw.caloric_split), true);
  if (isUsableCaloricDistribution(fromSplit)) return fromSplit;
  return fromDiet ?? fromSplit;
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
  weekConfigured: boolean,
): CaloricDistribution | null {
  const fromWeek = readCaloricDistribution(dayRaw);
  if (isUsableCaloricDistribution(fromWeek)) return fromWeek;

  const legacy = readFromLegacyRoot(nc);
  if (isUsableCaloricDistribution(legacy.caloricDistribution)) return legacy.caloricDistribution;

  if (weekMealMode.length > 0 || weekConfigured) {
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
  const mealPlan = asRecord(nc.meal_plan);
  const dist =
    readCaloricDistributionFields(asRecord(mealPlan.caloric_split), true) ??
    readCaloricDistributionFields(asRecord(nc.caloric_split), true);

  const macroRoot = asRecord(nc.macro_split);
  const macroMealPlan = asRecord(mealPlan.macro_split);
  const macro = Object.keys(macroMealPlan).length ? macroMealPlan : macroRoot;
  const dailyMacros =
    num(macro.carbs_pct) != null || num(macro.protein_pct) != null || num(macro.fat_pct) != null
      ? {
          carbs: num(macro.carbs_pct) ?? 50,
          protein: num(macro.protein_pct) ?? 25,
          fat: num(macro.fat_pct) ?? 25,
        }
      : null;

  const mealStrategy = String(mealPlan.meal_strategy ?? nc.meal_strategy ?? "").trim();
  let mealCountMode = "4";
  if (mealStrategy === "6-meals") mealCountMode = "6";
  else if (mealStrategy === "5-meals") mealCountMode = "5";
  else if (mealStrategy === "3-meals") mealCountMode = "3";
  return { mealCountMode, caloricDistribution: dist, dailyMacros };
}

function inferMealCountModeForDay(
  dayRaw: Record<string, unknown>,
  weekDist: CaloricDistribution | null,
  legacyMealCountMode: string,
): string {
  const explicit = String(dayRaw.meal_count_mode ?? "").trim();
  if (explicit && explicit !== "fasting") {
    if (explicit === "4" && weekDist && distributionImpliesSixMeals(weekDist, dayRaw)) return "6";
    return explicit;
  }

  if (weekDist && distributionImpliesSixMeals(weekDist, dayRaw)) return "6";

  if (legacyMealCountMode === "6" || legacyMealCountMode === "5" || legacyMealCountMode === "3") {
    return legacyMealCountMode;
  }
  if (legacyMealCountMode === "4" && weekDist && distributionImpliesSixMeals(weekDist, dayRaw)) {
    return "6";
  }
  return legacyMealCountMode || "4";
}

function enrichCaloricDistributionForMealMode(
  dist: CaloricDistribution | null,
  mealCountMode: string,
): CaloricDistribution | null {
  if (!dist || mealCountMode !== "6") return dist;
  const r = resolveSixMealSnackPercentages(dist);
  return {
    ...dist,
    snack_am: r.snack_am,
    snack_pm: r.snack_pm,
    snack_evening: r.snack_evening,
    snacks: r.snacksTotal,
  };
}

/**
 * Risolve Diet per `planDate` (YYYY-MM-DD) dal profilo atleta.
 * Priorità: `week_plan[weekday]` → `caloric_split` / `meal_plan.caloric_split` (profili Nutrizione) → non configurato.
 */
export function resolveNutritionDietDay(
  nutritionConfig: unknown,
  planDate: string,
  options?: { preferredMealCount?: number | null },
): ResolvedNutritionDietDay {
  const preferredMealCount = options?.preferredMealCount != null ? Math.trunc(options.preferredMealCount) : null;
  const iso = planDate.slice(0, 10);
  const weekDayKey = profileWeekDayKeyFromIsoLocal(iso);
  const nc = parseNutritionConfigRecord(nutritionConfig);
  const weekPlan = asRecord(nc.week_plan);
  const dayRaw = asRecord(weekPlan[weekDayKey]);

  const dayType = String(dayRaw.day_type ?? "normocaloric-100");
  const dayTypePctRaw = num(dayRaw.day_type_pct);
  const dayTypePct = dayTypePctRaw != null ? Math.max(0, Math.min(200, dayTypePctRaw)) : 100;

  const weekMacros = readDailyMacros(dayRaw);
  const weekMealMode = String(dayRaw.meal_count_mode ?? "").trim();
  const weekConfigured =
    Boolean(weekMealMode) ||
    readCaloricDistribution(dayRaw) != null ||
    weekMacros != null ||
    dayTypePctRaw != null;

  const legacy = readFromLegacyRoot(nc);
  const weekDist = resolveCaloricDistributionForDay(dayRaw, nc, weekMealMode, weekConfigured);

  if (weekConfigured) {
    let mealCountMode = inferMealCountModeForDay(dayRaw, weekDist, legacy.mealCountMode);
    if (
      mealCountMode === "4" &&
      preferredMealCount === 6 &&
      weekDist &&
      distributionImpliesSixMeals(weekDist, dayRaw)
    ) {
      mealCountMode = "6";
    }
    const caloricDistribution = enrichCaloricDistributionForMealMode(weekDist, mealCountMode);
    return {
      planDate: iso,
      weekDayKey,
      source: "week_plan",
      configured: isUsableCaloricDistribution(caloricDistribution) && mealCountMode.length > 0,
      mealCountMode,
      caloricDistribution,
      dailyMacros: weekMacros ?? legacy.dailyMacros,
      dayType,
      dayTypePct,
    };
  }

  if (isUsableCaloricDistribution(legacy.caloricDistribution)) {
    let mealCountMode = inferMealCountModeForDay({}, legacy.caloricDistribution, legacy.mealCountMode);
    if (
      mealCountMode === "4" &&
      preferredMealCount === 6 &&
      legacy.caloricDistribution &&
      distributionImpliesSixMeals(legacy.caloricDistribution, {})
    ) {
      mealCountMode = "6";
    }
    const caloricDistribution = enrichCaloricDistributionForMealMode(legacy.caloricDistribution, mealCountMode);
    return {
      planDate: iso,
      weekDayKey,
      source: "legacy_root",
      configured: true,
      mealCountMode,
      caloricDistribution,
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
