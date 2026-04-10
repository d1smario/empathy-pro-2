import type { AdaptationGuidance } from "@/lib/empathy/schemas";

/**
 * Confronto atteso vs osservato (twin / dashboard): scorePct = (osservato/atteso)*100 se atteso > 0.
 * Semaforo e fasce di riduzione volume (proxy TSS/durata in operational context + guardrail pianificato):
 * - verde 75–100%: programma invariato
 * - giallo 50–75%: riduzione carico 30–50%
 * - rosso <50%: riduzione carico 50–75%
 */
const SCORE_GREEN_MIN = 75;
const SCORE_YELLOW_MIN = 50;

const REDUCTION_YELLOW_MIN_PCT = 30;
const REDUCTION_YELLOW_MAX_PCT = 50;
const REDUCTION_RED_MIN_PCT = 50;
const REDUCTION_RED_MAX_PCT = 75;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildAdaptationGuidance(input: {
  expectedAdaptation?: number | null;
  observedAdaptation?: number | null;
  likelyDrivers?: string[] | null;
}): AdaptationGuidance {
  const expected = Math.max(0, Number(input.expectedAdaptation ?? 0));
  const observed = Math.max(0, Number(input.observedAdaptation ?? 0));
  const scorePct =
    expected > 0
      ? round(clamp((observed / expected) * 100, 0, 100))
      : round(clamp(observed, 0, 100));

  if (scorePct >= SCORE_GREEN_MIN) {
    return {
      scorePct,
      trafficLight: "green",
      expectedAdaptation: round(expected),
      observedAdaptation: round(observed),
      reductionMinPct: 0,
      reductionMaxPct: 0,
      keepProgramUnchanged: true,
      guidance: "Adattamento in linea con l'atteso (≥75% del rapporto osservato/atteso). Mantieni il programma invariato.",
      likelyDrivers: input.likelyDrivers ?? [],
    };
  }

  if (scorePct >= SCORE_YELLOW_MIN) {
    return {
      scorePct,
      trafficLight: "yellow",
      expectedAdaptation: round(expected),
      observedAdaptation: round(observed),
      reductionMinPct: REDUCTION_YELLOW_MIN_PCT,
      reductionMaxPct: REDUCTION_YELLOW_MAX_PCT,
      keepProgramUnchanged: false,
      guidance:
        "Semaforo giallo: adattamento osservato tra il 50% e il 75% dell'atteso. Riduci il volume del 30-50% e riallinea training, nutrition e fueling.",
      likelyDrivers: input.likelyDrivers ?? [],
    };
  }

  return {
    scorePct,
    trafficLight: "red",
    expectedAdaptation: round(expected),
    observedAdaptation: round(observed),
    reductionMinPct: REDUCTION_RED_MIN_PCT,
    reductionMaxPct: REDUCTION_RED_MAX_PCT,
    keepProgramUnchanged: false,
    guidance:
      "Semaforo rosso: adattamento osservato sotto il 50% dell'atteso. Riduci il volume del 50-75% e priorita' a recupero e carico protettivo.",
    likelyDrivers: input.likelyDrivers ?? [],
  };
}
