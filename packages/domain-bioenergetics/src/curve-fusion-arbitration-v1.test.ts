import test from "node:test";
import assert from "node:assert/strict";
import {
  arbitrateGlucoseCurveFusionV1,
  arbitrateNominalHormoneCurveFusionV1,
  computeInternalContextRichness01,
} from "./curve-fusion-arbitration-v1";

test("CGM denso: misura vince su AI", () => {
  const r = arbitrateGlucoseCurveFusionV1({
    hasDenseMeasuredStream: true,
    hasSparseLabPoint: false,
    internalContextRichness01: 0.3,
  });
  assert.equal(r.governance, "measurement_wins");
  assert.ok(r.deterministicWeight01 >= 0.95);
  assert.ok(r.aiProposalWeight01 <= 0.08);
});

test("Sim senza lab: contesto ricco → tendenza al pareggio (motore ~50%)", () => {
  const r = arbitrateGlucoseCurveFusionV1({
    hasDenseMeasuredStream: false,
    hasSparseLabPoint: false,
    internalContextRichness01: 0.85,
  });
  assert.equal(r.governance, "deterministic_engine_wins");
  assert.ok(r.deterministicWeight01 >= 0.4 && r.deterministicWeight01 <= 0.52);
  assert.ok(r.aiProposalWeight01 >= 0.48 && r.aiProposalWeight01 <= 0.6);
});

test("Sim senza lab: contesto scarso → AI in netto vantaggio su policy", () => {
  const r = arbitrateGlucoseCurveFusionV1({
    hasDenseMeasuredStream: false,
    hasSparseLabPoint: false,
    internalContextRichness01: 0.05,
  });
  assert.equal(r.governance, "ai_proposal_wins_when_available");
  assert.ok(r.deterministicWeight01 < 0.2);
  assert.ok(r.aiProposalWeight01 > 0.8);
});

test("computeInternalContextRichness01 sale con pasti e sedute", () => {
  const sparse = computeInternalContextRichness01([], 0);
  const rich = computeInternalContextRichness01(
    [
      { type: "meal", payload: { carbsG: 60 } },
      { type: "meal", payload: { carbsG: 40 } },
      { type: "executed_session" },
      { type: "device_export" },
    ],
    1,
  );
  assert.ok(rich > sparse);
});

test("Ormone nominale: contesto basso → AI in vantaggio; ricco → pareggio (cortisolo e TSH)", () => {
  const low = arbitrateNominalHormoneCurveFusionV1("cortisol", 0.05);
  assert.equal(low.governance, "ai_proposal_wins_when_available");
  assert.ok(low.aiProposalWeight01 > 0.8);
  const hi = arbitrateNominalHormoneCurveFusionV1("cortisol", 0.95);
  assert.equal(hi.governance, "deterministic_engine_wins");
  assert.ok(hi.deterministicWeight01 >= 0.44);
  const tshLow = arbitrateNominalHormoneCurveFusionV1("tsh", 0.05);
  assert.equal(tshLow.channelId, "tsh");
  assert.equal(tshLow.governance, low.governance);
  const ghrelinLow = arbitrateNominalHormoneCurveFusionV1("ghrelin", 0.05);
  assert.equal(ghrelinLow.channelId, "ghrelin");
  assert.equal(ghrelinLow.governance, low.governance);
  const leptinLow = arbitrateNominalHormoneCurveFusionV1("leptin", 0.05);
  assert.equal(leptinLow.channelId, "leptin");
  assert.equal(leptinLow.governance, low.governance);
});
