import "server-only";

import type { ObservationDomain } from "@/lib/empathy/schemas";

/** Domini osservazione da un payload activity Karoo (bike computer). */
export function observationDomainsFromKarooPayload(payload: Record<string, unknown>): ObservationDomain[] {
  const out: ObservationDomain[] = [];
  const push = (d: ObservationDomain) => {
    if (!out.includes(d)) out.push(d);
  };
  const has = (...keys: string[]) => keys.some((k) => k in payload);

  if (has("averagePower", "avg_power", "normalizedPower", "kj", "work")) {
    push("exertion_mechanical_output");
  }
  if (has("averageHeartRate", "avg_hr", "maxHeartRate", "max_hr", "calories", "duration", "movingTime")) {
    push("exertion_physiological_load");
  }
  if (has("distance", "elevationGain", "elevation_gain", "averageSpeed", "cadence")) {
    push("locomotion_biomechanics");
  }
  if (out.length === 0) push("exertion_physiological_load");
  return out;
}
