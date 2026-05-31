import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedWorkout } from "@empathy/contracts";
import { computeNutritionDailyEnergyModel } from "@/lib/nutrition/daily-energy-solver";
import { defaultFoodDiaryEntryTimeHmsForMealSlot } from "@/lib/nutrition/food-diary-entry-time";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { dedupePlannedWorkoutDbRows } from "@/lib/training/planned/planned-workout-dedupe-fingerprint";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_ORDER } from "@/lib/nutrition/intelligent-meal-plan-types";
import { mealTimesFromRoutineWeekPlanForDate, type FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";

/** Peso kcal per slot (cinque pasti) — allineato al solver nutrizione. */
const SLOT_KCAL_SHARE: Partial<Record<MealSlotKey, number>> = {
  breakfast: 0.22,
  snack_am: 0.08,
  lunch: 0.32,
  snack_pm: 0.08,
  dinner: 0.3,
  snack_evening: 0.033,
};

const DEFAULT_MEAL_TIMES: FlatMealTimes = {
  breakfast: "07:30",
  lunch: "13:00",
  dinner: "20:00",
  snack_am: "10:30",
  snack_pm: "16:30",
};

import type { BioPlannedMealRow, NutritionPlanDayContext } from "@/lib/bioenergetics/nutrition-plan-day-empty";
export type { BioPlannedMealRow, NutritionPlanDayContext } from "@/lib/bioenergetics/nutrition-plan-day-empty";
export { EMPTY_NUTRITION_PLAN_DAY } from "@/lib/bioenergetics/nutrition-plan-day-empty";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return 0;
}

function mealTimeHms(slot: MealSlotKey, times: FlatMealTimes): string {
  const raw =
    slot === "breakfast"
      ? times.breakfast
      : slot === "lunch"
        ? times.lunch
        : slot === "dinner"
          ? times.dinner
          : slot === "snack_am"
            ? times.snack_am
            : times.snack_pm;
  const hm = raw.trim().slice(0, 5);
  if (/^\d{1,2}:\d{2}$/.test(hm)) {
    const [h, m] = hm.split(":").map((x) => Number(x));
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }
  return defaultFoodDiaryEntryTimeHmsForMealSlot(slot === "snack_am" || slot === "snack_pm" ? "snack" : slot);
}

function distributeMeals(
  date: string,
  carbsG: number,
  kcal: number,
  times: FlatMealTimes,
): BioPlannedMealRow[] {
  const totalK = Math.max(0, kcal);
  const totalC = Math.max(0, carbsG);
  const out: BioPlannedMealRow[] = [];
  for (const slot of MEAL_SLOT_ORDER) {
    const share = SLOT_KCAL_SHARE[slot] ?? 0;
    const slotKcal = Math.round(totalK * share);
    const slotCarbs = Math.round(totalC * share);
    const slotProtein = Math.round((slotKcal * 0.22) / 4);
    const slotFat = Math.round((slotKcal * 0.26) / 9);
    const giLoad = Math.max(0, Math.round(slotCarbs * 0.72));
    out.push({
      slot,
      entry_time: `${date}T${mealTimeHms(slot, times)}`,
      food_label: `Piano · ${slot}`,
      carbs_g: slotCarbs,
      protein_g: slotProtein,
      fat_g: slotFat,
      kcal: slotKcal,
      insulin_load: Math.round(giLoad * 0.85 * 10) / 10,
      glycemic_load: giLoad,
    });
  }
  return out;
}

/**
 * Pasti previsti per la giornata: `nutrition_plans` esplicito, altrimenti macro da solver training (stesso contratto `/api/nutrition`).
 */
