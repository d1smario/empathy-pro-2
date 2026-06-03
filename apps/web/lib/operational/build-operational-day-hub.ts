import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedWorkoutDbRow } from "@empathy/domain-training";
import type { NutritionDailyEnergyModel } from "@/lib/empathy/schemas";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import {
  analyzePlannedSessionsForFueling,
  type PlannedFuelingSessionAnalysis,
} from "@/lib/nutrition/fueling-planned-session-analysis";
import { buildNutritionModuleDailyEnergyModel } from "@/lib/nutrition/nutrition-module-daily-energy";
import {
  mergeNutritionModuleProfileWithAthleteProfileRow,
  type NutritionModuleFlatProfile,
} from "@/lib/nutrition/nutrition-module-profile-merge";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import { firstWindowQueryError, queryPlannedExecutedWindow } from "@/lib/training/planned-executed-window-query";

export type OperationalDayHubPayload = {
  ok: true;
  athleteId: string;
  date: string;
  profile: NutritionModuleFlatProfile | null;
  physio: {
    athlete_id: string;
    ftp_watts: number | null;
    vo2max_ml_min_kg: number | null;
  };
  planned: PlannedWorkoutDbRow[];
  executed: unknown[];
  dailyEnergyModel: NutritionDailyEnergyModel | null;
  fuelingSessions: PlannedFuelingSessionAnalysis[];
  error: null;
};

export async function buildOperationalDayHub(input: {
  db: SupabaseClient;
  athleteId: string;
  date: string;
}): Promise<OperationalDayHubPayload | { ok: false; error: string }> {
  const { db, athleteId, date } = input;

  const [athleteMemory, trainingWindow, recoverySummary, profileAnthroRes] = await Promise.all([
    resolveAthleteMemorySlice(athleteId, { slice: "nutrition" }),
    queryPlannedExecutedWindow(db, athleteId, date, date, undefined, {
      includeTraceSummary: false,
    }),
    resolveLatestRecoverySummary(athleteId),
    db
      .from("athlete_profiles")
      .select(
        "birth_date, sex, height_cm, weight_kg, body_fat_pct, muscle_mass_kg, nutrition_config, routine_config, preferred_meal_count",
      )
      .eq("id", athleteId)
      .maybeSingle(),
  ]);

  const plannedRes = trainingWindow.planned;
  const execRes = trainingWindow.executed;
  const windowError = firstWindowQueryError(plannedRes, execRes);
  if (windowError) {
    return { ok: false, error: windowError };
  }

  const profileFromMemory: NutritionModuleFlatProfile | null = athleteMemory.profile
    ? {
        id: athleteMemory.profile.id,
        birth_date: athleteMemory.profile.birthDate ?? null,
        sex: athleteMemory.profile.sex ?? null,
        diet_type: athleteMemory.profile.dietType ?? null,
        intolerances: athleteMemory.profile.intolerances ?? null,
        allergies: athleteMemory.profile.allergies ?? null,
        food_preferences: athleteMemory.profile.foodPreferences ?? null,
        food_exclusions: athleteMemory.profile.foodExclusions ?? null,
        supplements: athleteMemory.profile.supplements ?? null,
        height_cm: athleteMemory.profile.heightCm ?? null,
        weight_kg: athleteMemory.profile.weightKg ?? null,
        body_fat_pct: athleteMemory.profile.bodyFatPct ?? null,
        muscle_mass_kg: athleteMemory.profile.muscleMassKg ?? null,
        lifestyle_activity_class: athleteMemory.profile.lifestyleActivityClass ?? null,
        routine_config: athleteMemory.profile.routineConfig ?? null,
        nutrition_config: athleteMemory.profile.nutritionConfig ?? null,
        supplement_config: athleteMemory.profile.supplementConfig ?? null,
        preferred_meal_count: athleteMemory.profile.preferredMealCount ?? null,
      }
    : null;

  const profileAnthroRow: Record<string, unknown> | null = profileAnthroRes.error
    ? null
    : ((profileAnthroRes.data ?? null) as Record<string, unknown> | null);

  const profile = mergeNutritionModuleProfileWithAthleteProfileRow(
    athleteId,
    profileFromMemory,
    profileAnthroRow && typeof profileAnthroRow === "object" && !Array.isArray(profileAnthroRow)
      ? (profileAnthroRow as Record<string, unknown>)
      : null,
  );

  const physiologyState = athleteMemory.physiology;
  const plannedRowsForDay = (plannedRes.data ?? []) as PlannedWorkoutDbRow[];
  const weightKg = profile?.weight_kg ?? 72;
  const ftpWatts = physiologyState?.physiologicalProfile.ftpWatts ?? 200;

  const dailyEnergyModel = buildNutritionModuleDailyEnergyModel({
    athleteId,
    planDate: date,
    profile,
    physiologyFtp: physiologyState?.physiologicalProfile.ftpWatts ?? null,
    physiologyVo2: physiologyState?.physiologicalProfile.vo2maxMlMinKg ?? null,
    plannedRowsForDay,
    recoverySummary,
    nutritionPerformanceIntegration: null,
  });

  const fuelingSessions = analyzePlannedSessionsForFueling({
    sessions: plannedRowsForDay.map((row) => {
      const bs = parsePro2BuilderSessionFromNotes(row.notes ?? null);
      return {
        id: row.id,
        title: String(bs?.sessionName ?? bs?.discipline ?? row.type ?? "Sessione"),
        durationMinutesDb: Number(row.duration_minutes) || null,
        tssTargetDb: Number(row.tss_target) || null,
        kcalTargetDb: row.kcal_target != null ? Number(row.kcal_target) || null : null,
        builderSession: bs,
      };
    }),
    weightKg: typeof weightKg === "number" ? weightKg : 72,
    ftpWatts: typeof ftpWatts === "number" ? ftpWatts : 200,
    physiology: physiologyState,
    choIngestedGH: 0,
  });

  return {
    ok: true,
    athleteId,
    date,
    profile,
    physio: {
      athlete_id: athleteId,
      ftp_watts: physiologyState?.physiologicalProfile.ftpWatts ?? null,
      vo2max_ml_min_kg: physiologyState?.physiologicalProfile.vo2maxMlMinKg ?? null,
    },
    planned: plannedRowsForDay,
    executed: execRes.data ?? [],
    dailyEnergyModel,
    fuelingSessions,
    error: null,
  };
}
