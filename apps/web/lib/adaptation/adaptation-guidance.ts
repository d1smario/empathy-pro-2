import type { AdaptationGuidance } from "@/lib/empathy/schemas";

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

  if (scorePct >= 80) {
    return {
      scorePct,
      trafficLight: "green",
      expectedAdaptation: round(expected),
      observedAdaptation: round(observed),
      reductionMinPct: 0,
      reductionMaxPct: 0,
      keepProgramUnchanged: true,
      guidance: "Adattamento in linea con l'atteso. Mantieni il programma invariato.",
      likelyDrivers: input.likelyDrivers ?? [],
    };
  }

  if (scorePct >= 50) {
    return {
      scorePct,
      trafficLight: "yellow",
      expectedAdaptation: round(expected),
      observedAdaptation: round(observed),
      reductionMinPct: 15,
      reductionMaxPct: 20,
      keepProgramUnchanged: false,
      guidance:
        "Semaforo giallo: riduci il carico del 15-20% e riallinea di conseguenza training, nutrition e fueling.",
      likelyDrivers: input.likelyDrivers ?? [],
    };
  }

  return {
    scorePct,
    trafficLight: "red",
    expectedAdaptation: round(expected),
    observedAdaptation: round(observed),
    reductionMinPct: 50,
    reductionMaxPct: 70,
    keepProgramUnchanged: false,
    guidance:
      "Semaforo rosso: riduci il carico del 50-70% e porta il sistema in modalita' protettiva/adattiva.",
    likelyDrivers: input.likelyDrivers ?? [],
  };
}
