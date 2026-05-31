import test from "node:test";
import assert from "node:assert/strict";
import {
  BiomechPoseCvError,
  extractBiomechPoseFromCv,
  parseBiomechPoseProposalV1,
  POSE_PROPOSAL_VERSION,
} from "./biomech-pose-cv-adapter";

const goldenProposal = {
  version: POSE_PROPOSAL_VERSION,
  confidence01: 0.82,
  provider: "test-pose",
  jointAngles: [
    { joint: "knee", side: "left", angleDeg: 142, confidence01: 0.9 },
    { joint: "knee", side: "right", angleDeg: 138, confidence01: 0.88 },
  ],
  movementPatterns: { pelvicStability01: 0.8, kneeTracking01: 0.7 },
  riskScores: { kneeRisk01: 0.2, lumbarRisk01: 0.65 },
};

test("parseBiomechPoseProposalV1 accepts golden cycling bilateral fixture", () => {
  const parsed = parseBiomechPoseProposalV1(goldenProposal);
  assert.equal(parsed.jointAngles.length, 2);
  assert.equal(parsed.confidence01, 0.82);
  assert.equal(parsed.provider, "test-pose");
});

test("parseBiomechPoseProposalV1 rejects low confidence", () => {
  assert.throws(
    () => parseBiomechPoseProposalV1({ ...goldenProposal, confidence01: 0.1 }),
    (err: unknown) => err instanceof BiomechPoseCvError && err.code === "low_confidence",
  );
});

test("extractBiomechPoseFromCv calls external API and parses response", async () => {
  const parsed = await extractBiomechPoseFromCv(
    {
      mediaDownloadUrl: "https://example.com/video.mp4",
      athleteId: "athlete-1",
      discipline: "cycling",
      cameraPlane: "side",
      contentType: "video/mp4",
    },
    {
      apiUrl: "https://pose.test/extract",
      fetchImpl: async () =>
        new Response(JSON.stringify(goldenProposal), { status: 200, headers: { "Content-Type": "application/json" } }),
    },
  );
  assert.equal(parsed.jointAngles[0]?.angleDeg, 142);
});

test("extractBiomechPoseFromCv fails when env URL missing", async () => {
  await assert.rejects(
    () =>
      extractBiomechPoseFromCv(
        {
          mediaDownloadUrl: "https://example.com/video.mp4",
          athleteId: "athlete-1",
          discipline: "cycling",
          cameraPlane: "side",
          contentType: "video/mp4",
        },
        { apiUrl: undefined, apiKey: undefined },
      ),
    (err: unknown) => err instanceof BiomechPoseCvError && err.code === "provider_unavailable",
  );
});
