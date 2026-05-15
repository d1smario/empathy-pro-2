import type { TwinState } from "@/lib/empathy/schemas";

/**
 * Valori per guidance / API: una sola priorità così non si mischiano
 * expected/real con il composito per errore quando i campi twin sono parziali.
 */
export function twinExpectedAdaptationForGuidance(twin: TwinState | null | undefined): number {
  const e = twin?.expectedAdaptation;
  if (typeof e === "number" && Number.isFinite(e)) return e;
  const legacy = twin?.adaptationScore;
  if (typeof legacy === "number" && Number.isFinite(legacy)) return legacy;
  return 0;
}

export function twinObservedAdaptationForGuidance(twin: TwinState | null | undefined): number {
  const r = twin?.realAdaptation;
  if (typeof r === "number" && Number.isFinite(r)) return r;
  const v1 = twin?.adaptationScoreV1?.compositeScore;
  if (typeof v1 === "number" && Number.isFinite(v1)) return v1;
  const legacy = twin?.adaptationScore;
  if (typeof legacy === "number" && Number.isFinite(legacy)) return legacy;
  return 0;
}
