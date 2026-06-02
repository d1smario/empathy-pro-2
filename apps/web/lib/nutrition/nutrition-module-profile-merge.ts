/**
 * Merge antropometria / identità per `GET /api/nutrition/module`.
 * Usa la stessa `db` post-`requireAthleteReadContext` (service role se presente) così peso/altezza/data
 * non dipendono solo da `resolveAthleteMemory` + `createServerSupabaseClient` (possibile divergenza RLS/chiave).
 */

import { mergeNutritionConfigRecords, parseNutritionConfigRecord } from "@/lib/nutrition/resolve-nutrition-diet-day";

export type NutritionModuleFlatProfile = {
  id: string;
  birth_date: string | null;
  sex: string | null;
  diet_type: string | null;
  intolerances: string[] | null;
  allergies: string[] | null;
  food_preferences: string[] | null;
  food_exclusions: string[] | null;
  supplements: string[] | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  lifestyle_activity_class: string | null;
  routine_config: Record<string, unknown> | null;
  nutrition_config: Record<string, unknown> | null;
  supplement_config: Record<string, unknown> | null;
  preferred_meal_count: number | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** `week_plan` e `meal_times` da DB sovrascrivono la memoria atleta (routine gara non deve restare stale). */
export function mergeRoutineConfigRecords(
  fromMemory: Record<string, unknown> | null,
  fromDb: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!fromMemory && !fromDb) return null;
  if (!fromMemory) return fromDb;
  if (!fromDb) return fromMemory;
  const memWeek = asRecord(fromMemory.week_plan) ?? {};
  const dbWeek = asRecord(fromDb.week_plan) ?? {};
  const memMeals = asRecord(fromMemory.meal_times) ?? {};
  const dbMeals = asRecord(fromDb.meal_times) ?? {};
  return {
    ...fromMemory,
    ...fromDb,
    week_plan: { ...memWeek, ...dbWeek },
    meal_times: { ...memMeals, ...dbMeals },
  };
}

function coerceDbNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mergeNutritionModuleProfileWithAthleteProfileRow(
  athleteId: string,
  fromMemory: NutritionModuleFlatProfile | null,
  row: Record<string, unknown> | null | undefined,
): NutritionModuleFlatProfile | null {
  if (!row && !fromMemory) return null;

  const rowBirth = typeof row?.birth_date === "string" ? row.birth_date : null;
  const rowSex = typeof row?.sex === "string" ? row.sex : null;
  const wDb = coerceDbNumeric(row?.weight_kg);
  const hDb = coerceDbNumeric(row?.height_cm);
  const bfDb = coerceDbNumeric(row?.body_fat_pct);
  const mmDb = coerceDbNumeric(row?.muscle_mass_kg);

  if (!fromMemory) {
    if (!row) return null;
    return {
      id: athleteId,
      birth_date: rowBirth,
      sex: rowSex,
      diet_type: null,
      intolerances: null,
      allergies: null,
      food_preferences: null,
      food_exclusions: null,
      supplements: null,
      height_cm: hDb,
      weight_kg: wDb,
      body_fat_pct: bfDb,
      muscle_mass_kg: mmDb,
      lifestyle_activity_class: null,
      routine_config: null,
      nutrition_config: null,
      supplement_config: null,
      preferred_meal_count: null,
    };
  }

  const rowNutrition =
    row?.nutrition_config && typeof row.nutrition_config === "object" && !Array.isArray(row.nutrition_config)
      ? (row.nutrition_config as Record<string, unknown>)
      : null;
  const rowRoutine =
    row?.routine_config && typeof row.routine_config === "object" && !Array.isArray(row.routine_config)
      ? (row.routine_config as Record<string, unknown>)
      : null;

  return {
    ...fromMemory,
    birth_date: fromMemory.birth_date ?? rowBirth,
    sex: fromMemory.sex ?? rowSex,
    height_cm: fromMemory.height_cm ?? hDb,
    weight_kg: fromMemory.weight_kg ?? wDb,
    body_fat_pct: fromMemory.body_fat_pct ?? bfDb,
    muscle_mass_kg: fromMemory.muscle_mass_kg ?? mmDb,
    nutrition_config:
      rowNutrition && fromMemory.nutrition_config
        ? mergeNutritionConfigRecords(
            parseNutritionConfigRecord(fromMemory.nutrition_config),
            parseNutritionConfigRecord(rowNutrition),
          )
        : (rowNutrition ?? fromMemory.nutrition_config),
    routine_config: mergeRoutineConfigRecords(fromMemory.routine_config, rowRoutine),
    preferred_meal_count:
      coerceDbNumeric(row?.preferred_meal_count) ?? fromMemory.preferred_meal_count ?? null,
  };
}
