import type {
  LifestyleActivityClass,
  NutritionBmrMethod,
  NutritionDailyEnergyModel,
} from "@/lib/empathy/schemas";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";

type PlannedTrainingEnergyInput = {
  durationMinutes?: number | null;
  kcalTarget?: number | null;
  tssTarget?: number | null;
  avgPowerW?: number | null;
};

type NutritionDailyEnergySolverInput = {
  athleteId: string;
  date: string;
  birthDate?: string | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  ftpWatts?: number | null;
  vo2maxMlMinKg?: number | null;
  lifestyleActivityClass?: LifestyleActivityClass | string | null;
  plannedTraining?: PlannedTrainingEnergyInput[];
  recoveryStatus?: "good" | "moderate" | "poor" | "unknown" | null;
  recoverySleepHours?: number | null;
  recoveryHrvMs?: number | null;
  recoveryStrainScore?: number | null;
  /** When set, scales training-derived energy, meal/fueling split, and intra CHO/h deterministically. */
  performanceIntegration?: NutritionPerformanceIntegrationDials | null;
};

const LIFESTYLE_PCT: Record<LifestyleActivityClass, number> = {
  sedentary: 0.15,
  moderate: 0.2,
  active: 0.3,
  very_active: 0.4,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Coerces finite numbers from JSON/DB (PostgREST numeric columns may arrive as strings). */
function asFinite(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function deriveAgeYears(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function normalizeLifestyleActivityClass(
  value?: LifestyleActivityClass | string | null,
): LifestyleActivityClass {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "sedentary") return "sedentary";
  if (normalized === "moderate") return "moderate";
  if (normalized === "active") return "active";
  if (normalized === "very_active" || normalized === "very active") return "very_active";
  return "moderate";
}

function computeLeanMassKg(input: {
  weightKg?: number | null;
  bodyFatPct?: number | null;
}): number | null {
  const weightKg = asFinite(input.weightKg);
  const bodyFatPct = asFinite(input.bodyFatPct);
  if (weightKg == null || bodyFatPct == null) return null;
  return round(weightKg * (1 - clamp(bodyFatPct, 0, 70) / 100), 1);
}

function computeMifflinStJeor(input: {
  sex?: string | null;
  ageYears?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
}): number | null {
  const ageYears = asFinite(input.ageYears);
  const heightCm = asFinite(input.heightCm);
  const weightKg = asFinite(input.weightKg);
  if (ageYears == null || heightCm == null || weightKg == null) return null;
  const sex = String(input.sex ?? "").toLowerCase();
  const sexOffset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset;
}

function computeWeightProxyBmr(weightKg?: number | null): number | null {
  const weight = asFinite(weightKg);
  if (weight == null) return null;
  // Conservative fallback only when body-composition or full anthropometry is missing.
  return weight * 22;
}

function deriveAthleteCalibrationPct(input: {
  vo2maxMlMinKg?: number | null;
  ftpWatts?: number | null;
  weightKg?: number | null;
}): number {
  const vo2max = asFinite(input.vo2maxMlMinKg);
  const ftpWatts = asFinite(input.ftpWatts);
  const weightKg = asFinite(input.weightKg);
  const ftpWKg = ftpWatts != null && weightKg != null && weightKg > 0 ? ftpWatts / weightKg : null;
  const vo2Score = vo2max != null ? clamp((vo2max - 45) / 25, 0, 1) : 0;
  const ftpScore = ftpWKg != null ? clamp((ftpWKg - 3.2) / 1.8, 0, 1) : 0;
  return round(clamp(vo2Score * 0.03 + ftpScore * 0.02, 0, 0.05), 3);
}

function deriveBmr(input: NutritionDailyEnergySolverInput): {
  bmrKcal: number;
  bmrMethod: NutritionBmrMethod;
  leanMassKg: number | null;
  ageYears: number | null;
  ftpWKg: number | null;
  notes: string[];
} {
  const notes: string[] = [];
  const ageYears = deriveAgeYears(input.birthDate);
  const weightKg = asFinite(input.weightKg);
  const leanMassKg = computeLeanMassKg({
    weightKg,
    bodyFatPct: input.bodyFatPct,
  });
  const ftpWKg =
    input.ftpWatts != null && weightKg != null && weightKg > 0
      ? round(input.ftpWatts / weightKg, 2)
      : null;

  if (leanMassKg != null) {
    notes.push("BMR anchored to Cunningham using fat-free mass.");
    return {
      bmrKcal: round(500 + 22 * leanMassKg),
      bmrMethod: "cunningham_ffm",
      leanMassKg,
      ageYears,
      ftpWKg,
      notes,
    };
  }

  const mifflin = computeMifflinStJeor({
    sex: input.sex,
    ageYears,
    heightCm: input.heightCm,
    weightKg,
  });
  if (mifflin != null) {
    const athleteCalibrationPct = deriveAthleteCalibrationPct(input);
    if (athleteCalibrationPct > 0) {
      notes.push("BMR calibrated upward from Mifflin using athlete aerobic phenotype proxies.");
    } else {
      notes.push("BMR derived from Mifflin-St Jeor fallback due to missing body-fat data.");
    }
    return {
      bmrKcal: round(mifflin * (1 + athleteCalibrationPct)),
      bmrMethod: "mifflin_st_jeor",
      leanMassKg,
      ageYears,
      ftpWKg,
      notes,
    };
  }

  const proxy = computeWeightProxyBmr(weightKg);
  notes.push("BMR derived from weight-only fallback because composition and full anthropometry are incomplete.");
  return {
    bmrKcal: round(proxy ?? 0),
    bmrMethod: "weight_proxy",
    leanMassKg,
    ageYears,
    ftpWKg,
    notes,
  };
}

function deriveTrainingSummary(plannedTraining: PlannedTrainingEnergyInput[] = []) {
  const sessions = plannedTraining.filter((session) => {
    const duration = asFinite(session.durationMinutes) ?? 0;
    const kcal = asFinite(session.kcalTarget) ?? 0;
    const tss = asFinite(session.tssTarget) ?? 0;
    return duration > 0 || kcal > 0 || tss > 0;
  });
  const durationMin = round(
    sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.durationMinutes) ?? 0), 0),
  );
  const kcal = round(
    sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.kcalTarget) ?? 0), 0),
  );
  const totalTss = sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.tssTarget) ?? 0), 0);
  const totalWeightedPower = sessions.reduce((sum, session) => {
    const avgPowerW = asFinite(session.avgPowerW);
    const durationMinutes = Math.max(0, asFinite(session.durationMinutes) ?? 0);
    return sum + (avgPowerW != null ? avgPowerW * Math.max(1, durationMinutes) : 0);
  }, 0);
  const totalPowerMinutes = sessions.reduce((sum, session) => {
    const avgPowerW = asFinite(session.avgPowerW);
    const durationMinutes = Math.max(0, asFinite(session.durationMinutes) ?? 0);
    return sum + (avgPowerW != null ? Math.max(1, durationMinutes) : 0);
  }, 0);
  const hours = durationMin > 0 ? durationMin / 60 : 0;
  const avgIntensityPctFtp =
    hours > 0 ? round(clamp(Math.sqrt(Math.max(0, totalTss / hours) / 100) * 100, 45, 120), 1) : null;
  return {
    sessionsCount: sessions.length,
    durationMin,
    kcal,
    avgIntensityPctFtp,
    avgPowerW: totalPowerMinutes > 0 ? round(totalWeightedPower / totalPowerMinutes) : null,
  };
}

