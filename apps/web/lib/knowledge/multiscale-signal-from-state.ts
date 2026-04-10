import type { MultiscaleSignalSnapshot } from "@empathy/domain-knowledge";
import type { PhysiologyState } from "@/lib/empathy/schemas/physiology";
import type { TwinState } from "@/lib/empathy/schemas/twin";

/**
 * Costruisce i proxy per il motore multiscala da stato fisiologia canonico + twin (stesso spirito di pathway-modulation).
 */
export function buildMultiscaleSignalSnapshotFromAthlete(
  physiology: PhysiologyState,
  twin: TwinState | null | undefined,
): MultiscaleSignalSnapshot {
  const perf = physiology.performanceProfile;
  const lac = physiology.lactateProfile;
  const bio = physiology.bioenergeticProfile;

  const rPerf = perf.redoxStressIndex;
  const rTwin = twin?.redoxStressIndex;
  const redoxStressIndex =
    rPerf != null && rTwin != null ? Math.max(rPerf, rTwin) : rPerf ?? rTwin ?? undefined;

  const twinInflammationRisk = twin?.inflammationRisk ?? bio.inflammationProxy ?? undefined;

  const gutRaw = lac.gutStressScore;
  const gutStressScorePct = gutRaw != null && Number.isFinite(gutRaw) ? gutRaw * 100 : undefined;

  const oxidativeBottleneckIndex = perf.oxidativeBottleneckIndex ?? twin?.oxidativeBottleneck ?? undefined;

  return {
    redoxStressIndex,
    twinInflammationRisk,
    glycogenStatus: twin?.glycogenStatus ?? undefined,
    readiness: twin?.readiness ?? undefined,
    gutStressScorePct,
    choDeliveryPctOfIngested: lac.bloodDeliveryPctOfIngested ?? undefined,
    oxidativeBottleneckIndex,
  };
}
