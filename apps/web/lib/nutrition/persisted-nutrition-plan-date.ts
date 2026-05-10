/** Chiave sessionStorage condivisa con Nutrizione e Bioenergetica (stesso giorno piano per atleta). */
export const NUTRITION_PLAN_DATE_STORAGE_PREFIX = "empathy-pro2.nutrition.planDate." as const;

export function isIsoDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function readPersistedNutritionPlanDate(athleteId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${NUTRITION_PLAN_DATE_STORAGE_PREFIX}${athleteId}`)?.trim();
    return raw && isIsoDateKey(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writePersistedNutritionPlanDate(athleteId: string, dateKey: string): void {
  if (typeof window === "undefined" || !isIsoDateKey(dateKey)) return;
  try {
    sessionStorage.setItem(`${NUTRITION_PLAN_DATE_STORAGE_PREFIX}${athleteId}`, dateKey);
  } catch {
    /* quota / private mode */
  }
}
