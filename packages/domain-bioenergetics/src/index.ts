/** Bioenergetics as dominant modulating layer (see CONSTITUTION.md). */
import type { BioenergeticProfile, InternalLoadState } from "@empathy/contracts";

export {
  averagePowerWattsFromKjAndDuration,
  kilojoulesFromKcal,
  tssPlanExecutionRatio,
} from "./session-workload-adherence";

export {
  SIM_BANK_VERSION,
  SIM_CORTISOL_MEAL_MOD_V1,
  SIM_DIURNAL_GLUCOSE_V1,
  SIM_DIURNAL_LACTATE_V1,
  SIM_PATHWAY_SCALE_V1,
  SIM_STRESS_V1,
} from "./sim-bank-v1";
export type { SimTimelineEventV1 } from "./sim-timeline-v1";
export {
  activityStepIntensity01V2,
  activitySupportHours,
  hourFromIsoTs,
  mealGlycemicHourWeights24,
  mealGlycemicStepImpulseV2,
  mealInhibitoryHours,
  mealPostprandialDecayWeightsForGi,
  minutesFromMidnightLocalTs,
} from "./sim-timeline-v1";
export type {
  NominalCortisolActhModulationV1,
  SimDayKernelV1Input,
  SimGluLacDiurnalModulationV1,
  SimSeriesPointV1,
  GlucoseStimulusLiteratureManifestEntryV1,
  GlucoseStimulusPriorTopicV1,
  LactateStimulusLiteratureManifestEntryV1,
  LactateStimulusPriorTopicV1,
} from "./day-simulator-v1";
export type { CgmSurfaceKernelV1Input, CgmSurfaceSeriesPointV1, CgmSurfaceRealismClamp } from "./cgm-surface-realism-v1";
export { applyCgmLikeSurfaceToSubhourlyGluLac } from "./cgm-surface-realism-v1";
export {
  SIM_DIURNAL_SUBHOURLY_SOURCE_PREFIX,
  GLUCOSE_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  GLUCOSE_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  LACTATE_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  LACTATE_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  PRED_GLUCOSE_STIMULI_LITERATURE_MANIFEST_V1,
  PRED_LACTATE_STIMULI_LITERATURE_MANIFEST_V1,
  SIM_LAB_TILE_PARTIAL_SCALE_V1,
  buildGlucoseStimulusPredictorSubhourlyV1,
  buildLactateStimulusPredictorSubhourlyV1,
  buildNominalCortisolActhHourly24,
  buildNominalThyroidTshFt4Hourly24,
  buildNominalGhGhrelinHourly24,
  buildNominalIgf1LeptinHourly24,
  buildSimulatedGluLacDiurnal,
  buildSimulatedGluLacDiurnalSubHourly,
  glucoseStimulusPredictorSourceV1,
  lactateStimulusPredictorSourceV1,
  kernelDayStress01,
  scaleSimulatedLabNumericForSkeletonPartialV1,
  simulatedLabNumeric,
} from "./day-simulator-v1";
export { hourlyFlat24, hourlyRippleRelative, hourlyRippleSeries24 } from "./continuous-monitoring-shape-v1";
export {
  INSULIN_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  INSULIN_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  PRED_INSULIN_STIMULI_LITERATURE_MANIFEST_V1,
  buildInsulinProxyHourly24,
  buildInsulinStimulusPredictorSubhourlyV1,
  insulinStimulusPredictorSourceV1,
} from "./insulin-proxy-hourly-v1";
export type {
  InsulinProxySeriesPointV1,
  InsulinStimulusLiteratureManifestEntryV1,
  InsulinStimulusPriorTopicV1,
} from "./insulin-proxy-hourly-v1";
export { synthesizeEvidenceConditionedLayerV1 } from "./evidence-conditioned-synthesizer-v1";
export type { EvidenceConditionedSynthesisInputV1, EvidenceConditionedSynthesisOutputV1 } from "./evidence-conditioned-synthesizer-v1";
export { analyzeBioenergeticBiaLiteratureV1, resolveEcwTbwRatio } from "./bia-literature-model-v1";
export type { AnalyzeBioenergeticBiaLiteratureInputV1 } from "./bia-literature-model-v1";
export {
  arbitrateGlucoseCurveFusionV1,
  arbitrateInsulinProxyCurveFusionV1,
  arbitrateLabHoldHormoneCurveFusionV1,
  arbitrateLactateCurveFusionV1,
  arbitrateNominalHormoneCurveFusionV1,
  computeInternalContextRichness01,
  countTimelineMealsWithMacroSignalsV1,
  simBlendDeterministicWeightFromRichness01,
} from "./curve-fusion-arbitration-v1";
export type { ArbitrationTimelineEventV1 } from "./curve-fusion-arbitration-v1";
export { mergeHourlyBioenergeticCurvesV1 } from "./numeric-curve-fusion-hourly-v1";
export {
  METABOLIC_ENDOCRINE_INTERACTION_CONTRACT_VERSION,
  METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1,
  buildMetabolicEndocrineInteractionReportV1,
  estimateLongestInterMealGapHours,
} from "./metabolic-endocrine-interaction-skeleton-v1";
export type {
  MetabolicDayCoherenceSnapshotV1,
  MetabolicEndocrineEdgeV1,
  MetabolicEndocrineInteractionReportV1,
  MetabolicLabSomatoaxisSnapshotV1,
  MetabolicNodeCoherenceV1,
  MetabolicSleepContextSnapshotV1,
} from "./metabolic-endocrine-interaction-skeleton-v1";

export const DOMAIN = "@empathy/domain-bioenergetics" as const;
export const DOMAIN_TITLE = "Bioenergetics";
export const DOMAIN_SUMMARY =
  "Profilo bioenergetico e stato di carico interno (canali, divergenza attesa/osservata) — tipi da @empathy/contracts.";

export type { BioenergeticProfile, InternalLoadState };

const BIO_KEYS: (keyof BioenergeticProfile)[] = [
  "phaseAngleScore",
  "cellIntegrity",
  "mitochondrialEfficiency",
  "hydrationStatus",
  "inflammationProxy",
];

/** Chiavi numeriche valorizzate nel profilo (ispezione pura, niente scoring clinico). */
export function listDefinedBioenergeticNumericKeys(profile: BioenergeticProfile): string[] {
  return BIO_KEYS.filter((k) => typeof profile[k] === "number").map(String);
}
