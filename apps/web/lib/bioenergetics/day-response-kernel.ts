import type { BioenergeticDayKernelOutput } from "@/api/bioenergetics/contracts";

export type BioenergeticKernelInput = {
  choIntakeG: number;
  activityLoadScore: number;
  cgmPresent: boolean;
  lactatePresent: boolean;
  gutConstraintScore: number;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Deterministic v0 kernel:
 * - activity load increases oxidative utilization and lowers insulinic pressure
 * - same CHO with low demand increases storage pressure and inhibitory pathways
 * - measured channels reduce uncertainty by nudging scores to observed context
 */
export function computeBioenergeticDayKernel(input: BioenergeticKernelInput): BioenergeticDayKernelOutput {
  const cho = clamp(input.choIntakeG, 0, 600);
  const load = clamp(input.activityLoadScore, 0, 100);
  const gutConstraint = clamp(input.gutConstraintScore, 0, 100);

  const demandRatio = load / 100;
  const choPressure = clamp(cho / 120, 0, 2.5);

  const oxidationDriveScore = clamp(30 + load * 0.65 - gutConstraint * 0.2, 5, 100);
  const insulinDemandRaw = 18 + choPressure * 30 - demandRatio * 26 + gutConstraint * 0.18;
  const insulinDemandScore = clamp(insulinDemandRaw, 0, 100);
  const glucoseHandlingRaw = 25 + load * 0.58 - insulinDemandScore * 0.18 - gutConstraint * 0.12;
  const glucoseHandlingScore = clamp(glucoseHandlingRaw, 0, 100);
  const anabolicSuppressionScore = clamp(22 + demandRatio * 44 - insulinDemandScore * 0.25, 0, 100);

  let adjustedGlucoseHandling = glucoseHandlingScore;
  let adjustedInsulinDemand = insulinDemandScore;
  if (input.cgmPresent) {
    adjustedGlucoseHandling = clamp(adjustedGlucoseHandling + 6, 0, 100);
    adjustedInsulinDemand = clamp(adjustedInsulinDemand - 4, 0, 100);
  }
  if (input.lactatePresent) {
    adjustedGlucoseHandling = clamp(adjustedGlucoseHandling + 2, 0, 100);
  }

  const efficiencyIndex = adjustedGlucoseHandling * 0.45 + oxidationDriveScore * 0.35 + anabolicSuppressionScore * 0.2;
  const efficiencyBand = efficiencyIndex >= 67 ? "high" : efficiencyIndex >= 43 ? "moderate" : "low";
  const pathwayState = efficiencyIndex >= 62 ? "supportive" : efficiencyIndex >= 38 ? "mixed" : "inhibitory";

  const keyDrivers: string[] = [];
  if (load >= 55) keyDrivers.push("high_activity_pull");
  if (cho >= 90) keyDrivers.push("cho_exposure");
  if (gutConstraint >= 45) keyDrivers.push("gut_constraint");
  if (input.cgmPresent) keyDrivers.push("measured_glucose_available");
  if (!keyDrivers.length) keyDrivers.push("baseline_context");

  return {
    modelVersion: 1,
    glucoseHandlingScore: round(adjustedGlucoseHandling),
    insulinDemandScore: round(adjustedInsulinDemand),
    oxidationDriveScore: round(oxidationDriveScore),
    anabolicSuppressionScore: round(anabolicSuppressionScore),
    efficiencyBand,
    pathwayState,
    keyDrivers,
  };
}
