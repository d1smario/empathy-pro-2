import type { PlannedWorkoutDbRow } from "@empathy/domain-training";
import type { NutritionDailyEnergyModel } from "@/lib/empathy/schemas";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";
import { computeNutritionDailyEnergyModel, normalizeLifestyleActivityClass } from "@/lib/nutrition/daily-energy-solver";
import type { NutritionModuleFlatProfile } from "@/lib/nutrition/nutrition-module-profile-merge";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
import { resolveNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Single source: stesso solver del client, input da GET /api/nutrition/module. */
export function buildNutritionModuleDailyEnergyModel(input: {
  athleteId: string;
  planDate: string;
  profile: NutritionModuleFlatProfile | null;
  physiologyFtp: number | null;
  physiologyVo2: number | null;
  plannedRowsForDay: PlannedWorkoutDbRow[];
  recoverySummary: RecoverySummary | null;
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials | null;
}): NutritionDailyEnergyModel | null {
  if (!input.profile) return null;
  const routine = record(input.profile.routine_config);
  const dietDay = resolveNutritionDietDay(input.profile.nutrition_config, input.planDate, {
    preferredMealCount: input.profile.preferred_meal_count ?? null,
  });
  const ftp = input.physiologyFtp;
  const plannedTraining = input.plannedRowsForDay.map((row) => {
    const bs = parsePro2BuilderSessionFromNotes(row.notes ?? null);
    const m = resolvePlannedSessionMetrics({
      contract: bs,
      durationMinutesDb: Number(row.duration_minutes) || 0,
      tssTargetDb: Number(row.tss_target) || 0,
      kcalTargetDb: Number(row.kcal_target) || 0,
      athleteFtpWatts: ftp,
    });
    return {
      durationMinutes: m.durationMinutes,
      kcalTarget: m.kcal,
      tssTarget: m.tss,
      avgPowerW: m.avgPowerW,
    };
  });

  return computeNutritionDailyEnergyModel({
    athleteId: input.athleteId,
    date: input.planDate,
    birthDate: input.profile.birth_date ?? null,
    sex: input.profile.sex ?? null,
    heightCm: input.profile.height_cm ?? null,
    weightKg: input.profile.weight_kg ?? null,
    bodyFatPct: input.profile.body_fat_pct ?? null,
    muscleMassKg: input.profile.muscle_mass_kg ?? null,
    ftpWatts: ftp,
    vo2maxMlMinKg: input.physiologyVo2,
    lifestyleActivityClass:
      input.profile.lifestyle_activity_class ??
      normalizeLifestyleActivityClass(routine.lifestyle_activity_class as string | null | undefined),
    recoveryStatus: input.recoverySummary?.status ?? "unknown",
    recoverySleepHours: input.recoverySummary?.sleepDurationHours ?? null,
    recoveryHrvMs: input.recoverySummary?.hrvMs ?? null,
    recoveryStrainScore: input.recoverySummary?.strainScore ?? null,
    plannedTraining,
    performanceIntegration: input.nutritionPerformanceIntegration,
    dietDayMealsScalePct: dietDay.dayTypePct,
  });
}
