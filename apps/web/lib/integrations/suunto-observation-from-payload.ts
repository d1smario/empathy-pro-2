import "server-only";

import type { ObservationDomain } from "@/lib/empathy/schemas";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Domini osservazione da un payload workout Suunto (summary). */
export function observationDomainsFromSuuntoPayload(payload: Record<string, unknown>): ObservationDomain[] {
  const out: ObservationDomain[] = [];
  const push = (d: ObservationDomain) => {
    if (!out.includes(d)) out.push(d);
  };
  const hr = asRecord(payload.hrdata) ?? asRecord(payload.heartRate);
  const merged: Record<string, unknown> = { ...payload, ...(hr ?? {}) };

  if ("activityId" in merged || "totalTime" in merged || "energyConsumption" in merged || "totalDistance" in merged) {
    push("exertion_physiological_load");
  }
  if ("avg" in merged || "max" in merged || "hravg" in merged || "avgHr" in merged) {
    push("exertion_physiological_load");
  }
  if ("totalAscent" in merged || "totalDistance" in merged) {
    push("locomotion_biomechanics");
  }
  return out;
}
