import type {
  TrainingAnalyticsAdaptationSummaryViewModel,
  TrainingTwinContextStripViewModel,
} from "@/api/training/contracts";
import type { TwinState } from "@/lib/empathy/schemas";

/** Strip twin per API (stessa forma usata da planned-window e analytics). */
export function twinContextStripFromMemory(twin: TwinState | null): TrainingTwinContextStripViewModel | null {
  if (!twin) return null;
  const v1 = twin.adaptationScoreV1;
  return {
    asOf: typeof twin.asOf === "string" && twin.asOf.trim() !== "" ? twin.asOf : null,
    readiness: typeof twin.readiness === "number" && Number.isFinite(twin.readiness) ? twin.readiness : null,
    fatigueAcute: typeof twin.fatigueAcute === "number" && Number.isFinite(twin.fatigueAcute) ? twin.fatigueAcute : null,
    glycogenStatus: typeof twin.glycogenStatus === "number" && Number.isFinite(twin.glycogenStatus) ? twin.glycogenStatus : null,
    adaptationScore: typeof twin.adaptationScore === "number" && Number.isFinite(twin.adaptationScore) ? twin.adaptationScore : null,
    recoveryDataTier: twin.recoveryDataTier ?? null,
    adaptationScoreV1:
      v1 &&
      typeof v1.methodVersion === "string" &&
      typeof v1.compositeScore === "number" &&
      typeof v1.confidence === "number"
        ? {
            methodVersion: v1.methodVersion,
            compositeScore: v1.compositeScore,
            confidence: v1.confidence,
          }
        : null,
  };
}

/** Campi twin essenziali per JSON analytics (evita di dipendere solo da twinState completo). */
export function twinAdaptationSummaryFromTwin(
  twin: TwinState | null,
): TrainingAnalyticsAdaptationSummaryViewModel | null {
  const strip = twinContextStripFromMemory(twin);
  if (!strip) return null;
  return {
    asOf: strip.asOf,
    recoveryDataTier: strip.recoveryDataTier,
    adaptationScoreV1: strip.adaptationScoreV1,
    adaptationScore: strip.adaptationScore,
  };
}
