import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildAcuteMealMetabolicEstimate } from "./acute-intake-metabolic-surrogate";

test("same glucose bolus: exercise has lower glucose excursion than rest", () => {
  const base = {
    athleteId: "ath-1",
    carbsIngestedG: 50,
    baselineGlucoseMmol: 5.5,
  } as const;
  const atRest = buildAcuteMealMetabolicEstimate({ ...base, activityState: "rest" });
  const inZ2 = buildAcuteMealMetabolicEstimate({ ...base, activityState: "easy" });

  assert.ok(
    inZ2.estimates.glucoseExcursionMmolBand.high < atRest.estimates.glucoseExcursionMmolBand.high,
    "expected lower glucose excursion during easy exercise",
  );
  assert.ok(
    inZ2.estimates.insulinDemandProxyRelative < atRest.estimates.insulinDemandProxyRelative,
    "expected lower insulin demand proxy during easy exercise",
  );
});

test("high intensity raises HPA drive proxy vs rest", () => {
  const rest = buildAcuteMealMetabolicEstimate({
    athleteId: "ath-1",
    carbsIngestedG: 40,
    activityState: "rest",
  });
  const high = buildAcuteMealMetabolicEstimate({
    athleteId: "ath-1",
    carbsIngestedG: 40,
    activityState: "high_intensity",
  });
  assert.ok(high.estimates.hpaDriveProxyRelative > rest.estimates.hpaDriveProxyRelative);
});

test("gut stress expands glycemic excursion band", () => {
  const lowStress = buildAcuteMealMetabolicEstimate({
    athleteId: "ath-1",
    carbsIngestedG: 60,
    activityState: "tempo",
    gutStressScorePct: 10,
  });
  const highStress = buildAcuteMealMetabolicEstimate({
    athleteId: "ath-1",
    carbsIngestedG: 60,
    activityState: "tempo",
    gutStressScorePct: 80,
  });
  assert.ok(highStress.estimates.glucoseExcursionMmolBand.high > lowStress.estimates.glucoseExcursionMmolBand.high);
  assert.ok(highStress.estimates.gutStressAdjustment > lowStress.estimates.gutStressAdjustment);
});

test("golden fixture bands remain within expected ranges", () => {
  const fixturePath = path.join(process.cwd(), "src/__fixtures__/acute-surrogate-cases.json");
  const fixtures = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Array<{
    name: string;
    input: Parameters<typeof buildAcuteMealMetabolicEstimate>[0];
    expect: { minExcursionHigh: number; maxExcursionHigh: number };
  }>;
  for (const fixture of fixtures) {
    const out = buildAcuteMealMetabolicEstimate(fixture.input);
    const high = out.estimates.glucoseExcursionMmolBand.high;
    assert.ok(
      high >= fixture.expect.minExcursionHigh && high <= fixture.expect.maxExcursionHigh,
      `${fixture.name}: high excursion ${high} outside expected range`,
    );
  }
});
