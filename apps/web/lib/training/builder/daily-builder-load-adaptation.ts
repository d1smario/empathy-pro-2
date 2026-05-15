import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { BioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import type { AdaptationRegenerationLoop } from "@/lib/training/adaptation-regeneration-loop";

export type DailyBuilderLoadDirection = "hold" | "reduce" | "increase";

export type DailyBuilderLoadAdaptation = {
  loadScale: number;
  loadScalePct: number;
  /** Variazione rispetto al piano VIRYA/builder (es. -30 = riduci 30%). */
  adjustmentPct: number;
  direction: DailyBuilderLoadDirection;
  scorePct: number;
  trafficLight: AdaptationGuidance["trafficLight"];
  unwantedSupercompensation: boolean;
  headline: string;
  guidance: string;
  reasons: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function detectUnwantedSupercompensation(input: {
  adaptationGuidance: AdaptationGuidance;
  operationalContext: TrainingDayOperationalContext;
  adaptationLoop: Pick<
    AdaptationRegenerationLoop,
    "status" | "executionDeltaTss" | "divergenceScore" | "executionCompliancePct"
  > | null;
  recoveryStatus?: "good" | "moderate" | "poor" | "unknown" | null;
}): boolean {
  const loop = input.adaptationLoop;
  const recoveryPoor = input.recoveryStatus === "poor";
  const executedAbovePlan = (loop?.executionDeltaTss ?? 0) > 12;
  const highDivergence = (loop?.divergenceScore ?? 0) >= 16;
  const lowCompliance = (loop?.executionCompliancePct ?? 100) < 88;
  const protective = input.operationalContext.mode === "protective";

  if (protective && executedAbovePlan) return true;
  if (recoveryPoor && executedAbovePlan) return true;
  if (highDivergence && input.adaptationGuidance.scorePct >= 70 && recoveryPoor) return true;
  if (loop?.status === "regenerate" && !lowCompliance) return true;
  if (
    input.adaptationGuidance.trafficLight === "green" &&
    protective &&
    (loop?.executionDeltaTss ?? 0) > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Scala bidirezionale (35–108%) dal punteggio giornaliero atteso/osservato + recovery + bioenergetica.
 * VIRYA resta guida strutturale; questa funzione modula solo il carico della seduta builder.
 */
export function resolveDailyBuilderLoadAdaptation(input: {
  adaptationGuidance: AdaptationGuidance;
  operationalContext: TrainingDayOperationalContext;
  bioenergeticModulation: BioenergeticModulation | null;
  adaptationLoop?: Pick<
    AdaptationRegenerationLoop,
    "status" | "executionDeltaTss" | "divergenceScore" | "executionCompliancePct"
  > | null;
  recoveryStatus?: "good" | "moderate" | "poor" | "unknown" | null;
}): DailyBuilderLoadAdaptation {
  const scorePct = input.adaptationGuidance.scorePct;
  const unwantedSupercompensation = detectUnwantedSupercompensation({
    adaptationGuidance: input.adaptationGuidance,
    operationalContext: input.operationalContext,
    adaptationLoop: input.adaptationLoop ?? null,
    recoveryStatus: input.recoveryStatus ?? null,
  });

  const reasons: string[] = [];
  let targetScale = 1;

  if (unwantedSupercompensation) {
    targetScale = clamp(0.52 + (scorePct / 100) * 0.28, 0.35, 0.82);
    reasons.push("supercompensazione_non_voluta");
  } else if (scorePct >= 98 && input.operationalContext.mode === "normal") {
    const bioOk =
      !input.bioenergeticModulation ||
      input.bioenergeticModulation.state === "supported" ||
      input.bioenergeticModulation.loadScale >= 0.94;
    if (bioOk && input.recoveryStatus !== "poor") {
      targetScale = clamp(1 + (scorePct - 98) * 0.005, 1, 1.08);
      if (targetScale > 1) reasons.push("risposta_sopra_atteso_controllata");
    }
  } else if (scorePct >= 75) {
    targetScale = 1;
  } else if (scorePct >= 50) {
    const t = (75 - scorePct) / 25;
    const reduction =
      input.adaptationGuidance.reductionMinPct +
      (input.adaptationGuidance.reductionMaxPct - input.adaptationGuidance.reductionMinPct) * t;
    targetScale = 1 - reduction / 100;
    reasons.push("semaforo_giallo");
  } else {
    const reduction =
      (input.adaptationGuidance.reductionMinPct + input.adaptationGuidance.reductionMaxPct) / 2;
    targetScale = 1 - reduction / 100;
    reasons.push("semaforo_rosso");
  }

  const opBio = clamp(
    input.operationalContext.loadScale * (input.bioenergeticModulation?.loadScale ?? 1),
    0.35,
    1.08,
  );

  let loadScale = targetScale;
  if (unwantedSupercompensation || targetScale < 1) {
    loadScale = Math.min(targetScale, opBio);
  } else if (targetScale > 1) {
    loadScale = targetScale;
  } else {
    loadScale = Math.min(1, opBio);
  }

  loadScale = round(clamp(loadScale, 0.35, 1.08), 2);
  const loadScalePct = Math.round(loadScale * 100);
  const adjustmentPct = Math.round((loadScale - 1) * 100);
  const direction: DailyBuilderLoadDirection =
    adjustmentPct > 1 ? "increase" : adjustmentPct < -1 ? "reduce" : "hold";

  const headline =
    unwantedSupercompensation
      ? "Riduzione per carico esterno vs recupero interno"
      : direction === "increase"
        ? "Margine per intensificare la seduta"
        : direction === "reduce"
          ? input.operationalContext.headline
          : "Carico in linea con il giorno";

  const guidanceParts = [
    input.adaptationGuidance.guidance,
    unwantedSupercompensation
      ? "Risposta fisiologica non sta assorbendo il carico recente: riduci la seduta rispetto al piano VIRYA."
      : null,
    direction === "increase"
      ? `Score giornaliero ${scorePct}%: puoi portare la seduta a ~${loadScalePct}% del target pianificato.`
      : direction === "reduce"
        ? `Score giornaliero ${scorePct}%: porta la seduta a ~${loadScalePct}% del target pianificato.`
        : `Score giornaliero ${scorePct}%: mantieni il target pianificato.`,
    input.bioenergeticModulation?.headline ? `Bio: ${input.bioenergeticModulation.headline}` : null,
  ].filter(Boolean);

  return {
    loadScale,
    loadScalePct,
    adjustmentPct,
    direction,
    scorePct,
    trafficLight: input.adaptationGuidance.trafficLight,
    unwantedSupercompensation,
    headline,
    guidance: guidanceParts.join(" "),
    reasons,
  };
}

export function scalePlannedWorkoutTargets(input: {
  durationMinutes: number;
  tssTarget: number;
  loadAdaptation: DailyBuilderLoadAdaptation;
}): { durationMinutes: number; tssTarget: number } {
  const durationMinutes = Math.max(
    15,
    Math.round(Math.max(0, input.durationMinutes) * input.loadAdaptation.loadScale),
  );
  const tssTarget = Math.max(1, Math.round(Math.max(0, input.tssTarget) * input.loadAdaptation.loadScale));
  return { durationMinutes, tssTarget };
}
