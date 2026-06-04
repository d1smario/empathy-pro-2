import type { NutritionDailyEnergyModel } from "@/lib/empathy/schemas";
import {
  computeNutritionDailyEnergyModel,
  normalizeLifestyleActivityClass,
} from "@/lib/nutrition/daily-energy-solver";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";

type PlannedTrainingEnergyInput = {
  durationMinutes: number;
  kcal: number;
  tss: number;
  avgPowerW: number | null;
};

export type ResolveNutritionDayModelInput = {
  athleteId: string;
  selectedPlanDate: string;
  serverDailyEnergyModel: NutritionDailyEnergyModel | null;
  serverDailyEnergyDate: string | null;
  profile: {
    birth_date?: string | null;
    sex?: string | null;
    height_cm?: number | null;
    weight_kg?: number | null;
    body_fat_pct?: number | null;
    muscle_mass_kg?: number | null;
    lifestyle_activity_class?: string | null;
    routine_config?: unknown;
  } | null;
  physio: { ftp_watts?: number | null; vo2max_ml_min_kg?: number | null } | null;
  plannedTraining: PlannedTrainingEnergyInput[];
  recoverySummary: {
    status?: string;
    sleepDurationHours?: number | null;
    hrvMs?: number | null;
    strainScore?: number | null;
  } | null;
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials | null;
  dietDayMealsScalePct: number;
};

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function buildClientNutritionDayModel(input: ResolveNutritionDayModelInput): NutritionDailyEnergyModel | null {
  if (!input.profile) return null;
  const routine = record(input.profile.routine_config);
  return computeNutritionDailyEnergyModel({
    athleteId: input.athleteId,
    date: input.selectedPlanDate,
    birthDate: input.profile.birth_date ?? null,
    sex: input.profile.sex ?? null,
    heightCm: input.profile.height_cm ?? null,
    weightKg: input.profile.weight_kg ?? null,
    bodyFatPct: input.profile.body_fat_pct ?? null,
    muscleMassKg: input.profile.muscle_mass_kg ?? null,
    ftpWatts: input.physio?.ftp_watts ?? null,
    vo2maxMlMinKg: input.physio?.vo2max_ml_min_kg ?? null,
    lifestyleActivityClass:
      input.profile.lifestyle_activity_class ??
      normalizeLifestyleActivityClass(routine.lifestyle_activity_class as string | null | undefined),
    recoveryStatus: (input.recoverySummary?.status as "good" | "moderate" | "poor" | "unknown") ?? "unknown",
    recoverySleepHours: input.recoverySummary?.sleepDurationHours ?? null,
    recoveryHrvMs: input.recoverySummary?.hrvMs ?? null,
    recoveryStrainScore: input.recoverySummary?.strainScore ?? null,
    plannedTraining: input.plannedTraining.map((s) => ({
      durationMinutes: s.durationMinutes,
      kcalTarget: s.kcal,
      tssTarget: s.tss,
      avgPowerW: s.avgPowerW,
    })),
    performanceIntegration: input.nutritionPerformanceIntegration,
    dietDayMealsScalePct: input.dietDayMealsScalePct,
  });
}

/**
 * Server-first daily energy; fallback client solver se module API non ha ancora risposto.
 * Se il server sottostima il training (es. kcal_target null senza bridge TSS) ma il calendario
 * client ha TSS/durata, resta il modello client per evitare flicker meal plan.
 */
export function resolveNutritionDayModel(input: ResolveNutritionDayModelInput): NutritionDailyEnergyModel | null {
  const clientModel = buildClientNutritionDayModel(input);
  if (
    input.serverDailyEnergyModel &&
    input.serverDailyEnergyDate === input.selectedPlanDate
  ) {
    const server = input.serverDailyEnergyModel;
    const clientTrain = clientModel?.training.kcal ?? 0;
    const serverTrain = server.training.kcal;
    const plannedTss = input.plannedTraining.reduce((s, row) => s + Math.max(0, row.tss), 0);
    const plannedDuration = input.plannedTraining.reduce((s, row) => s + Math.max(0, row.durationMinutes), 0);
    const serverUnderReportsTraining =
      plannedDuration > 0 &&
      plannedTss > 0 &&
      serverTrain + 80 < clientTrain;
    if (serverUnderReportsTraining && clientModel) {
      return clientModel;
    }
    return server;
  }
  return clientModel;
}
