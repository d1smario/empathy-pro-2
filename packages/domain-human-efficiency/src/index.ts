import type {
  AerodynamicsTwinSnapshotV1,
  BiomechanicsTwinSnapshotV1,
} from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-human-efficiency" as const;
export const DOMAIN_TITLE = "Human Efficiency";
export const DOMAIN_SUMMARY =
  "Composizione read-only di efficienza fisiologica, meccanica e aerodinamica da snapshot confermati.";

export type HumanEfficiencyScoreV1 = {
  athleteId: string;
  computedAt: string;
  physiologicalEfficiency01: number;
  mechanicalEfficiency01: number;
  aerodynamicEfficiency01: number;
  globalHumanEfficiency01: number;
  confidence01: number;
  algorithmVersion: string;
};

export type HumanEfficiencyInput = {
  athleteId: string;
  computedAt?: string;
  biomechanicsSnapshot?: BiomechanicsTwinSnapshotV1 | null;
  aerodynamicsSnapshot?: AerodynamicsTwinSnapshotV1 | null;
  /** Optional bioenergetic/twin readiness 0..1 */
  physiologicalReadiness01?: number | null;
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function computeHumanEfficiencyScoreV1(input: HumanEfficiencyInput): HumanEfficiencyScoreV1 | null {
  const mechanical = input.biomechanicsSnapshot?.efficiencyScores.biomechanicalEfficiency01;
  const aero = input.aerodynamicsSnapshot?.scores.aeroEfficiency01;
  const physiological = input.physiologicalReadiness01;

  if (mechanical === undefined && aero === undefined && physiological == null) {
    return null;
  }

  const mechanicalEfficiency01 = clamp01(mechanical ?? 0.5);
  const aerodynamicEfficiency01 = clamp01(aero ?? 0.5);
  const physiologicalEfficiency01 = clamp01(physiological ?? (mechanicalEfficiency01 + aerodynamicEfficiency01) / 2);

  const weights = {
    phys: physiological != null || mechanical != null || aero != null ? 0.35 : 0,
    mech: mechanical != null ? 0.35 : 0,
    aero: aero != null ? 0.3 : 0,
  };
  const weightSum = weights.phys + weights.mech + weights.aero || 1;
  const globalHumanEfficiency01 = clamp01(
    (physiologicalEfficiency01 * weights.phys +
      mechanicalEfficiency01 * weights.mech +
      aerodynamicEfficiency01 * weights.aero) /
      weightSum,
  );

  const confidences = [
    input.biomechanicsSnapshot?.confidence01,
    input.aerodynamicsSnapshot?.confidence01,
  ].filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const confidence01 = confidences.length ? clamp01(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0.45;

  return {
    athleteId: input.athleteId,
    computedAt: input.computedAt ?? new Date().toISOString(),
    physiologicalEfficiency01,
    mechanicalEfficiency01,
    aerodynamicEfficiency01,
    globalHumanEfficiency01,
    confidence01,
    algorithmVersion: "human_efficiency_v1",
  };
}
