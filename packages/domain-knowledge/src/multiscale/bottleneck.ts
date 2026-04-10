/**
 * Adaptive priority view: scores L1–L6 for interpretation / copy / functional hints.
 * Does not mutate twin state.
 */
import { getMultiscaleNode } from "./ontology-data";
import type {
  BottleneckLevelScore,
  MetabolicBottleneckView,
  MetabolicHierarchyLevel,
  MultiscaleSignalSnapshot,
} from "./types";
import { MULTISCALE_ONTOLOGY_VERSION } from "./types";
import { deriveMultiscaleActivatedNodes } from "./bindings";

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function stress01(v: number | null | undefined, lo: number, hi: number): number {
  if (v == null || !Number.isFinite(v)) return 0;
  if (v <= lo) return 0;
  if (v >= hi) return 1;
  return (v - lo) / (hi - lo);
}

/**
 * Higher score = more constraint / attention needed at that hierarchy level.
 */
export function computeMetabolicBottleneckView(snapshot: MultiscaleSignalSnapshot): MetabolicBottleneckView {
  const activated = deriveMultiscaleActivatedNodes(snapshot);

  const l1 =
    stress01(snapshot.glycogenStatus, 30, 42) * 0.55 +
    stress01(snapshot.choDeliveryPctOfIngested == null ? null : 100 - snapshot.choDeliveryPctOfIngested, 10, 25) * 0.45;

  const l2 =
    stress01(snapshot.redoxStressIndex, 45, 62) * 0.4 +
    stress01(snapshot.oxidativeBottleneckIndex, 50, 75) * 0.35 +
    stress01(snapshot.twinInflammationRisk, 45, 70) * 0.25;

  const l3 = stress01(snapshot.twinInflammationRisk, 40, 65) * 0.5 + stress01(snapshot.redoxStressIndex, 50, 60) * 0.5;

  const l4 = stress01(snapshot.readiness, 30, 45) * 0.7 + stress01(snapshot.twinInflammationRisk, 50, 65) * 0.3;

  const l5 = stress01(snapshot.gutStressScorePct, 25, 45) * 0.85 + (1 - clamp01(snapshot.choDeliveryPctOfIngested ?? 100) / 100) * 0.15;

  const l6 = stress01(snapshot.readiness, 35, 50) * 0.6 + stress01(100 - (snapshot.readiness ?? 50), 40, 60) * 0.4;

  const raw: BottleneckLevelScore[] = [
    { level: 1, score: clamp01(l1), rationaleIt: "Disponibilità energetica / substrati / AMPK (contesto glicogeno e consegna CHO)." },
    { level: 2, score: clamp01(l2), rationaleIt: "Controllo cellulare: stress redox, collo ossidativo, tono infiammatorio." },
    { level: 3, score: clamp01(l3), rationaleIt: "Programmi di espressione / infiammazione sistemica." },
    { level: 4, score: clamp01(l4), rationaleIt: "Milieu endocrino-stress (readiness, HPA context)." },
    { level: 5, score: clamp01(l5), rationaleIt: "Microbiota, barriera, assorbimento." },
    { level: 6, score: clamp01(l6), rationaleIt: "Sistema nervoso / fatica centrale / motivazione (proxy readiness)." },
  ];

  const ordered = [...raw].sort((a, b) => b.score - a.score);
  const dominant = ordered[0] ?? raw[0]!;

  const tags = new Set<string>();
  for (const id of activated) {
    const node = getMultiscaleNode(id);
    node?.cofactorNutrientTags?.forEach((t) => tags.add(t));
  }
  if (dominant.level <= 2) tags.add("prioritize_micronutrient_cofactors");
  if (dominant.level >= 5) tags.add("prioritize_gut_friendly_timing");

  return {
    ontologyVersion: MULTISCALE_ONTOLOGY_VERSION,
    dominantBottleneck: dominant,
    orderedLevels: ordered,
    suggestedInterpretationTags: Array.from(tags).sort(),
    activatedNodeIds: activated,
  };
}

export function metabolicLevelLabelIt(level: MetabolicHierarchyLevel): string {
  switch (level) {
    case 1:
      return "L1 — Energetica / substrati";
    case 2:
      return "L2 — Controllo cellulare (AMPK, mTOR, redox)";
    case 3:
      return "L3 — Espressione / programmi genici (tag)";
    case 4:
      return "L4 — Endocrino / stress";
    case 5:
      return "L5 — Microbiota / nutrienti / cofattori";
    case 6:
      return "L6 — Neuro / fatica centrale";
    default:
      return `L${level}`;
  }
}
