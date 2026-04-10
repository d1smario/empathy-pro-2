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
  /** Scales planned training kcal in fabbisogno giornaliero: bioenergetica × carico operativo (recovery+adattamento), tipicamente 0.35–1.02. */
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
  const bioScale = bio?.loadScale ?? 1;
  const opScale = input.operationalContext?.loadScale ?? 1;
  /** Stesso principio del motore training: scala combinata recovery+adattamento × modulazione bioenergetica. */
  const combinedLoad = round(clamp(bioScale * opScale, 0.35, 1.02), 4);
  const mito = bio?.mitochondrialReadinessScore ?? 72;
  const fuel = bio?.fuelAvailabilityScore ?? 65;
  const tl = input.adaptationGuidance.trafficLight;
  const loop = input.adaptationLoop;
  const opMode = input.operationalContext?.mode;

  if (opScale < 0.999) {
    rationale.push(
      "Carico operativo training <100% (recovery + adattamento a fasce): energia da seduta nel fabbisogno scalata in parallelo al piano training.",
    );
  }

  let trainingEnergyScale = combinedLoad;

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

  /* Semaforo e fasce min–max sono già in operationalContext.loadScale: non moltiplicare di nuovo qui. */
  if (loop?.status === "regenerate") {
    trainingEnergyScale *= 0.96;
    rationale.push("Loop rigenerazione (pianificato vs eseguito / twin): ulteriore cautela sul carico energetico atteso dalla seduta.");
  } else if (loop?.status === "watch") {
    trainingEnergyScale *= 0.985;
    rationale.push("Loop in osservazione: leggera riduzione del contributo energetico training nel giorno.");
  }
  trainingEnergyScale = round(clamp(trainingEnergyScale, 0.35, 1.02), 3);
  if (!rationale.length) {
    rationale.push("Segnali allineati: scala energetica training vicina al neutro.");
  }

  let mealTrainingFraction = 0.4;
  if (bio?.state === "protective" || mito < 50 || fuel < 42 || opMode === "protective") {
    mealTrainingFraction = 0.48;
    rationale.push("Maggiore quota pasti rispetto al fueling intra: stabilità glicemica e carico intestinale.");
  } else if (bio?.state === "watch" || opMode === "cautious") {
    mealTrainingFraction = 0.44;
    rationale.push("Modalità cauta: più energia ancorata ai pasti rispetto alla finestra intra per coerenza col carico ridotto.");
  }

  let fuelingChoScale = 1;
  if (fuel < 45 && mito >= 48) {
    fuelingChoScale = 1.06;
    rationale.push("Disponibilità substrati bassa: leggero incremento CHO/h intra (entro evidenza).");
  } else if (mito >= 72 && tl === "green" && loop?.status === "aligned" && combinedLoad >= 0.92) {
    fuelingChoScale = 1.03;
    rationale.push("Readiness favorevole: margine controllato su oxidazione exogena.");
  }
  if (bio?.state === "protective" || mito < 45) {
    fuelingChoScale = Math.min(fuelingChoScale, 0.92);
    rationale.push("Modulazione protettiva: riduzione CHO/h intra per ridurre stress gastro-metabolico.");
  }
  if (combinedLoad < 0.85) {
    fuelingChoScale = Math.min(fuelingChoScale, 0.94);
    rationale.push("Volume operativo seduta ridotto: CHO/h intra temperati in linea con meno costo energetico atteso.");
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
  const stressHydration =
    combinedLoad < 0.92 ||
    bio?.state !== "supported" ||
    tl !== "green" ||
    opMode === "protective" ||
    opMode === "cautious";
  if (stressHydration) {
    hydrationFloorMultiplier = round(clamp(1.04 + (1 - combinedLoad) * 0.15, 1.02, 1.12), 3);
    sessionFluidMultiplier = round(clamp(1.02 + (1 - combinedLoad) * 0.12, 1, 1.08), 3);
    rationale.push("Idratazione: pavimento giornaliero e fluido/ora seduta modulati su carico combinato e stress metabolico.");
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
