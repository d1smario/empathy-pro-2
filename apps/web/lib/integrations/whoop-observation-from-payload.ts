import "server-only";

import type { ObservationDomain } from "@/lib/empathy/schemas";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Estrae domini da un payload WHOOP v2 (sleep / recovery / workout) minimale. */
export function observationDomainsFromWhoopPayload(payload: Record<string, unknown>): ObservationDomain[] {
  const out: ObservationDomain[] = [];
  const push = (d: ObservationDomain) => {
    if (!out.includes(d)) out.push(d);
  };

  const score = asRecord(payload.score);
  const merged: Record<string, unknown> = { ...payload, ...(score ?? {}) };

  if ("sleep_performance_percentage" in merged || "stage_summary" in merged || "nap" in merged) {
    push("sleep_timing_duration");
    push("sleep_staging_microstructure");
  }
  if ("respiratory_rate" in merged || "spo2_percentage" in merged) {
    push("sleep_respiration_oxygenation");
  }
  if ("recovery_score" in merged || "hrv_rmssd_milli" in merged || "resting_heart_rate" in merged) {
    push("autonomic_recovery_state");
  }
  if ("skin_temp_celsius" in merged) {
    push("thermoregulation");
  }
  if ("strain" in merged || "kilojoule" in merged || "sport_name" in merged) {
    push("exertion_physiological_load");
  }
  if ("zone_durations" in merged || "average_heart_rate" in merged) {
    push("exertion_physiological_load");
  }

  return out;
}