export async function loadNutritionPlanDayContext(
  db: SupabaseClient,
  athleteId: string,
  date: string,
  plannedWorkouts: PlannedWorkout[],
): Promise<NutritionPlanDayContext> {
  const dateKey = date.slice(0, 10);
  const [planRes, profileRes] = await Promise.all([
    db
      .from("nutrition_plans")
      .select("date, kcal_target, carbs_g_target, proteins_g_target, fats_g_target")
      .eq("athlete_id", athleteId)
      .eq("date", dateKey)
      .maybeSingle(),
    db.from("athlete_profiles").select("birth_date, sex, height_cm, weight_kg, body_fat_pct, routine_config, nutrition_config").eq("id", athleteId).maybeSingle(),
  ]);

  const routineConfig = asRecord(profileRes.data?.routine_config);
  const nutritionConfig = asRecord(profileRes.data?.nutrition_config);
  const flatMt = asRecord(routineConfig.meal_times);
  const flatFromRoot: FlatMealTimes = {
    breakfast: String(flatMt.breakfast ?? DEFAULT_MEAL_TIMES.breakfast),
    lunch: String(flatMt.lunch ?? DEFAULT_MEAL_TIMES.lunch),
    dinner: String(flatMt.dinner ?? DEFAULT_MEAL_TIMES.dinner),
    snack_am: String(flatMt.snack_am ?? flatMt.snack ?? DEFAULT_MEAL_TIMES.snack_am),
    snack_pm: String(flatMt.snack_pm ?? flatMt.afternoon_snack ?? DEFAULT_MEAL_TIMES.snack_pm),
  };
  const mealTimes = mealTimesFromRoutineWeekPlanForDate(routineConfig, dateKey, flatFromRoot);

  const explicit = planRes.data as Record<string, unknown> | null;
  const explicitKcal = explicit != null ? num(explicit.kcal_target) : 0;
  if (explicit && explicitKcal > 0) {
    const carbsG = num(explicit.carbs_g_target);
    const plannedMeals = distributeMeals(dateKey, carbsG, explicitKcal, mealTimes);
    return {
      planSource: "nutrition_plans",
      dailyCarbsG: carbsG,
      dailyKcal: explicitKcal,
      plannedMeals,
    };
  }

  if (plannedWorkouts.length > 0) {
    const profile = profileRes.data as Record<string, unknown> | null;
    const memory = await resolveAthleteMemorySlice(athleteId, { slice: "nutrition" }).catch(() => null);
    const athleteFtpW = memory?.physiology?.physiologicalProfile?.ftpWatts ?? null;
    const dedupedPlanned = dedupePlannedWorkoutDbRows(
      plannedWorkouts.map((p) => ({
        id: String((p as { id?: string }).id ?? ""),
        date: dateKey,
        type: String((p as { type?: string }).type ?? "session"),
        duration_minutes: Number((p as { durationMinutes?: number }).durationMinutes ?? 0),
        tss_target: Number((p as { tssTarget?: number }).tssTarget ?? 0),
        kcal_target: (p as { kcalTarget?: number | null }).kcalTarget ?? null,
        notes: (p as { notes?: string | null }).notes ?? null,
      })),
    );
    const plannedTraining = dedupedPlanned.map((p) => {
      const notes = (p as { notes?: string | null }).notes ?? null;
      const builderSession = parsePro2BuilderSessionFromNotes(notes);
      const m = resolvePlannedSessionMetrics({
        contract: builderSession,
        durationMinutesDb: Number(p.duration_minutes) || 0,
        tssTargetDb: Number(p.tss_target) || 0,
        kcalTargetDb: Number(p.kcal_target) || 0,
        athleteFtpWatts: athleteFtpW,
      });
      return {
        durationMinutes: m.durationMinutes,
        tssTarget: m.tss > 0 ? m.tss : undefined,
        kcalTarget: m.kcal > 0 ? m.kcal : undefined,
        avgPowerW: builderSession?.summary?.avgPowerW ?? null,
      };
    });
    const model = computeNutritionDailyEnergyModel({
      athleteId,
      date: dateKey,
      birthDate: typeof profile?.birth_date === "string" ? profile.birth_date : null,
      sex: typeof profile?.sex === "string" ? profile.sex : null,
      heightCm: num(profile?.height_cm) || null,
      weightKg: num(profile?.weight_kg) || null,
      bodyFatPct: num(profile?.body_fat_pct) || null,
      ftpWatts: athleteFtpW,
      vo2maxMlMinKg: null,
      lifestyleActivityClass: "moderate",
      plannedTraining,
      recoveryStatus: "unknown",
    });
    const mealBudget = Math.max(0, Math.round(model.totals.mealsKcal));
    const carbsG = Math.round((mealBudget * 0.52) / 4);
    const plannedMeals = distributeMeals(dateKey, carbsG, mealBudget, mealTimes);
    return {
      planSource: "calendar_training_solver",
      dailyCarbsG: carbsG,
      dailyKcal: Math.max(0, Math.round(model.totals.dailyKcal)),
      plannedMeals,
    };
  }

  void nutritionConfig;
  return { planSource: "none", dailyCarbsG: 0, dailyKcal: 0, plannedMeals: [] };
}
