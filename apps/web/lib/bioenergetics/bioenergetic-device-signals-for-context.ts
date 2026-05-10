import type { BioenergeticBodyCompositionSnapshotV1 } from "@empathy/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";
import { expandDevicePayloadMetricRecords, extractSleepRecoverySignal } from "@/lib/reality/sleep-recovery-signals";

function numFromRecord(rec: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = num(rec[k]);
    if (v != null && Number.isFinite(v)) return v;
  }
  return undefined;
}

/** True se export contiene FC a riposo, strain o serie HR (trace / wellness). */
export function deviceExportsHaveHrSignal(slice: BioenergeticDayMemorySlice): boolean {
  for (const row of slice.deviceExportRows) {
    const p = row.payload;
    if (!p || typeof p !== "object") continue;
    const pl = p as Record<string, unknown>;
    const sig = extractSleepRecoverySignal(pl);
    if (sig.restingHrBpm != null || sig.strainScore != null) return true;
    for (const rec of expandDevicePayloadMetricRecords(pl)) {
      if (
        numFromRecord(rec, [
          "heart_rate",
          "avg_heart_rate",
          "meanHeartRateInBeatsPerMinute",
          "averageHeartRateInBeatsPerMinute",
          "hr",
          "bpm",
        ]) != null
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Estrae snapshot BIA / composizione da payload vendor (chiavi comuni Withings/Garmin/WHOOP-like).
 * Non interpretazione clinica: solo numeri per contesto synthesizer.
 */
export function extractBestBioimpedanceSnapshot(slice: BioenergeticDayMemorySlice): BioenergeticBodyCompositionSnapshotV1 | undefined {
  let best: BioenergeticBodyCompositionSnapshotV1 | undefined;
  let score = 0;

  for (const row of slice.deviceExportRows) {
    const createdAt = typeof row.created_at === "string" ? row.created_at : `${slice.date}T12:00:00`;
    const p = row.payload;
    if (!p || typeof p !== "object") continue;
    const pl = p as Record<string, unknown>;

    let phaseAngleDeg: number | undefined;
    let ecwTbwRatio: number | undefined;
    let tbwL: number | undefined;
    let ecwL: number | undefined;
    let icwL: number | undefined;

    for (const rec of expandDevicePayloadMetricRecords(pl)) {
      phaseAngleDeg ??= numFromRecord(rec, [
        "phase_angle_deg",
        "phase_angle",
        "phaseAngle",
        "PhaseAngle",
        "phase_angle_score",
        "bioimpedance_phase_angle",
      ]);
      ecwTbwRatio ??= numFromRecord(rec, ["ecw_tbw_ratio", "ecwToTbwRatio", "ecw_tbw", "extracellular_to_total_body_water_ratio"]);
      tbwL ??= numFromRecord(rec, ["total_body_water_l", "tbw_l", "tbw", "total_body_water", "totalBodyWater"]);
      ecwL ??= numFromRecord(rec, ["extracellular_water_l", "ecw_l", "ecw", "extracellular_water"]);
      icwL ??= numFromRecord(rec, ["intracellular_water_l", "icw_l", "icw", "intracellular_water"]);
    }

    const fields = [phaseAngleDeg != null, ecwTbwRatio != null, tbwL != null, ecwL != null].filter(Boolean).length;
    if (fields === 0) continue;

    const snap: BioenergeticBodyCompositionSnapshotV1 = {
      measurementTs: createdAt,
      source: "bia_device",
      phaseAngleDeg,
      tbwL,
      ecwL,
      icwL,
      ecwTbwRatio,
      quality: "arbitrary",
    };
    if (fields > score) {
      score = fields;
      best = snap;
    }
  }
  return best;
}
