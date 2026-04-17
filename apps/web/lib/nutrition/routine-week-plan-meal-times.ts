/**
 * Orari pasto da `routine_config.week_plan[weekday]` con fallback a `routine_config.meal_times` flat.
 * Allinea `docs/EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md` / `EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md` (routine → nutrizione).
 */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Chiave giorno profilo (`Mon` … `Sun`), coerente con ProfilePageView. */
export function profileWeekDayKeyFromIsoLocal(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "Mon";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Mon";
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[d.getDay()] ?? "Mon";
}

function nonEmptyTime(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export type FlatMealTimes = {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack_am: string;
  snack_pm: string;
};

/**
 * Se per `isoPlanDate` esiste un giorno in `routine_config.week_plan` con almeno un orario pasto,
 * usa quello; altrimenti `flatFromRoutineRoot` (tipicamente `meal_times` sulla root routine).
 */
export function mealTimesFromRoutineWeekPlanForDate(
  routineConfig: Record<string, unknown> | null | undefined,
  isoPlanDate: string,
  flatFromRoutineRoot: FlatMealTimes,
): FlatMealTimes {
  if (!routineConfig) return flatFromRoutineRoot;
  const wd = profileWeekDayKeyFromIsoLocal(isoPlanDate);
  const weekPlan = asRecord(routineConfig.week_plan);
  const day = asRecord(weekPlan[wd]);
  const bt = nonEmptyTime(day.breakfast_time);
  const lt = nonEmptyTime(day.lunch_time);
  const dt = nonEmptyTime(day.dinner_time);
  const st = nonEmptyTime(day.snack_time);
  const ast = nonEmptyTime(day.afternoon_snack_time);
  if (!bt && !lt && !dt && !st && !ast) return flatFromRoutineRoot;
  return {
    breakfast: bt ?? flatFromRoutineRoot.breakfast,
    lunch: lt ?? flatFromRoutineRoot.lunch,
    dinner: dt ?? flatFromRoutineRoot.dinner,
    snack_am: st ?? flatFromRoutineRoot.snack_am,
    snack_pm: ast ?? flatFromRoutineRoot.snack_pm,
  };
}

