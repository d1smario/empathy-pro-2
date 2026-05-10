import test from "node:test";
import assert from "node:assert/strict";
import type { BioenergeticAxisFluidEvidenceLinkV1 } from "@empathy/contracts";
import {
  evidenceLinkCountForSkeletonEdge,
  evidenceLinkCountForSkeletonNode,
  evidenceLinkMatchesSkeletonProfile,
  EVIDENCE_MATCH_BY_SKELETON_CONTEXT_V1,
} from "@/lib/bioenergetics/bioenergetic-evidence-skeleton-bridge";

const linkHpa: BioenergeticAxisFluidEvidenceLinkV1 = {
  linkId: "L1",
  relationKind: "modulates",
  strength: "supported",
  narrativeIt: "Test",
  curatedAt: "2026-05-10T00:00:00Z",
  axis: {
    id: "a1",
    code: "axis_hpa_cortisol",
    labelIt: "HPA",
    family: "neuroendocrine",
  },
  fluidProcess: {
    id: "f1",
    code: "fluid_plasma_volume_shift",
    labelIt: "Plasma",
    category: "plasma_volume",
  },
  documents: [],
};

test("evidenceLinkMatchesSkeletonProfile: HPA matcha cortisol_acth e sleep", () => {
  assert.ok(evidenceLinkMatchesSkeletonProfile(linkHpa, EVIDENCE_MATCH_BY_SKELETON_CONTEXT_V1.cortisol_acth!));
  assert.ok(evidenceLinkMatchesSkeletonProfile(linkHpa, EVIDENCE_MATCH_BY_SKELETON_CONTEXT_V1.sleep!));
});

test("evidenceLinkCountForSkeletonEdge unisce match ai due estremi senza duplicare linkId", () => {
  const n = evidenceLinkCountForSkeletonEdge("stress_autonomic", "cortisol_acth", [linkHpa]);
  assert.equal(n, 1);
});

test("evidenceLinkCountForSkeletonNode somma link per nodo", () => {
  assert.equal(evidenceLinkCountForSkeletonNode("cortisol_acth", [linkHpa]), 1);
  assert.equal(evidenceLinkCountForSkeletonNode("ghrelin", [linkHpa]), 0);
});
