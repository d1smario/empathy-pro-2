import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";
import type { MetabolicLabSomatoaxisSnapshotV1 } from "@empathy/domain-bioenergetics";

const GH_KEYS = ["gh", "growth_hormone", "hgh"] as const;
const IGF_KEYS = ["igf1", "igf_1", "igf1_ng_ml"] as const;

/** Presenza valori GH / IGF-1 nei panel biomarker (solo positività, niente interpretazione numerica). */
export function somatoaxisLabFlagsFromBiomarkerRows(
  rows: Array<Record<string, unknown>>,
): MetabolicLabSomatoaxisSnapshotV1 {
  let hasGhLab = false;
  let hasIgf1Lab = false;
  for (const row of rows) {
    const raw = row.values;
    if (!raw || typeof raw !== "object") continue;
    const values = raw as Record<string, unknown>;
    for (const k of GH_KEYS) {
      const v = num(values[k]);
      if (v != null && v > 0) hasGhLab = true;
    }
    for (const k of IGF_KEYS) {
      const v = num(values[k]);
      if (v != null && v > 0) hasIgf1Lab = true;
    }
  }
  return { hasGhLab, hasIgf1Lab };
}
