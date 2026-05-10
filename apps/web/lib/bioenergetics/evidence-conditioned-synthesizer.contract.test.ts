import test from "node:test";
import assert from "node:assert/strict";
import type { BioenergeticAxisFluidEvidenceLinkV1, BioenergeticConditioningContextV1 } from "@empathy/contracts";
import { synthesizeEvidenceConditionedLayerV1 } from "@empathy/domain-bioenergetics";

const minimalLink: BioenergeticAxisFluidEvidenceLinkV1 = {
  linkId: "33333333-3333-4333-8333-333333330001",
  relationKind: "modulates",
  strength: "supported",
  narrativeIt: "Test",
  curatedAt: "2026-01-01T00:00:00Z",
  axis: {
    id: "11111111-1111-4111-8111-111111110001",
    code: "axis_raas_aldosterone",
    labelIt: "RAAS",
    family: "renal_fluid",
    notesIt: null,
  },
  fluidProcess: {
    id: "22222222-2222-4222-8222-222222220001",
    code: "fluid_plasma_volume_shift",
    labelIt: "Plasma",
    category: "plasma_volume",
    notesIt: null,
  },
  documents: [{ sourceDb: "manual_curation", externalId: "t", title: "Test doc" }],
};

test("synthesizeEvidenceConditionedLayerV1 produce 24 punti e grafo", () => {
  const ctx: BioenergeticConditioningContextV1 = {
    athleteId: "a",
    localDate: "2026-05-10",
    timeZone: "UTC",
    training: [],
    nutrition: [],
    labAnchors: [],
    coverage: {
      training: 0.2,
      nutrition: 0.2,
      sleep: 0.25,
      lab: 0.25,
      hr_stream: 0.2,
      bia: 0,
      fluid_intake: 0.15,
      environment: 0.15,
      missingAxes: ["sleep", "bia"],
    },
  };
  const out = synthesizeEvidenceConditionedLayerV1({
    date: "2026-05-10",
    kernel: {
      insulinDemandScore: 40,
      anabolicSuppressionScore: 25,
      glucoseHandlingScore: 55,
      oxidationDriveScore: 45,
      pathwayState: "mixed",
    },
    timeline: [],
    conditioningContext: ctx,
    contextDigest: "abc",
    bankRef: { bankId: "test", bankVersion: "0" },
    resolvedEvidenceLinks: [minimalLink],
  });
  assert.equal(out.series.length, 2);
  assert.equal(out.series[0].hourlyMean24.length, 24);
  assert.ok(out.contributionGraph.nodes.length >= 4);
  assert.ok(out.contributionGraph.edges.length >= 2);
  assert.ok(
    out.contributionGraph.edges.some((e) => e.evidenceLinkId === minimalLink.linkId && e.from.startsWith("db_axis_")),
  );
});