function deriveEvidenceChoRange(input: {
  durationMin: number;
  avgIntensityPctFtp?: number | null;
  estimatedAvgPowerW?: number | null;
  ftpWKg?: number | null;
  vo2maxMlMinKg?: number | null;
}) {
  const duration = Math.max(0, input.durationMin);
  const intensity = asFinite(input.avgIntensityPctFtp) ?? 70;
  const avgPower = asFinite(input.estimatedAvgPowerW) ?? 0;
  const ftpWKg = asFinite(input.ftpWKg) ?? 0;
  const vo2max = asFinite(input.vo2maxMlMinKg) ?? 0;

  if (duration >= 60 && avgPower >= 300 && (ftpWKg >= 4.8 || vo2max >= 68)) {
    return { tier: "elite" as const, min: 100, target: 120, max: 130 };
  }
  if (duration >= 75 && (avgPower >= 250 || ftpWKg >= 4.2 || vo2max >= 60)) {
    return { tier: "high" as const, min: 90, target: 100, max: 110 };
  }
  if (duration < 45) {
    return { tier: "base" as const, min: 0, target: 15, max: 30 };
  }
  if (duration < 120) {
    return intensity >= 85
      ? { tier: "base" as const, min: 30, target: 50, max: 60 }
      : { tier: "base" as const, min: 20, target: 40, max: 50 };
  }
  if (duration < 180) {
    return intensity >= 85
      ? { tier: "base" as const, min: 50, target: 70, max: 90 }
      : { tier: "base" as const, min: 40, target: 60, max: 75 };
  }
  return intensity >= 85
    ? { tier: "base" as const, min: 60, target: 90, max: 90 }
    : { tier: "base" as const, min: 50, target: 75, max: 90 };
}

