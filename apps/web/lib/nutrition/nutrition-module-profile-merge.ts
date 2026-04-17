/**
 * Merge antropometria / identità per `GET /api/nutrition/module`.
 * Usa la stessa `db` post-`requireAthleteReadContext` (service role se presente) così peso/altezza/data
 * non dipendono solo da `resolveAthleteMemory` + `createServerSupabaseClient` (possibile divergenza RLS/chiave).
 */

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
};

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
    };
  }

  return {
    ...fromMemory,
    birth_date: fromMemory.birth_date ?? rowBirth,
    sex: fromMemory.sex ?? rowSex,
    height_cm: fromMemory.height_cm ?? hDb,
    weight_kg: fromMemory.weight_kg ?? wDb,
    body_fat_pct: fromMemory.body_fat_pct ?? bfDb,
    muscle_mass_kg: fromMemory.muscle_mass_kg ?? mmDb,
  };
}
