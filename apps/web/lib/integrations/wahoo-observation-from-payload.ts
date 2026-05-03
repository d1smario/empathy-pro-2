import "server-only";

import type { ObservationDomain } from "@/lib/empathy/schemas";

/** Euristiche su JSON workout Wahoo Cloud (chiavi indicative; allineare alla OpenAPI Wahoo). */
export function observationDomainsFromWahooWorkoutPayload(payload: Record<string, unknown>): ObservationDomain[] {
  const out: ObservationDomain[] = [];
  const push = (d: ObservationDomain) => {
    if (!out.includes(d)) out.push(d);
  };

  const keys = Object.keys(payload).map((k) => k.toLowerCase());
  const has = (frag: string) => keys.some((k) => k.includes(frag));

  if (has("power") || has("watts")) push("exertion_mechanical_output");
  if (has("heart") || has("heartrate") || has("hr")) push("exertion_physiological_load");
  if (has("lat") || has("lng") || has("gps") || has("route")) push("positioning_navigation");
  if (has("cadence")) push("exertion_mechanical_output");
  if (has("energy") || has("calorie") || has("kj")) push("nutrition_energy_balance_device");

  return out;
}
