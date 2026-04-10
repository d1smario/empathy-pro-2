/**
 * Bundle unico: twin atteso vs osservato → guidance → contesto operativo → loop rigenerazione
 * → modulazione bioenergetica → dial nutrizione/fueling (diario reale).
 * Usato da GET /api/nutrition/module e GET /api/dashboard/athlete-hub — stessa verità di V1 GET /api/dashboard.
 */
import { buildAdaptationGuidance } from "@/lib/adaptation/adaptation-guidance";
import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { AthleteMemory } from "@/lib/empathy/schemas/memory";
import { extractDiaryAdaptiveSignals } from "@/lib/nutrition/diary-adaptive-signals";
import {
  buildNutritionPerformanceIntegration,
  type NutritionPerformanceIntegrationDials,
} from "@/lib/nutrition/performance-integration-scaler";
import { resolveLatestRecoverySummary, type RecoverySummary } from "@/lib/reality/recovery-summary";
import { buildBioenergeticModulation, type BioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import { buildTrainingDayOperationalContext, type TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import {
  resolveAdaptationRegenerationLoop,
  type AdaptationRegenerationLoop,
} from "@/lib/training/adaptation-regeneration-loop";

export type OperationalSignalsBundle = {
  adaptationGuidance: AdaptationGuidance;
  operationalContext: TrainingDayOperationalContext | null;
  adaptationLoop: AdaptationRegenerationLoop;
  bioenergeticModulation: BioenergeticModulation | null;
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials;
};

export async function resolveOperationalSignalsBundle(input: {
  athleteId: string;
  athleteMemory: AthleteMemory;
  /** Se già caricato (es. Promise.all del route), evita una seconda lettura recovery. */
  recoverySummary?: RecoverySummary | null;
}): Promise<OperationalSignalsBundle> {
  const { athleteId, athleteMemory } = input;
  const twinState = athleteMemory.twin ?? null;
  const physiologyState = athleteMemory.physiology ?? null;

  const recoverySummary =
    input.recoverySummary !== undefined
      ? input.recoverySummary
      : await resolveLatestRecoverySummary(athleteId).catch(() => null);

  const adaptationGuidance = buildAdaptationGuidance({
    expectedAdaptation: twinState?.expectedAdaptation ?? twinState?.adaptationScore ?? 0,
    observedAdaptation: twinState?.realAdaptation ?? twinState?.adaptationScore ?? 0,
    likelyDrivers: twinState?.likelyDrivers ?? [],
  });

  const operationalContext = buildTrainingDayOperationalContext({
    recoveryStatus: recoverySummary?.status ?? "unknown",
    trafficLight: adaptationGuidance.trafficLight,
    keepProgramUnchanged: adaptationGuidance.keepProgramUnchanged,
    reductionMinPct: adaptationGuidance.reductionMinPct,
    reductionMaxPct: adaptationGuidance.reductionMaxPct,
  });

  const adaptationLoop = await resolveAdaptationRegenerationLoop({
    athleteId,
    twinState,
    recoverySummary,
    operationalContext,
  });

  const bioenergeticModulation =
    physiologyState && twinState
      ? buildBioenergeticModulation({
          physiologyState,
          twinState,
          recoverySummary,
        })
      : null;

  const diarySignals = extractDiaryAdaptiveSignals({
    profile: athleteMemory.profile,
    diaryEntries: athleteMemory.nutrition.diary ?? [],
  });

  const nutritionPerformanceIntegration = buildNutritionPerformanceIntegration({
    bioenergeticModulation,
    adaptationGuidance,
    adaptationLoop: adaptationLoop
      ? { status: adaptationLoop.status, nextAction: adaptationLoop.nextAction }
      : null,
    operationalContext,
    diarySignals,
  });

  return {
    adaptationGuidance,
    operationalContext,
    adaptationLoop,
    bioenergeticModulation,
    nutritionPerformanceIntegration,
  };
}
