export type GutAbsorptionInput = {
  durationH: number;
  choIngestedGH: number;
  gutAbsorptionPct: number;
  microbiotaSequestrationPct: number;
  gutTrainingPct: number;
  intensityPctFtp: number;
  coreTempC?: number;
  candidaOvergrowthPct?: number;
  bifidobacteriaPct?: number;
  akkermansiaPct?: number;
  butyrateProducersPct?: number;
  endotoxinRiskPct?: number;
};

export type GutAbsorptionOutput = {
  choIngestedTotalG: number;
  choAfterAbsorptionG: number;
  microbiotaSequestrationG: number;
  choAvailableG: number;
  exogenousOxCapGH: number;
  exogenousOxidizedG: number;
  choIntoBloodstreamG: number;
  bloodDeliveryPctOfIngested: number;
  microbiotaPredationPctOfIngested: number;
  effectiveSequestrationPct: number;
  microbiotaDysbiosisScore: number;
  fermentationLoadScore: number;
  gutStressScore: number;
  pathwayRisk: "low" | "moderate" | "high";
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 3) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

export function computeGutAbsorptionEngine(input: GutAbsorptionInput): GutAbsorptionOutput {
  const durationH = Math.max(0.1, input.durationH);
  const choIngestedGH = Math.max(0, input.choIngestedGH);
  const gutAbsorptionPct = clamp(input.gutAbsorptionPct, 35, 100);
  const microbiotaSequestrationPct = clamp(input.microbiotaSequestrationPct, 0, 40);
  const gutTrainingPct = clamp(input.gutTrainingPct, 0, 100);
  const intensityPctFtp = clamp(input.intensityPctFtp, 30, 140);
  const coreTempC = input.coreTempC == null ? 37.2 : clamp(input.coreTempC, 35.5, 40.5);
  const candidaOvergrowthPct = clamp(input.candidaOvergrowthPct ?? 0, 0, 100);
  const bifidobacteriaPct = clamp(input.bifidobacteriaPct ?? 8, 0, 100);
  const akkermansiaPct = clamp(input.akkermansiaPct ?? 3, 0, 100);
  const butyrateProducersPct = clamp(input.butyrateProducersPct ?? 20, 0, 100);
  const endotoxinRiskPct = clamp(input.endotoxinRiskPct ?? 20, 0, 100);

  const choIngestedTotalG = choIngestedGH * durationH;
  const choAfterAbsorptionG = choIngestedTotalG * (gutAbsorptionPct / 100);

  // Higher intensity and core temp increase GI stress and reduce effective oxidation capacity.
  const heatStress = clamp((coreTempC - 37.8) / 1.2, 0, 1);
  const intensityStress = clamp((intensityPctFtp - 92) / 22, 0, 1);
  const gutStressScore = clamp(0.55 * heatStress + 0.45 * intensityStress, 0, 1);

  // Training improves oxidation capacity and partially protects from stress.
  const trainingFactor = 0.7 + 0.6 * (gutTrainingPct / 100);
  const stressPenalty = 1 - 0.35 * gutStressScore;
  const exogenousOxCapGH = (60 + 55 * (gutTrainingPct / 100)) * stressPenalty;

  // Family-based dysbiosis correction:
  // - high candida and endotoxin risk increase substrate predation / malabsorption pressure
  // - bifidobacteria, akkermansia and butyrate producers reduce this pressure
  const candidaPenalty = clamp((candidaOvergrowthPct - 10) / 50, 0, 1) * 12;
  const endotoxinPenalty = clamp((endotoxinRiskPct - 30) / 50, 0, 1) * 7;
  const bifidoProtection = clamp((bifidobacteriaPct - 8) / 12, 0, 1) * 5;
  const akkermansiaProtection = clamp((akkermansiaPct - 2) / 6, 0, 1) * 3;
  const butyrateProtection = clamp((butyrateProducersPct - 18) / 22, 0, 1) * 4;
  const butyrateDeficitPenalty = clamp((16 - butyrateProducersPct) / 16, 0, 1) * 3;

  // Keep baseline sequestration as a floor:
  // beneficial families should reduce dysbiosis penalties, not erase the baseline value.
  const dysbiosisDeltaPct = Math.max(
    0,
    candidaPenalty +
      endotoxinPenalty +
      butyrateDeficitPenalty -
      bifidoProtection -
      akkermansiaProtection -
      butyrateProtection,
  );
  const effectiveSequestrationPct = clamp(
    microbiotaSequestrationPct + dysbiosisDeltaPct,
    0,
    55,
  );

  const microbiotaSequestrationG = choAfterAbsorptionG * (effectiveSequestrationPct / 100);
  const choAvailableG = Math.max(0, choAfterAbsorptionG - microbiotaSequestrationG);
  const exogenousOxidizedG = Math.min(choAvailableG, exogenousOxCapGH * durationH * trainingFactor / 1.3);
  const choIntoBloodstreamG = choAvailableG;
  const bloodDeliveryPctOfIngested = choIngestedTotalG > 0 ? (choIntoBloodstreamG / choIngestedTotalG) * 100 : 0;
  const microbiotaPredationPctOfIngested = choIngestedTotalG > 0 ? (microbiotaSequestrationG / choIngestedTotalG) * 100 : 0;
  const microbiotaDysbiosisScore = clamp(
    0.45 * (candidaOvergrowthPct / 100) +
      0.25 * (endotoxinRiskPct / 100) +
      0.2 * clamp((20 - butyrateProducersPct) / 20, 0, 1) +
      0.1 * clamp((6 - bifidobacteriaPct) / 6, 0, 1),
    0,
    1.5,
  );

  // Proxy fermentation load: excess available CHO beyond oxidation ceiling + sequestration.
  const excessChoG = Math.max(0, choAvailableG - exogenousOxidizedG);
  const fermentationLoadScore = clamp(
    (excessChoG / Math.max(20, choIngestedTotalG * 0.5)) +
      gutStressScore * 0.35 +
      microbiotaDysbiosisScore * 0.25,
    0,
    1.5,
  );
  const pathwayRisk: GutAbsorptionOutput["pathwayRisk"] =
    fermentationLoadScore >= 1 ? "high" : fermentationLoadScore >= 0.55 ? "moderate" : "low";

  return {
    choIngestedTotalG: round(choIngestedTotalG),
    choAfterAbsorptionG: round(choAfterAbsorptionG),
    microbiotaSequestrationG: round(microbiotaSequestrationG),
    choAvailableG: round(choAvailableG),
    exogenousOxCapGH: round(exogenousOxCapGH),
    exogenousOxidizedG: round(exogenousOxidizedG),
    choIntoBloodstreamG: round(choIntoBloodstreamG),
    bloodDeliveryPctOfIngested: round(bloodDeliveryPctOfIngested),
    microbiotaPredationPctOfIngested: round(microbiotaPredationPctOfIngested),
    effectiveSequestrationPct: round(effectiveSequestrationPct),
    microbiotaDysbiosisScore: round(microbiotaDysbiosisScore),
    fermentationLoadScore: round(fermentationLoadScore),
    gutStressScore: round(gutStressScore),
    pathwayRisk,
  };
}

