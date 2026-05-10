import test from "node:test";
import assert from "node:assert/strict";
import { somatoaxisLabFlagsFromBiomarkerRows } from "@/lib/bioenergetics/metabolic-somatoaxis-lab-flags";

test("somatoaxisLabFlagsFromBiomarkerRows rileva IGF-1 e GH nei values", () => {
  const f = somatoaxisLabFlagsFromBiomarkerRows([
    { id: "p1", values: { igf1: 210, growth_hormone: 1.2 } },
  ]);
  assert.equal(f.hasIgf1Lab, true);
  assert.equal(f.hasGhLab, true);
});

test("somatoaxisLabFlagsFromBiomarkerRows false su panel vuoto", () => {
  const f = somatoaxisLabFlagsFromBiomarkerRows([]);
  assert.equal(f.hasIgf1Lab, false);
  assert.equal(f.hasGhLab, false);
});
