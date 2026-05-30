import type {
  BiomechanicsEfficiencyScores,
  BiomechanicsJointAngleSample,
  BiomechanicsMovementPatternSummary,
  BiomechanicsRiskScores,
} from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-biomechanics" as const;
export const DOMAIN_TITLE = "Biomechanics";
export const DOMAIN_SUMMARY =
  "Motore deterministico per angoli, simmetria, qualita movimento e rischio biomeccanico da sessioni validate.";

export type BiomechanicsScoreInput = {
  jointAngles: BiomechanicsJointAngleSample[];
  movementPatterns?: BiomechanicsMovementPatternSummary;
  riskScores?: BiomechanicsRiskScores;
};

export type BiomechanicsAngleEnvelope = {
  joint: BiomechanicsJointAngleSample["joint"];
  side?: BiomechanicsJointAngleSample["side"];
  minDeg: number;
  maxDeg: number;
  rangeDeg: number;
  meanDeg: number;
  samples: number;
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function mean(values: readonly number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeJointAngles(samples: readonly BiomechanicsJointAngleSample[]): BiomechanicsAngleEnvelope[] {
  const groups = new Map<string, BiomechanicsJointAngleSample[]>();
  for (const sample of samples) {
    if (!Number.isFinite(sample.angleDeg)) continue;
    const key = `${sample.joint}:${sample.side ?? "midline"}`;
    const rows = groups.get(key) ?? [];
    rows.push(sample);
    groups.set(key, rows);
  }

  return [...groups.values()].map((rows) => {
    const angles = rows.map((row) => row.angleDeg);
    const minDeg = Math.min(...angles);
    const maxDeg = Math.max(...angles);
    return {
      joint: rows[0]!.joint,
      side: rows[0]!.side ?? "midline",
      minDeg,
      maxDeg,
      rangeDeg: maxDeg - minDeg,
      meanDeg: mean(angles),
      samples: rows.length,
    };
  });
}

export function symmetryScoreFromBilateralAngles(samples: readonly BiomechanicsJointAngleSample[]): number {
  const byJoint = new Map<BiomechanicsJointAngleSample["joint"], { left?: number; right?: number }>();
  for (const envelope of summarizeJointAngles(samples)) {
    if (envelope.side !== "left" && envelope.side !== "right") continue;
    const current = byJoint.get(envelope.joint) ?? {};
    current[envelope.side] = envelope.meanDeg;
    byJoint.set(envelope.joint, current);
  }

  const penalties: number[] = [];
  for (const pair of byJoint.values()) {
    if (typeof pair.left !== "number" || typeof pair.right !== "number") continue;
    penalties.push(Math.abs(pair.left - pair.right) / 20);
  }

  if (!penalties.length) return 1;
  return clamp01(1 - mean(penalties));
}

export function movementQualityScore(patterns: BiomechanicsMovementPatternSummary | undefined): number {
  if (!patterns) return 0.5;
  const positive = [
    patterns.pelvicStability01,
    patterns.kneeTracking01,
    patterns.ankleDynamics01,
    patterns.strideSymmetry01,
    patterns.rangeOfMotion01,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const base = positive.length ? mean(positive.map(clamp01)) : 0.5;
  const compensationPenalty = Math.min(0.25, (patterns.compensationFlags?.length ?? 0) * 0.05);
  return clamp01(base - compensationPenalty);
}

export function aggregateRiskScore(riskScores: BiomechanicsRiskScores | undefined): number {
  if (!riskScores) return 0.25;
  const risks = [
    riskScores.kneeRisk01,
    riskScores.hipRisk01,
    riskScores.lumbarRisk01,
    riskScores.achillesRisk01,
    riskScores.cervicalRisk01,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return risks.length ? clamp01(Math.max(...risks.map(clamp01))) : 0.25;
}

export function computeBiomechanicsEfficiencyScores(input: BiomechanicsScoreInput): BiomechanicsEfficiencyScores {
  const symmetry01 = symmetryScoreFromBilateralAngles(input.jointAngles);
  const movementQuality01 = movementQualityScore(input.movementPatterns);
  const injuryRisk01 = aggregateRiskScore(input.riskScores);
  const biomechanicalEfficiency01 = clamp01(0.45 * movementQuality01 + 0.35 * symmetry01 + 0.2 * (1 - injuryRisk01));

  return {
    biomechanicalEfficiency01,
    movementQuality01,
    symmetry01,
    injuryRisk01,
  };
}
