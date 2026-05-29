import "server-only";

import type { ObservationDomain } from "@/lib/empathy/schemas";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Estrae domini osservazione da un payload Polar AccessLink (exercise / sleep / nightly-recharge). */
export function observationDomainsFromPolarPayload(payload: Record<string, unknown>): ObservationDomain[] {
  const out: ObservationDomain[] = [];
  const push = (d: ObservationDomain) => {
    if (!out.includes(d)) out.push(d);
  };

  const hr = asRecord(payload.heart_rate);
  const merged: Record<string, unknown> = { ...payload, ...(hr ?? {}) };

  // Exercise / training
  if ("sport" in merged || "training_load" in merged || "training_load_pro" in merged || "calories" in merged) {
    push("exertion_physiological_load");
  }
  // Sleep
  if ("light_sleep" in merged || "deep_sleep" in merged || "rem_sleep" in merged || "sleep_start_time" in merged) {
    push("sleep_timing_duration");
    push("sleep_staging_microstructure");
  }
  // Nightly Recharge (autonomic recovery)
  if (
    "heart_rate_variability_avg" in merged ||
    "nightly_recharge_status" in merged ||
    "ans_charge" in merged ||
    "beat_to_beat_avg" in merged
  ) {
    push("autonomic_recovery_state");
  }
  if ("average" in merged || "maximum" in merged) {
    push("exertion_physiological_load");
  }

  return out;
}
