import assert from "node:assert/strict";
import test from "node:test";

import { parseBioenergeticAiCurveProposalV1 } from "@empathy/contracts";
import { arbitrateGlucoseCurveFusionV1, mergeHourlyBioenergeticCurvesV1 } from "@empathy/domain-bioenergetics";

test("mergeHourlyBioenergeticCurvesV1 (domain) coerente con arbitration glucosio", () => {
  const resolution = arbitrateGlucoseCurveFusionV1({
    hasDenseMeasuredStream: false,
    hasSparseLabPoint: false,
    internalContextRichness01: 0.1,
  });
  const { merged, appliedAiBlend } = mergeHourlyBioenergeticCurvesV1({
    deterministicHourly: Array(24).fill(5),
    aiHourly: Array(24).fill(7),
    resolution,
  });
  assert.equal(merged.length, 24);
  assert.equal(appliedAiBlend, true);
  const v = merged[0];
  assert.ok(typeof v === "number" && v > 5 && v < 7);
});

test("parseBioenergeticAiCurveProposalV1 rifiuta mismatch channel", () => {
  const r = parseBioenergeticAiCurveProposalV1(
    {
      contractVersion: 1,
      channelId: "glucose",
      unit: "mmol/L",
      hourly24: Array.from({ length: 24 }, () => 5),
    },
    "lactate",
  );
  assert.equal(r.ok, false);
});
