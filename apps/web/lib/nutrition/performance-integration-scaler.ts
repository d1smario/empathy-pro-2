import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import type { BioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import type { DiaryAdaptiveSignals } from "@/lib/nutrition/diary-adaptive-signals";

type LoopPick = {
  status: "aligned" | "watch" | "regenerate";
  nextAction: string;
} | null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Deterministic dials that connect physiology/twin/bioenergetic signals to nutrition and fueling
 * targets. Does not replace engines; amplifies or tempers planned training energy and CHO delivery.
 */
export type NutritionPerformanceIntegrationDials = {
  /** Scales planned training kcal contribution into daily totals (0.82–1.02). */
  trainingEnergyScale: number;
  /** Share of training kcal allocated to meals vs fueling window (base 0.4 → meals get BMR+lifestyle+this*trainingKcal). */
  mealTrainingFraction: number;
  /** Multiplier on intra CHO/h after evidence clamp (0.82–1.12). */
  fuelingChoScale: number;
  /** Added to protein % of meal macros, subtracted from fat (0–6). */
  proteinBiasPctPoints: number;
  /** Multiplier on baseline hydration floor (1.0–1.12). */
  hydrationFloorMultiplier: number;
  /** Scales session fluid ml/h hint (1.0–1.08). */
  sessionFluidMultiplier: number;
  rationale: string[];
  /** Null when no diary in window; otherwise real intake vs rough maintenance (audit). */
  diaryInsight: Pick<
    DiaryAdaptiveSignals,
    | "windowDays"
    | "loggedDays"
    | "avgDailyKcal"
    | "energyAdequacyRatio"
    | "proteinGPerKg"
    | "carbsGPerKg"
    | "estimatedMaintenanceKcal"
    | "confidence"
  > | null;
};

export function buildNutritionPerformanceIntegration(input: {
  bioenergeticModulation: BioenergeticModulation | null;
  adaptationGuidance: AdaptationGuidance;
  adaptationLoop: LoopPick;
  operationalContext: TrainingDayOperationalContext | null;
  diarySignals?: DiaryAdaptiveSignals | null;
}): NutritionPerformanceIntegrationDials {
  const rationale: string[] = [];
  const bio = input.bioenergeticModulation;
  const diary = input.diarySignals ?? null;
  const diaryInsight = diary
    ? {
        windowDays: diary.windowDays,
        loggedDays: diary.loggedDays,
        avgDailyKcal: diary.avgDailyKcal,
        energyAdequacyRatio: diary.energyAdequacyRatio,
        proteinGPerKg: diary.proteinGPerKg,
        carbsGPerKg: diary.carbsGPerKg,
        estimatedMaintenanceKcal: diary.estimatedMaintenanceKcal,
        confidence: diary.confidence,
      }
    : null;
  const loadScale = bio?.loadScale ?? 1;
  const mito = bio?.mitochondrialReadinessScore ?? 72;
  const fuel = bio?.fuelAvailabilityScore ?? 65;
  const tl = input.adaptationGuidance.trafficLight;
  const loop = input.adaptationLoop;
  const protectiveOp = input.operationalContext?.mode === "protective";

  let trainingEnergyScale = loadScale;

  if (diary && diary.loggedDays >= 2 && diary.energyAdequacyRatio != null) {
    const ratio = diary.energyAdequacyRatio;
    if (ratio < 0.76) {
      trainingEnergyScale *= 0.93;
      rationale.push(
        "Diario alimentare: apporto energetico medio basso vs fabbisogno stimato — scala energia training e priorità recupero.",
      );
    } else if (ratio < 0.86) {
      trainingEnergyScale *= 0.965;
      rationale.push("Diario alimentare: energia sotto il fabbisogno stimato — modulazione conservativa sul contributo training.");
    } else if (ratio > 1.12 && tl === "green" && (loop?.status === "aligned" || !loop)) {
      trainingEnergyScale *= 1.012;
      rationale.push("Diario alimentare: surplus energetico rispetto al fabbisogno stimato con adattamento verde — margine leggero su carico metabolico.");
    }
  } else if (diary && diary.loggedDays === 1) {
    rationale.push("Diario: un solo giorno con voci nel periodo — uso segnali con cautela.");
  }

  if (diary?.proteinGPerKg != null && diary.proteinGPerKg < 1.15 && diary.loggedDays >= 2) {
    rationale.push("Diario: proteine medie sotto ~1,2 g/kg — bias proteico pasti rafforzato.");
  }

  if (tl === "yellow") {
    trainingEnergyScale *= 0.97;
    rationale.push("Adattamento giallo: energia da training nel piano giornaliero leggermente ridotta.");
  } else if (tl === "red") {
    trainingEnergyScale *= 0.91;
    rationale.push("Adattamento rosso: energia da training ridotta per priorità recupero e allineamento.");
  }
  if (loop?.status === "regenerate") {
    trainingEnergyScale *= 0.96;
    rationale.push("Loop rigenerazione: ulteriore cautela sul carico energetico atteso dalla seduta.");
  } else if (loop?.status === "watch") {
    trainingEnergyScale *= 0.985;
  }
  if (protectiveOp) {
    trainingEnergyScale *= 0.97;
    rationale.push("Contesto operativo protettivo: coerenza con scaling carico lato training.");
  }
  trainingEnergyScale = round(clamp(trainingEnergyScale, 0.82, 1.02), 3);
  if (!rationale.length) {
    rationale.push("Segnali allineati: scala energetica training vicina al neutro.");
  }

  let mealTrainingFraction = 0.4;
  if (bio?.state === "protective" || mito < 50 || fuel < 42) {
    mealTrainingFraction = 0.48;
    rationale.push("Maggiore quota pasti rispetto al fueling intra: stabilità glicemica e carico intestinale.");
  } else if (bio?.state === "watch") {
    mealTrainingFraction = 0.44;
  }

  let fuelingChoScale = 1;
  if (fuel < 45 && mito >= 48) {
    fuelingChoScale = 1.06;
    rationale.push("Disponibilità substrati bassa: leggero incremento CHO/h intra (entro evidenza).");
  } else if (mito >= 72 && tl === "green" && loop?.status === "aligned") {
    fuelingChoScale = 1.03;
    rationale.push("Readiness favorevole: margine controllato su oxidazione exogena.");
  }
  if (bio?.state === "protective" || mito < 45) {
    fuelingChoScale = Math.min(fuelingChoScale, 0.92);
    rationale.push("Modulazione protettiva: riduzione CHO/h intra per ridurre stress gastro-metabolico.");
  }
  fuelingChoScale = round(clamp(fuelingChoScale, 0.82, 1.12), 3);

  let proteinBiasPctPoints = 0;
  if (tl === "red" || loop?.status === "regenerate") {
    proteinBiasPctPoints = 4;
    rationale.push("Bias proteico pasti +4% (da grassi): supporto ripresa e sintesi.");
  } else if (tl === "yellow" || bio?.state === "watch") {
    proteinBiasPctPoints = 2;
  }
  if (diary?.proteinGPerKg != null && diary.proteinGPerKg < 1.15 && diary.loggedDays >= 2) {
    proteinBiasPctPoints += 2;
  }

  let hydrationFloorMultiplier = 1;
  let sessionFluidMultiplier = 1;
  if (bio?.state !== "supported" || tl !== "green") {
    hydrationFloorMultiplier = round(clamp(1.04 + (1 - loadScale) * 0.15, 1.02, 1.12), 3);
    sessionFluidMultiplier = round(clamp(1.02 + (1 - loadScale) * 0.12, 1, 1.08), 3);
    rationale.push("Idratazione: incremento pavimento giornaliero e fluido/ora seduta per stress termico/metabolico.");
  }

  return {
    trainingEnergyScale,
    mealTrainingFraction,
    fuelingChoScale,
    proteinBiasPctPoints,
    hydrationFloorMultiplier,
    sessionFluidMultiplier,
    rationale,
    diaryInsight,
  };
}
