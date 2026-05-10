/** Bioenergetics as dominant modulating layer (see CONSTITUTION.md). */
import type { BioenergeticProfile, InternalLoadState } from "@empathy/contracts";

export {
  averagePowerWattsFromKjAndDuration,
  kilojoulesFromKcal,
  tssPlanExecutionRatio,
} from "./session-workload-adherence";

export { SIM_BANK_VERSION, SIM_DIURNAL_GLUCOSE_V1, SIM_DIURNAL_LACTATE_V1, SIM_PATHWAY_SCALE_V1, SIM_STRESS_V1 } from "./sim-bank-v1";
export type { SimTimelineEventV1 } from "./sim-timeline-v1";
export { activitySupportHours, hourFromIsoTs, mealInhibitoryHours } from "./sim-timeline-v1";
export type { SimDayKernelV1Input, SimSeriesPointV1 } from "./day-simulator-v1";
export { buildNominalCortisolActhHourly24, buildSimulatedGluLacDiurnal, simulatedLabNumeric } from "./day-simulator-v1";
export { hourlyFlat24, hourlyRippleRelative, hourlyRippleSeries24 } from "./continuous-monitoring-shape-v1";

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
