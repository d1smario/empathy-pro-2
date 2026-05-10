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
  activitySupportHours,
  hourFromIsoTs,
  mealGlycemicHourWeights24,
  mealInhibitoryHours,
} from "./sim-timeline-v1";
export type {
  NominalCortisolActhModulationV1,
  SimDayKernelV1Input,
  SimGluLacDiurnalModulationV1,
  SimSeriesPointV1,
} from "./day-simulator-v1";
export {
  SIM_LAB_TILE_PARTIAL_SCALE_V1,
  buildNominalCortisolActhHourly24,
  buildSimulatedGluLacDiurnal,
  kernelDayStress01,
  scaleSimulatedLabNumericForSkeletonPartialV1,
  simulatedLabNumeric,
} from "./day-simulator-v1";
export { hourlyFlat24, hourlyRippleRelative, hourlyRippleSeries24 } from "./continuous-monitoring-shape-v1";
export { buildInsulinProxyHourly24 } from "./insulin-proxy-hourly-v1";
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
