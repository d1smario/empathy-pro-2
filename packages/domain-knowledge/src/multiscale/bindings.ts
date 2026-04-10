/**
 * Deterministic binding: physiology/twin proxies → activated ontology node ids.
 * Thresholds aligned with V1 `pathway-modulation-model` spirit (interpretation only).
 */
import type { MultiscaleSignalSnapshot } from "./types";

function n(v: number | null | undefined): number {
  if (v == null || !Number.isFinite(v)) return NaN;
  return v;
}

/**
 * Returns stable sorted ids for audit / traces.
 */
export function deriveMultiscaleActivatedNodes(snapshot: MultiscaleSignalSnapshot): string[] {
  const out = new Set<string>(["scale.whole_body"]);

  const redox = n(snapshot.redoxStressIndex);
  const infl = n(snapshot.twinInflammationRisk);
  const gly = n(snapshot.glycogenStatus);
  const ready = n(snapshot.readiness);
  const gut = n(snapshot.gutStressScorePct);
  const cho = n(snapshot.choDeliveryPctOfIngested);
  const ox = n(snapshot.oxidativeBottleneckIndex);

  out.add("scale.metabolome");
  out.add("scale.signalling");

  if (redox >= 52 || infl >= 55) {
    out.add("cluster.immune_inflammation");
    out.add("axis.nrf2_ros");
    out.add("cluster.mito_biogenesis");
    out.add("enzyme.cco");
  }

  if (ox >= 60) {
    out.add("cluster.mito_biogenesis");
    out.add("axis.nrf2_ros");
    out.add("enzyme.cco");
  }

  if (gly < 42 && Number.isFinite(gly)) {
    out.add("cluster.nutrient_handling");
    out.add("cluster.energy_sensing");
    out.add("axis.ampk_mtor");
  }

  if (ready < 45 && Number.isFinite(ready)) {
    out.add("cascade.hpa");
    out.add("neuro.cns_fatigue");
  }

  if (gut >= 35 && Number.isFinite(gut)) {
    out.add("microbiota.lps_barrier");
    out.add("microbiota.scfa_ampk");
  }

  if (cho < 82 && Number.isFinite(cho)) {
    out.add("cluster.nutrient_handling");
    out.add("enzyme.pfk");
  }

  if (redox < 45 && infl < 45 && Number.isFinite(redox) && Number.isFinite(infl)) {
    out.add("cluster.hypoxia");
    out.add("axis.hif_o2");
  }

  return Array.from(out).sort();
}
