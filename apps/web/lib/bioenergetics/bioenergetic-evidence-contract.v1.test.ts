import test from "node:test";
import assert from "node:assert/strict";
import { BIOENERGETIC_EVIDENCE_CURVE_CONTRACT_VERSION } from "@empathy/contracts";
import type {
  BioenergeticConditioningContextV1,
  BioenergeticDayEvidenceConditionedLayerV1,
  BioenergeticEvidenceConditionedSeriesV1,
} from "@empathy/contracts";

function coverageFull(): BioenergeticEvidenceConditionedSeriesV1["coverage"] {
  return {
    training: 0.8,
    nutrition: 0.7,
    sleep: 0.5,
    lab: 0.4,
    hr_stream: 0.3,
    bia: 0,
    fluid_intake: 0,
    environment: 0,
    missingAxes: ["bia", "environment"],
  };
}

function minimalSeries(): BioenergeticEvidenceConditionedSeriesV1 {
  return {
    analyteId: "glucose_proxy",
    unit: "mmol/L",
    hourlyMean24: Array.from({ length: 24 }, (_, h) => 5 + 0.01 * h),
    bankRef: { bankId: "test_bank", bankVersion: "0.0.1" },
    stratumApplied: {
      stratumId: "trained_endurance_default",
      labelIt: "Strato test",
      inclusionCriteria: ["Adulti allenati"],
      phenotypeTags: ["trained_endurance"],
      evidenceQuality: "heterogeneous_primary",
    },
    synthesisKind: "evidence_conditioned",
    contextDigest: "sha256:placeholder",
    uncertainty: {
      combinedLow24: Array.from({ length: 24 }, () => 4),
      combinedHigh24: Array.from({ length: 24 }, () => 7),
    },
    attributions: [],
    warnings: [],
    coverage: coverageFull(),
  };
}

test("BioenergeticDayEvidenceConditionedLayerV1: contractVersion e serie 24h", () => {
  const layer: BioenergeticDayEvidenceConditionedLayerV1 = {
    contractVersion: BIOENERGETIC_EVIDENCE_CURVE_CONTRACT_VERSION,
    bankRef: { bankId: "empathy_bioenergetic_evidence", bankVersion: "0.0.1" },
    series: [minimalSeries()],
    disclaimersIt: [
      "Layer evidenza condizionata: scenario da letteratura e contesto, non sostituisce misure cliniche o stream.",
    ],
  };
  assert.equal(layer.contractVersion, 1);
  assert.equal(layer.series[0].hourlyMean24.length, 24);
  assert.equal(layer.series[0].uncertainty.combinedLow24?.length, 24);
});

test("BioenergeticConditioningContextV1: round-trip shape minima", () => {
  const ctx: BioenergeticConditioningContextV1 = {
    athleteId: "athlete-test",
    localDate: "2026-05-10",
    timeZone: "Europe/Rome",
    training: [
      {
        windowId: "t1",
        startTs: "2026-05-10T07:30:00",
        durationMinutes: 60,
        tss: 55,
        intensityClass: "z1_z2",
        fuelingDeclared: true,
      },
    ],
    nutrition: [
      {
        windowId: "m1",
        startTs: "2026-05-10T08:15:00",
        carbsG: 60,
        insulinLoad: 18,
        linksToTrainingWindowIds: ["t1"],
        mealQuality: "complete_log",
      },
    ],
    labAnchors: [],
    bodyComposition: {
      measurementTs: "2026-05-10T06:45:00",
      source: "bia_device",
      ecwTbwRatio: 0.38,
      quality: "fasting_morning",
    },
  };
  assert.equal(ctx.training[0].windowId, "t1");
  assert.ok(ctx.bodyComposition?.ecwTbwRatio != null);
});
