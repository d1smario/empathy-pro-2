import test from "node:test";
import assert from "node:assert/strict";
import {
  AeroGeometryCvError,
  extractAeroGeometryFromCv,
  GEOMETRY_PROPOSAL_VERSION,
  parseAeroGeometryProposalV1,
} from "./aero-geometry-cv-adapter";

const goldenProposal = {
  version: GEOMETRY_PROPOSAL_VERSION,
  confidence01: 0.76,
  provider: "test-aero",
  position: { torsoAngleDeg: 11, headDropMm: 42, confidence01: 0.7 },
  geometry: { frontalAreaM2: 0.36, projectedAreaM2: 0.31 },
  equipment: { helmet: "aero", wheels: "disc" },
  cdaSurrogateM2: 0.295,
};

test("parseAeroGeometryProposalV1 accepts golden side capture", () => {
  const parsed = parseAeroGeometryProposalV1(goldenProposal);
  assert.equal(parsed.cdaSurrogateM2, 0.295);
  assert.equal(parsed.equipment.helmet, "aero");
});

test("parseAeroGeometryProposalV1 rejects low confidence", () => {
  assert.throws(
    () => parseAeroGeometryProposalV1({ ...goldenProposal, confidence01: 0.05 }),
    (err: unknown) => err instanceof AeroGeometryCvError && err.code === "low_confidence",
  );
});

test("extractAeroGeometryFromCv calls external API", async () => {
  const parsed = await extractAeroGeometryFromCv(
    {
      mediaDownloadUrl: "https://example.com/side.jpg",
      athleteId: "athlete-1",
      cameraMode: "side",
      contentType: "image/jpeg",
    },
    {
      apiUrl: "https://aero.test/extract",
      fetchImpl: async () =>
        new Response(JSON.stringify(goldenProposal), { status: 200, headers: { "Content-Type": "application/json" } }),
    },
  );
  assert.equal(parsed.geometry?.frontalAreaM2, 0.36);
});
