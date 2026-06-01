/** Opt-in demo mode: no external sidecar; golden fixtures only. Set LAB_INLINE_MOCK=1 on Vercel/local. */
import { GOLDEN_MONOLATERAL_SIDE_LANDMARKS } from "@/lib/biomechanics/biomech-skeleton-overlay";

export function isLabInlineMockEnabled(): boolean {
  const raw = process.env.LAB_INLINE_MOCK?.trim().replace(/\r?\n/g, "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function labInlinePoseProposal(provider = "lab-inline-mock") {
  return {
    version: "pose_proposal_v1" as const,
    confidence01: 0.82,
    provider,
    model: "golden-fixture-v1",
    jointAngles: [
      { joint: "hip" as const, side: "left" as const, angleDeg: 54, phasePct: 0, confidence01: 0.86 },
      { joint: "knee" as const, side: "left" as const, angleDeg: 168, phasePct: 0, confidence01: 0.9 },
      { joint: "ankle" as const, side: "left" as const, angleDeg: 108, phasePct: 0, confidence01: 0.84 },
      { joint: "hip" as const, side: "left" as const, angleDeg: 88, phasePct: 50, confidence01: 0.86 },
      { joint: "knee" as const, side: "left" as const, angleDeg: 142, phasePct: 50, confidence01: 0.9 },
      { joint: "ankle" as const, side: "left" as const, angleDeg: 72, phasePct: 50, confidence01: 0.84 },
    ],
    movementPatterns: {
      pelvicStability01: 0.8,
      kneeTracking01: 0.7,
      ankleDynamics01: 0.76,
      strideSymmetry01: 0.82,
      rangeOfMotion01: 0.74,
      compensationFlags: ["knee_valgus_mild"],
    },
    riskScores: { kneeRisk01: 0.2, lumbarRisk01: 0.65 },
    landmarks: GOLDEN_MONOLATERAL_SIDE_LANDMARKS,
  };
}

export function labInlineGeometryProposal() {
  return {
    version: "geometry_proposal_v1" as const,
    confidence01: 0.76,
    provider: "lab-inline-mock",
    position: { torsoAngleDeg: 11, headDropMm: 42, confidence01: 0.7 },
    geometry: { frontalAreaM2: 0.36, projectedAreaM2: 0.31 },
    equipment: { helmet: "aero" as const, wheels: "disc" as const },
    cdaSurrogateM2: 0.295,
  };
}
