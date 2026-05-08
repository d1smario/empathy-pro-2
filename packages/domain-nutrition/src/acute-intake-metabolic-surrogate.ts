import type { AcuteMealMetabolicEstimate } from "@empathy/contracts";
import { EVIDENCE_PROFILE_V1, type ActivityState, type EvidenceProfileV1 } from "./evidence-profiles-v1";

type BuildAcuteMealMetabolicEstimateInput = {
  athleteId: string;
  carbsIngestedG: number;
  activityState: ActivityState;
  mealSlot?: AcuteMealMetabolicEstimate["context"]["mealSlot"];
  baselineGlucoseMmol?: number | null;
  intakeAt?: string | null;
  gutStressScorePct?: number | null;
  evidenceProfile?: EvidenceProfileV1;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildAcuteMealMetabolicEstimate(
  input: BuildAcuteMealMetabolicEstimateInput,
): AcuteMealMetabolicEstimate {
  const profile = input.evidenceProfile ?? EVIDENCE_PROFILE_V1;
  const carbs = clamp(Number(input.carbsIngestedG) || 0, 0, 250);
  const activityParams = profile.activityStates[input.activityState];
  const baseline = clamp(input.baselineGlucoseMmol ?? profile.defaultBaselineGlucoseMmol, 3.6, 8.5);
  const mealSlot = input.mealSlot ?? "other";
  const gutStressPct = clamp(input.gutStressScorePct ?? 0, 0, 100);

  const rawExcursion = carbs * profile.perGramGlucoseExcursionMmol;
  const excursionCenter =
    rawExcursion * activityParams.glucoseExcursionMultiplier * (1 + (gutStressPct / 100) * profile.gutStressExcursionFactor);
  const excursionBandRadius = Math.max(0.12, excursionCenter * profile.baseBandPct);
  const glucoseExcursionBand = {
    low: round(clamp(excursionCenter - excursionBandRadius, 0.1, 20), 2),
    high: round(clamp(excursionCenter + excursionBandRadius, 0.2, 24), 2),
  };
  const peakBand = {
    low: round(clamp(baseline + glucoseExcursionBand.low, baseline + 0.1, 22), 2),
    high: round(clamp(baseline + glucoseExcursionBand.high, baseline + 0.2, 24), 2),
  };

  const insulinProxy = clamp(
    activityParams.insulinDemandBase + carbs * profile.perGramInsulinDemand * activityParams.insulinDemandMultiplier,
    0.25,
    1.95,
  );
  const hpaProxy = clamp(
    activityParams.hpaDriveBase + carbs * profile.perGramHpaDrive * activityParams.hpaDriveMultiplier,
    0.2,
    1.8,
  );
  const gutStressAdjustment = round(clamp(1 + (gutStressPct / 100) * 0.35, 1, 1.35), 3);

  const confidence: AcuteMealMetabolicEstimate["confidence"] =
    carbs >= 30 && carbs <= 90 ? "high" : carbs >= 15 ? "moderate" : "low";

  const rationale = [
    `Surrogate v1: ${carbs}g CHO, stato attività ${input.activityState}.`,
    `Profilo evidenza ${profile.id} (${profile.summary}).`,
    `Escursione glicemica stimata più contenuta in attività e maggiore a riposo; output in banda con incertezza.`,
  ];

  return {
    athleteId: input.athleteId,
    algorithmVersion: "acute_metabolic_surrogate_v1",
    generatedAt: new Date().toISOString(),
    context: {
      intakeAt: input.intakeAt ?? null,
      activityState: input.activityState,
      carbsIngestedG: carbs,
      mealSlot,
      baselineGlucoseMmol: round(baseline, 2),
    },
    estimates: {
      glucoseExcursionMmolBand: glucoseExcursionBand,
      peakGlucoseMmolBand: peakBand,
      insulinDemandProxyRelative: round(insulinProxy, 3),
      hpaDriveProxyRelative: round(hpaProxy, 3),
      gutStressAdjustment,
    },
    confidence,
    evidenceProfileId: profile.id,
    rationale,
  };
}
