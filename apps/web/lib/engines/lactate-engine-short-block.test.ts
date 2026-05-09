import test from "node:test";
import assert from "node:assert/strict";
import { computeLactateEngine } from "./lactate-engine";
import { computeGutAbsorptionEngine } from "./gut-absorption-engine";

/** Regression: blocchi <1′ non devono essere scalati a 1′ (gonfiavano energia/lattato nei merge per segmento). */
test("computeLactateEngine: 20s allo stesso W ha ~⅓ energia di 60s", () => {
  const common = {
    powerW: 300,
    ftpW: 250,
    efficiency: 0.24,
    vo2LMin: 3.2,
    rer: 0.95,
    smo2Rest: 70,
    smo2Work: 55,
    lactateOxidationPct: 55,
    coriPct: 25,
    choIngestedGH: 40,
    gutAbsorptionPct: 88,
    microbiotaSequestrationPct: 6,
    gutTrainingPct: 55,
  };

  const short = computeLactateEngine({
    ...common,
    durationMin: 20 / 60,
  });
  const oneMin = computeLactateEngine({
    ...common,
    durationMin: 1,
  });

  assert.ok(short.energyDemandKcal > 0);
  assert.ok(oneMin.energyDemandKcal > short.energyDemandKcal * 2.5);
  assert.ok(short.lactateProducedG < oneMin.lactateProducedG);
});

test("computeGutAbsorptionEngine: segmenti brevi non usano 6′ fittizi per massa CHO", () => {
  const rate = 60;
  const shortH = 20 / 3600;
  const outShort = computeGutAbsorptionEngine({
    durationH: shortH,
    choIngestedGH: rate,
    gutAbsorptionPct: 88,
    microbiotaSequestrationPct: 6,
    gutTrainingPct: 55,
    intensityPctFtp: 120,
  });
  const floorOldWouldBe = rate * 0.1;
  assert.ok(outShort.choIngestedTotalG < floorOldWouldBe * 0.5);
  assert.ok(Math.abs(outShort.choIngestedTotalG - rate * shortH) < 0.02);
});
