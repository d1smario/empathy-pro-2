/**
 * Allinea orari pasto alla fine seduta pianificata (routine `week_plan` + durate `planned_workouts`).
 * Esempio: allenamento 10:00–14:00 → pranzo non prima di 14:00 + buffer (default 30 min), anche se il profilo diceva 13:00.
 */

import { MEAL_SLOT_ORDER, type MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  buildRacePreLunchDayContext,
  type PlannedSessionForRaceDetection,
} from "@/lib/nutrition/race-day-pre-race-lunch";
import {
  mealTimesFromRoutineWeekPlanForDate,
  profileWeekDayKeyFromIsoLocal,
  type FlatMealTimes,
} from "@/lib/nutrition/routine-week-plan-meal-times";

const SLOT_ORDER: (keyof FlatMealTimes)[] = ["breakfast", "snack_am", "lunch", "snack_pm", "dinner"];

/** Minuti tra fine allenamento e pranzo (digestibilità / doc caso 14:30 dopo 14:00). */
export const DEFAULT_POST_TRAINING_TO_LUNCH_MIN = 30;

/** Spazio minimo tra uno slot pasto e il successivo dopo ricalibrazione. */
const MIN_MINUTES_BETWEEN_MEALS = 25;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function nonEmptyTime(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function numFromUnknown(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** `HH:mm` o `H:mm` → minuti da mezzanotte (0–1439). */
export function parseLocalTimeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

export function formatMinutesToLocalHHmm(totalMinutes: number): string {
  const x = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(x / 60);
  const mi = x % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function parseMealTimesToMinutes(times: FlatMealTimes): Record<keyof FlatMealTimes, number> {
  const out = {} as Record<keyof FlatMealTimes, number>;
  for (const k of SLOT_ORDER) {
    const m = parseLocalTimeToMinutes(times[k] ?? "12:00");
    out[k] = m ?? 12 * 60;
  }
  return out;
}

function minutesToFlat(mins: Record<keyof FlatMealTimes, number>): FlatMealTimes {
  const o = {} as FlatMealTimes;
  for (const k of SLOT_ORDER) {
    o[k] = formatMinutesToLocalHHmm(mins[k]);
  }
  return o;
}

/**
 * Inizio allenamento (minuti da mezzanotte) per il `planDate` corrente, leggendo prima il week_day specifico
 * poi il root della routine. Ritorna `null` se non si può inferire (no flag allenamento e nessuna seduta utile).
 */
export function inferTrainingStartMinutesFromRoutine(
  routineWeekDay: Record<string, unknown>,
  routineRoot: Record<string, unknown>,
  plannedDurationsMinutes: number[],
): number | null {
  const sumPlanned = plannedDurationsMinutes.reduce((s, n) => s + (Number.isFinite(n) && n > 0 ? n : 0), 0);
  const hasPlanned = sumPlanned >= 25;
  const hr = routineWeekDay.has_training;
  const hasRoutineTraining =
    hr === true || hr === 1 || String(hr).toLowerCase() === "true" || String(hr) === "1";
  if (!hasPlanned && !hasRoutineTraining) return null;

  const startStr =
    nonEmptyTime(routineWeekDay.training1_start_time) ??
    nonEmptyTime(routineRoot.training1_start_time) ??
    "07:00";
  return parseLocalTimeToMinutes(startStr) ?? 7 * 60;
}

/**
 * Minuto di fine allenamento (stesso giorno): `training1_start_time` + max(durata somma pianificata, durata routine).
 * Ritorna `null` se non c’è né flag allenamento né sedute con durata.
 */
export function inferTrainingEndMinutesFromRoutineAndPlanned(
  routineWeekDay: Record<string, unknown>,
  routineRoot: Record<string, unknown>,
  plannedDurationsMinutes: number[],
): number | null {
  const sumPlanned = plannedDurationsMinutes.reduce((s, n) => s + (Number.isFinite(n) && n > 0 ? n : 0), 0);
  const hasPlanned = sumPlanned >= 25;
  const hr = routineWeekDay.has_training;
  const hasRoutineTraining =
    hr === true || hr === 1 || String(hr).toLowerCase() === "true" || String(hr) === "1";
  if (!hasPlanned && !hasRoutineTraining) return null;

  const startMin = inferTrainingStartMinutesFromRoutine(routineWeekDay, routineRoot, plannedDurationsMinutes);
  if (startMin == null) return null;

  const routineDur = numFromUnknown(routineWeekDay.training1_duration_minutes, 0);
  const dur = Math.max(hasPlanned ? sumPlanned : 0, hasRoutineTraining ? routineDur : 0);
  if (dur < 25) return null;

  return startMin + dur;
}

/**
 * Dopo aver calcolato la fine allenamento, alza il pranzo se troppo presto e propaga vincoli in avanti sulla catena pasti.
 */
export function applyTrainingEndToMealTimes(
  base: FlatMealTimes,
  trainingEndMinute: number | null,
  options?: { postTrainingToLunchMin?: number },
): FlatMealTimes {
  if (trainingEndMinute == null || !Number.isFinite(trainingEndMinute)) return base;

  const gap = options?.postTrainingToLunchMin ?? DEFAULT_POST_TRAINING_TO_LUNCH_MIN;
  const mins = parseMealTimesToMinutes(base);
  const minLunch = trainingEndMinute + gap;
  mins.lunch = Math.max(mins.lunch, minLunch);

  for (let i = 1; i < SLOT_ORDER.length; i++) {
    const k = SLOT_ORDER[i];
    const prev = SLOT_ORDER[i - 1];
    mins[k] = Math.max(mins[k], mins[prev] + MIN_MINUTES_BETWEEN_MEALS);
  }

  return minutesToFlat(mins);
}

/** Week plan + `meal_times` flat + aggiustamento fine seduta (se applicabile). */
export function resolveMealTimesForNutritionPlanDate(input: {
  routineConfig: Record<string, unknown> | null | undefined;
  planDate: string;
  mealTimesFlatFromRoot: FlatMealTimes;
  plannedSessions: PlannedSessionForRaceDetection[];
  postTrainingToLunchMin?: number;
  weightKg?: number | null;
}): FlatMealTimes {
  const base = mealTimesFromRoutineWeekPlanForDate(input.routineConfig, input.planDate, input.mealTimesFlatFromRoot);

  const racePreLunch = buildRacePreLunchDayContext({
    weightKg: input.weightKg,
    planDate: input.planDate,
    routineConfig: input.routineConfig,
    plannedSessions: input.plannedSessions,
  });
  if (racePreLunch) {
    const mins = parseMealTimesToMinutes(base);
    const lunchMin = parseLocalTimeToMinutes(racePreLunch.lunchTimeLocal) ?? mins.lunch;
    mins.lunch = lunchMin;
    for (let i = 1; i < SLOT_ORDER.length; i++) {
      const k = SLOT_ORDER[i];
      const prev = SLOT_ORDER[i - 1];
      mins[k] = Math.max(mins[k], mins[prev] + MIN_MINUTES_BETWEEN_MEALS);
    }
    return minutesToFlat(mins);
  }

  const rc = input.routineConfig;
  if (!rc) return base;
  const wd = profileWeekDayKeyFromIsoLocal(input.planDate);
  const weekPlan = asRecord(rc.week_plan);
  const day = asRecord(weekPlan[wd]);
  const plannedMins = input.plannedSessions.map((s) => numFromUnknown(s.duration_minutes, 0));
  const end = inferTrainingEndMinutesFromRoutineAndPlanned(day, rc, plannedMins);
  return applyTrainingEndToMealTimes(base, end, { postTrainingToLunchMin: input.postTrainingToLunchMin });
}

/** Digest testuale per `IntelligentMealPlanRequest`: sveglia/sonno + orari pasti (con coerenza fine seduta se note durate). */
export function buildRoutineDigestForMealPlan(
  routine: Record<string, unknown> | null | undefined,
  planDate: string,
  options?: {
    plannedSessions?: PlannedSessionForRaceDetection[];
    weightKg?: number | null;
  },
): string | null {
  if (!routine || typeof routine !== "object") return null;
  const wake = typeof routine.wake_time === "string" ? routine.wake_time : null;
  const sleep = typeof routine.sleep_time === "string" ? routine.sleep_time : null;
  const trainPref = typeof routine.preferred_training_window === "string" ? routine.preferred_training_window : null;
  const bits = [wake && `sveglia ~${wake}`, sleep && `sonno ~${sleep}`, trainPref && `allenamento: ${trainPref}`].filter(
    Boolean,
  ) as string[];

  const mt = asRecord(routine.meal_times);
  const flat: FlatMealTimes = {
    breakfast: String(mt.breakfast ?? "07:30"),
    lunch: String(mt.lunch ?? "13:00"),
    dinner: String(mt.dinner ?? "20:00"),
    snack_am: String(mt.snack_am ?? "10:30"),
    snack_pm: String(mt.snack_pm ?? mt.snacks ?? "16:30"),
  };
  const resolved = resolveMealTimesForNutritionPlanDate({
    routineConfig: routine,
    planDate,
    mealTimesFlatFromRoot: flat,
    plannedSessions: options?.plannedSessions ?? [],
    weightKg: options?.weightKg,
  });
  const racePreLunch = buildRacePreLunchDayContext({
    weightKg: options?.weightKg,
    planDate,
    routineConfig: routine,
    plannedSessions: options?.plannedSessions ?? [],
  });
  const wd = profileWeekDayKeyFromIsoLocal(planDate);
  bits.push(
    `orari pasti (${wd}): colazione ${resolved.breakfast}, spuntino ${resolved.snack_am}, pranzo ${resolved.lunch}, merenda ${resolved.snack_pm}, cena ${resolved.dinner}`,
  );
  if (racePreLunch) {
    bits.push(
      `pre-gara: pranzo ${racePreLunch.lunchTimeLocal} (${racePreLunch.rule.hoursBeforeRace} h prima di ${racePreLunch.raceStartLocal})`,
    );
  }

  return bits.length ? bits.join(" · ") : null;
}

/**
 * Slot snack (snack_am / snack_pm) il cui orario base cade DENTRO la finestra di allenamento
 * (es. long ride 09:00→13:30 sopprime snack_am 10:30). Tali slot vengono soppressi nel piano pasti
 * convenzionale: l’apporto di carburante in seduta è gestito dal modulo `Fueling` (gel/idro/elettroliti),
 * non da uno spuntino extra.
 *
 * Buffer di sicurezza: 15 minuti su ciascun lato della finestra (per evitare di sopprimere uno snack
 * subito prima/dopo). Lunch e dinner non sono mai soppressi qui — il pranzo viene già spostato in avanti
 * dalla `applyTrainingEndToMealTimes`.
 */
export function computeSnackSlotsSuppressedByTrainingWindow(input: {
  routineConfig: Record<string, unknown> | null | undefined;
  planDate: string;
  mealTimesFlatFromRoot: FlatMealTimes;
  plannedSessions: PlannedSessionForRaceDetection[];
  bufferMinutes?: number;
  weightKg?: number | null;
}): MealSlotKey[] {
  if (
    buildRacePreLunchDayContext({
      weightKg: input.weightKg,
      planDate: input.planDate,
      routineConfig: input.routineConfig,
      plannedSessions: input.plannedSessions,
    })
  ) {
    return [];
  }
  const rc = input.routineConfig;
  if (!rc) return [];
  const wd = profileWeekDayKeyFromIsoLocal(input.planDate);
  const weekPlan = asRecord(rc.week_plan);
  const day = asRecord(weekPlan[wd]);
  const plannedMins = input.plannedSessions.map((s) => numFromUnknown(s.duration_minutes, 0));
  const startMin = inferTrainingStartMinutesFromRoutine(day, rc, plannedMins);
  const endMin = inferTrainingEndMinutesFromRoutineAndPlanned(day, rc, plannedMins);
  if (startMin == null || endMin == null) return [];

  /** Allenamenti molto brevi (< 50 min) non sopprimono spuntini: lascia il piano standard. */
  if (endMin - startMin < 50) return [];

  const buf = input.bufferMinutes ?? 15;
  const winStart = startMin - buf;
  const winEnd = endMin + buf;

  const base = mealTimesFromRoutineWeekPlanForDate(input.routineConfig, input.planDate, input.mealTimesFlatFromRoot);
  const out: MealSlotKey[] = [];
  for (const slot of ["snack_am", "snack_pm"] as MealSlotKey[]) {
    const m = parseLocalTimeToMinutes(base[slot] ?? "");
    if (m == null) continue;
    if (m >= winStart && m <= winEnd) out.push(slot);
  }
  return out;
}

/**
 * Slot il cui orario risolto (fine seduta + propagazione) è almeno ~3 min dopo la routine base:
 * il composer favorisce CHO più rapidi / spuntino più “refeed” (stesso criterio per pranzo, cena, spuntini).
 */
export function computePostWorkoutMealFlags(input: {
  routineConfig: Record<string, unknown> | null | undefined;
  planDate: string;
  mealTimesFlatFromRoot: FlatMealTimes;
  plannedSessions: PlannedSessionForRaceDetection[];
  weightKg?: number | null;
}): Partial<Record<MealSlotKey, boolean>> {
  if (
    buildRacePreLunchDayContext({
      weightKg: input.weightKg,
      planDate: input.planDate,
      routineConfig: input.routineConfig,
      plannedSessions: input.plannedSessions,
    })
  ) {
    return {};
  }
  const base = mealTimesFromRoutineWeekPlanForDate(input.routineConfig, input.planDate, input.mealTimesFlatFromRoot);
  const resolved = resolveMealTimesForNutritionPlanDate({
    routineConfig: input.routineConfig,
    planDate: input.planDate,
    mealTimesFlatFromRoot: input.mealTimesFlatFromRoot,
    plannedSessions: input.plannedSessions,
    weightKg: input.weightKg,
  });
  const flags: Partial<Record<MealSlotKey, boolean>> = {};
  for (const slot of MEAL_SLOT_ORDER) {
    const bl = parseLocalTimeToMinutes(base[slot] ?? "");
    const rl = parseLocalTimeToMinutes(resolved[slot] ?? "");
    if (bl == null || rl == null) continue;
    if (rl >= bl + 3) flags[slot] = true;
  }
  return flags;
}
