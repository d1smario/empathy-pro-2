import type {
  BiomechanicsEfficiencyScores,
  BiomechanicsJointAngleSample,
  BiomechanicsLandmark3D,
  BiomechanicsMovementPatternSummary,
  BiomechanicsRiskScores,
  BiomechanicsScaleCalibration,
  BiomechanicsSegmentLengths,
} from "@empathy/contracts";
import { computeBiomechanicsEfficiencyScores } from "@empathy/domain-biomechanics";
import { normalizeMonolateralLandmarks } from "@/lib/biomechanics/biomech-skeleton-overlay";

export type BiomechanicsReportData = {
  discipline?: string;
  source?: string;
  recordedAt?: string;
  provider?: string;
  confidence01?: number;
  jointAngles?: BiomechanicsJointAngleSample[];
  movementPatterns?: BiomechanicsMovementPatternSummary;
  riskScores?: BiomechanicsRiskScores;
  efficiencyScores?: BiomechanicsEfficiencyScores;
  calibration?: BiomechanicsScaleCalibration;
  anthropometrics?: BiomechanicsSegmentLengths;
  compensationFlags?: string[];
  landmarks?: BiomechanicsLandmark3D[];
  mediaStoragePath?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseJointAngles(value: unknown): BiomechanicsJointAngleSample[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: BiomechanicsJointAngleSample[] = [];
  for (const item of value) {
    const row = asRecord(item);
    if (!row || typeof row.joint !== "string" || typeof row.angleDeg !== "number") continue;
    rows.push({
      joint: row.joint as BiomechanicsJointAngleSample["joint"],
      side: typeof row.side === "string" ? (row.side as BiomechanicsJointAngleSample["side"]) : undefined,
      angleDeg: row.angleDeg,
      phasePct: typeof row.phasePct === "number" ? row.phasePct : undefined,
      confidence01: typeof row.confidence01 === "number" ? row.confidence01 : undefined,
    });
  }
  return rows.length ? rows : undefined;
}

function parseMovementPatterns(value: unknown): BiomechanicsMovementPatternSummary | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  return row as BiomechanicsMovementPatternSummary;
}

function parseRiskScores(value: unknown): BiomechanicsRiskScores | undefined {
  const row = asRecord(value);
  if (!row) return undefined;
  return row as BiomechanicsRiskScores;
}

function parseLandmarks(value: unknown): BiomechanicsLandmark3D[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: BiomechanicsLandmark3D[] = [];
  for (const item of value) {
    const row = asRecord(item);
    if (!row || typeof row.name !== "string") continue;
    if (typeof row.xMm !== "number" || typeof row.yMm !== "number") continue;
    rows.push({
      name: row.name,
      xMm: row.xMm,
      yMm: row.yMm,
      zMm: typeof row.zMm === "number" ? row.zMm : undefined,
      confidence01: typeof row.confidence01 === "number" ? row.confidence01 : undefined,
    });
  }
  return rows.length ? rows : undefined;
}

function normalizeParsedLandmarks(rows: BiomechanicsLandmark3D[] | undefined): BiomechanicsLandmark3D[] | undefined {
  if (!rows?.length) return undefined;
  return normalizeMonolateralLandmarks(rows);
}

export function parseBiomechPoseProposal(patches: unknown): BiomechanicsReportData | null {
  const root = asRecord(patches);
  const proposal = asRecord(root?.biomechPoseProposal);
  if (!proposal) return null;

  const jointAngles = parseJointAngles(proposal.jointAngles);
  const movementPatterns = parseMovementPatterns(proposal.movementPatterns);
  const riskScores = parseRiskScores(proposal.riskScores);

  let efficiencyScores: BiomechanicsEfficiencyScores | undefined;
  if (jointAngles?.length) {
    efficiencyScores = computeBiomechanicsEfficiencyScores({ jointAngles, movementPatterns, riskScores });
  }

  return {
    provider: typeof proposal.provider === "string" ? proposal.provider : undefined,
    confidence01: typeof proposal.confidence01 === "number" ? proposal.confidence01 : undefined,
    jointAngles,
    landmarks: normalizeParsedLandmarks(parseLandmarks(proposal.landmarks)),
    movementPatterns,
    riskScores,
    efficiencyScores,
    compensationFlags: Array.isArray(movementPatterns?.compensationFlags)
      ? movementPatterns.compensationFlags.filter((flag): flag is string => typeof flag === "string")
      : undefined,
  };
}

export function pct01(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export function deg(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 10) / 10}°`;
}

export const JOINT_LABELS: Record<BiomechanicsJointAngleSample["joint"], string> = {
  hip: "Anca",
  knee: "Ginocchio",
  ankle: "Caviglia",
  shoulder: "Spalla",
  elbow: "Gomito",
  back: "Schiena",
  neck: "Collo",
};

export const SIDE_LABELS: Record<NonNullable<BiomechanicsJointAngleSample["side"]>, string> = {
  left: "Sx",
  right: "Dx",
  midline: "Centro",
};

export const RISK_LABELS: Record<keyof BiomechanicsRiskScores, string> = {
  kneeRisk01: "Ginocchio",
  hipRisk01: "Anca",
  lumbarRisk01: "Lombare",
  achillesRisk01: "Achille",
  cervicalRisk01: "Cervicale",
};

export const MOVEMENT_LABELS: Record<keyof BiomechanicsMovementPatternSummary, string> = {
  pelvicStability01: "Stabilità pelvica",
  kneeTracking01: "Tracking ginocchio",
  ankleDynamics01: "Dinamica caviglia",
  strideSymmetry01: "Simmetria passo",
  rangeOfMotion01: "ROM globale",
  compensationFlags: "Compensazioni",
};
