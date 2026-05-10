import type { BioenergeticConditioningContextV1 } from "@empathy/contracts";
import type { MetabolicSleepContextSnapshotV1 } from "@empathy/domain-bioenergetics";

/**
 * Riassunto sonno per `MetabolicDayCoherenceSnapshotV1.sleepContext`, derivato dalla stessa
 * `sleepAutonomic` di `buildBioenergeticConditioningContextFromDay` (nessuna query parallela).
 */
export function metabolicSleepContextFromConditioningContext(
  ctx: BioenergeticConditioningContextV1,
): MetabolicSleepContextSnapshotV1 {
  const windows = ctx.sleepAutonomic;
  if (!windows?.length) {
    return { present: false, maxSleepHours: null };
  }
  let maxH: number | null = null;
  for (const w of windows) {
    const h = w.sleepHours;
    if (h != null && Number.isFinite(h)) {
      maxH = maxH == null ? h : Math.max(maxH, h);
    }
  }
  const present = true;
  return { present, maxSleepHours: maxH };
}
