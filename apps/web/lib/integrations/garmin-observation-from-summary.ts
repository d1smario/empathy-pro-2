import "server-only";

import type { ObservationDomain } from "@/lib/empathy/schemas";

type FieldRule = { keys: string[]; domain: ObservationDomain };

/**
 * Euristiche su chiavi tipiche Garmin Health / Activity summary (camelCase).
 * Estendere leggendo le specifiche ufficiali JSON per ogni stream.
 */
const GARMIN_SUMMARY_FIELD_RULES: FieldRule[] = [
  { keys: ["averagePower", "maxPower", "weightedMeanPower", "normalizedPower"], domain: "exertion_mechanical_output" },
  { keys: ["averageHR", "maxHR", "averageHeartRate", "maxHeartRate"], domain: "exertion_physiological_load" },
  { keys: ["distance", "distanceInMeters"], domain: "positioning_navigation" },
  { keys: ["startingLatitude", "startingLongitude", "latitude", "longitude"], domain: "positioning_navigation" },
  { keys: ["elevationGain", "elevationLoss", "minElevation", "maxElevation"], domain: "environmental_exposure" },
  { keys: ["avgTemperature", "minTemperature", "maxTemperature"], domain: "thermoregulation" },
  { keys: ["trainingEffect", "trainingLoadScore", "trainingStressScore", "anaerobicTrainingEffect"], domain: "exertion_physiological_load" },
  { keys: ["vo2MaxValue", "avgVerticalSpeed"], domain: "exertion_metabolism_lab" },
  { keys: ["avgRespirationRate", "maxRespirationRate"], domain: "respiratory_mechanics" },
];

function recordHasAnyKey(r: Record<string, unknown>, keys: string[]): boolean {
  for (const k of keys) {
    const v = r[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "number" && Number.isFinite(v)) return true;
    if (typeof v === "string" && v.trim().length > 0) return true;
    if (typeof v === "object") return true;
  }
  return false;
}

/** Domini osservazione dedotti dai campi presenti nel summary Garmin. */
export function observationDomainsFromGarminActivitySummary(r: Record<string, unknown>): ObservationDomain[] {
  const out: ObservationDomain[] = [];
  for (const rule of GARMIN_SUMMARY_FIELD_RULES) {
    if (recordHasAnyKey(r, rule.keys) && !out.includes(rule.domain)) {
      out.push(rule.domain);
    }
  }
  return out;
}
