/** Opt-in demo mode: no external sidecar; golden fixtures only. Set LAB_INLINE_MOCK=1 on Vercel/local. */
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
      { joint: "knee" as const, side: "left" as const, angleDeg: 142, confidence01: 0.9 },
      { joint: "knee" as const, side: "right" as const, angleDeg: 138, confidence01: 0.88 },
    ],
    movementPatterns: { pelvicStability01: 0.8, kneeTracking01: 0.7 },
    riskScores: { kneeRisk01: 0.2, lumbarRisk01: 0.65 },
    landmarks: [] as [],
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