export function computeNutritionDailyEnergyModel(
  input: NutritionDailyEnergySolverInput,
): NutritionDailyEnergyModel {
  const bmr = deriveBmr(input);
  const lifestyleClass = normalizeLifestyleActivityClass(input.lifestyleActivityClass);
  const lifestylePct = LIFESTYLE_PCT[lifestyleClass];
  const lifestyleKcal = round(bmr.bmrKcal * lifestylePct);
  const training = deriveTrainingSummary(input.plannedTraining);
  const integration = input.performanceIntegration ?? null;
  const trainingEnergyScale = integration?.trainingEnergyScale ?? 1;
  const mealTrainingFraction = integration?.mealTrainingFraction ?? 0.4;
  const fuelingChoScale = integration?.fuelingChoScale ?? 1;
  const trainingKcalScaled = round(training.kcal * trainingEnergyScale);
  const estimatedAvgPowerW = training.avgPowerW != null
    ? training.avgPowerW
    : input.ftpWatts != null && training.avgIntensityPctFtp != null
      ? round(input.ftpWatts * (training.avgIntensityPctFtp / 100))
      : null;

  const totalDailyKcal = round(bmr.bmrKcal + lifestyleKcal + trainingKcalScaled);
  const mealsKcal = round(bmr.bmrKcal + lifestyleKcal + trainingKcalScaled * mealTrainingFraction);
  const fuelingKcal = round(trainingKcalScaled * (1 - mealTrainingFraction));
  const recoveryStatus = input.recoveryStatus ?? "unknown";
  const split =
    recoveryStatus === "poor"
      ? { pre: 0.08, intra: 0.4, post: 0.12 }
      : recoveryStatus === "moderate"
        ? { pre: 0.06, intra: 0.44, post: 0.1 }
        : { pre: 0.05, intra: 0.45, post: 0.1 };
  const preKcal = round(trainingKcalScaled * split.pre);
  const intraKcal = round(trainingKcalScaled * split.intra);
  const postKcal = round(trainingKcalScaled * split.post);
  const preChoG = round(preKcal / 4, 1);
  const intraChoG = round(intraKcal / 4, 1);
  const postChoG = round(postKcal / 4, 1);
  const hours = training.durationMin > 0 ? training.durationMin / 60 : 0;
  const energyDrivenChoGPerHour = hours > 0 ? round(intraChoG / hours, 1) : 0;
  const evidenceRange = deriveEvidenceChoRange({
    durationMin: training.durationMin,
    avgIntensityPctFtp: training.avgIntensityPctFtp,
    estimatedAvgPowerW,
    ftpWKg: bmr.ftpWKg,
    vo2maxMlMinKg: input.vo2maxMlMinKg,
  });
  let adjustedChoGPerHour =
    hours > 0
      ? round(
          recoveryStatus === "poor"
            ? clamp(energyDrivenChoGPerHour, evidenceRange.min, evidenceRange.target)
            : recoveryStatus === "moderate"
              ? clamp(energyDrivenChoGPerHour, evidenceRange.min, Math.min(evidenceRange.max, evidenceRange.target + 5))
              : clamp(energyDrivenChoGPerHour, evidenceRange.min, evidenceRange.max),
          1,
        )
      : 0;
  if (hours > 0 && fuelingChoScale !== 1) {
    adjustedChoGPerHour = round(
      clamp(adjustedChoGPerHour * fuelingChoScale, evidenceRange.min, evidenceRange.max),
      1,
    );
  }

  const notes = [...bmr.notes];
  notes.push(
    "Daily total = BMR + lifestyle load + planned training cost.",
    "Meals cover BMR + lifestyle load + 40% of planned training energy.",
    "Fueling covers the remaining 60% of planned training energy split as 5% pre, 45% intra, 10% post.",
    "Evidence layer constrains intra-workout CHO/h independently from raw calorie math.",
  );
  if (recoveryStatus === "moderate") {
    notes.push("Recovery-aware solver active: moderate recovery shifts more energy toward pre/post support and slightly tempers intra CHO aggressiveness.");
  }
  if (recoveryStatus === "poor") {
    notes.push("Recovery-aware solver active: poor recovery protects the day by simplifying intra CHO delivery and reinforcing pre/post support.");
  }
  if (input.recoverySleepHours != null) {
    notes.push(`Recovery feed detected: sleep ${round(input.recoverySleepHours, 1)} h.`);
  }
  if (input.recoveryHrvMs != null) {
    notes.push(`Recovery feed detected: HRV ${round(input.recoveryHrvMs)} ms.`);
  }
  if (input.recoveryStrainScore != null) {
    notes.push(`Recovery feed detected: strain ${round(input.recoveryStrainScore)}.`);
  }
  if (evidenceRange.tier === "high") {
    notes.push("High-capacity athlete tier enabled: intra-workout CHO can scale into the 90-110 g/h band.");
  }
  if (evidenceRange.tier === "elite") {
    notes.push("Elite fueling tier enabled: sustained high-power sessions can scale into the 120-130 g/h band.");
  }
  if (integration) {
    notes.push(
      `Integrazione performance: scala energia training ×${trainingEnergyScale}, quota pasti sul training ${Math.round(mealTrainingFraction * 100)}%, CHO/h ×${fuelingChoScale}.`,
    );
    notes.push(...integration.rationale);
  }

  return {
    athleteId: input.athleteId,
    date: input.date,
    algorithmVersion: "v1",
    bmrMethod: bmr.bmrMethod,
    bmrKcal: bmr.bmrKcal,
    leanMassKg: bmr.leanMassKg,
    ageYears: bmr.ageYears,
    ftpWKg: bmr.ftpWKg,
    vo2maxMlMinKg: asFinite(input.vo2maxMlMinKg),
    lifestyle: {
      activityClass: lifestyleClass,
      pct: lifestylePct,
      kcal: lifestyleKcal,
    },
    training: {
      ...training,
      kcal: trainingKcalScaled,
      estimatedAvgPowerW,
    },
    totals: {
      dailyKcal: totalDailyKcal,
      mealsKcal,
      fuelingKcal,
    },
    fueling: {
      capabilityTier: evidenceRange.tier,
      preKcal,
      intraKcal,
      postKcal,
      preChoG,
      intraChoG,
      postChoG,
      evidenceMinChoGPerHour: evidenceRange.min,
      evidenceTargetChoGPerHour: evidenceRange.target,
      evidenceMaxChoGPerHour: evidenceRange.max,
      energyDrivenChoGPerHour,
      adjustedChoGPerHour,
    },
    performanceIntegration: integration
      ? {
          trainingEnergyScale: integration.trainingEnergyScale,
          mealTrainingFraction: integration.mealTrainingFraction,
          fuelingChoScale: integration.fuelingChoScale,
          proteinBiasPctPoints: integration.proteinBiasPctPoints,
          hydrationFloorMultiplier: integration.hydrationFloorMultiplier,
          sessionFluidMultiplier: integration.sessionFluidMultiplier,
          rationale: integration.rationale,
          ...(integration.diaryInsight != null ? { diaryInsight: integration.diaryInsight } : {}),
        }
      : undefined,
    notes,
  };
}
