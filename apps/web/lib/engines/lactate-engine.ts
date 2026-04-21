import { computeGutAbsorptionEngine } from "./gut-absorption-engine";

export type LactateEngineInput = {
  durationMin: number;
  powerW: number;
  ftpW: number;
  efficiency: number;
  vo2LMin: number;
  vco2LMin?: number;
  rer: number;
  smo2Rest: number;
  smo2Work: number;
  lactateOxidationPct: number;
  coriPct: number;
  choIngestedGH: number;
  gutAbsorptionPct: number;
  microbiotaSequestrationPct: number;
  gutTrainingPct: number;
  coreTempC?: number;
  candidaOvergrowthPct?: number;
  bifidobacteriaPct?: number;
  akkermansiaPct?: number;
  butyrateProducersPct?: number;
  endotoxinRiskPct?: number;
  /** Glucosiemia da sensore/CGM o campione seduta (mmol/L); modula leggermente lo stress glicolitico se bassa in intenso. */
  bloodGlucoseMmolL?: number;
  /**
   * Da Metabolic Profile: CP (W) e W′ (J) per P=CP+W′/t — pressione glicolitica oltre sostenibilità a t.
   */
  cpW?: number;
  wPrimeJ?: number;
  /** Proxy glicolitico adimensionale ~[0.3, 0.8] dal motore CP (non V̇La di lab). */
  glycolyticIndexProxy?: number;
};

export type LactateEngineOutput = {
  energyDemandKcal: number;
  aerobicKcal: number;
  anaerobicKcal: number;
  intensityPctFtp: number;
  choKcal: number;
  nonChoKcal: number;
  glycolyticSharePct: number;
  glycogenCombustedGrossG: number;
  lactateProducedG: number;
  /** Lattato da glicolisi anaerobica (dominante sopra soglia). */
  lactateFromAnaerobicGlycolysisG: number;
  /** Lattato da glicolisi aerobia di fondo (quota piccola). */
  lactateFromAerobicGlycolysisG: number;
  lactateOxidizedG: number;
  lactateCoriG: number;
  lactateAccumG: number;
  /** % del prodotto ossidato (MCT / muscolo-cuore). */
  lactateFateOxidationPct: number;
  /** % del prodotto riciclato via Cori (glucosio epatico). */
  lactateFateCoriPct: number;
  /** % del prodotto che resta in accumulo netto (pool / diffusione). */
  lactateFateAccumPct: number;
  glucoseFromCoriG: number;
  coriCostKcal: number;
  glucoseNetFromCoriG: number;
  choIngestedTotalG: number;
  choAfterAbsorptionG: number;
  choAvailableG: number;
  exogenousOxidizedG: number;
  microbiotaSequestrationG: number;
  choIntoBloodstreamG: number;
  bloodDeliveryPctOfIngested: number;
  microbiotaPredationPctOfIngested: number;
  effectiveSequestrationPct: number;
  /** CHO che attraversa la parete intestinale vs ingerito (= rendimento assorbimento impostato, verificato su massa). */
  gutAbsorptionYieldPctOfIngested: number;
  microbiotaDysbiosisScore: number;
  gutStressScore: number;
  fermentationLoadScore: number;
  gutPathwayRisk: "low" | "moderate" | "high";
  glycogenCombustedNetG: number;
  glucoseRequiredForStrategyG: number;
  /** True se sono stati usati CP/W′ e/o proxy glicolitico del profilo. */
  profileMetabolicCouplingActive: boolean;
  /** 0–1: peso integrato da modello anaerobico profilo (iperbola + fenotipo). */
  profileAnaerobicModulation01: number;
  /** Eco del valore in ingresso (se valido), per UI / snapshot. */
  bloodGlucoseMmolL?: number;
  version: "lactate-engine-v1.5";
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 3) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

export function computeLactateEngine(input: LactateEngineInput): LactateEngineOutput {
  const durationMin = Math.max(1, input.durationMin);
  const durationH = durationMin / 60;
  const powerW = Math.max(0, input.powerW);
  const ftpW = Math.max(1, input.ftpW);
  const eta = clamp(input.efficiency, 0.1, 0.5);
  const vo2Input = Math.max(0.2, input.vo2LMin);
  const rer = clamp(input.rer, 0.7, 1.05);
  const smo2Rest = Math.max(1, input.smo2Rest);
  const smo2Work = Math.max(0, input.smo2Work);
  const oxidationPct = clamp(input.lactateOxidationPct, 0, 100);
  const coriPct = clamp(input.coriPct, 0, 100);
  const choIngestedGH = Math.max(0, input.choIngestedGH);
  const gutAbsorptionPct = clamp(input.gutAbsorptionPct, 35, 100);
  const microbiotaSequestrationPct = clamp(input.microbiotaSequestrationPct, 0, 30);
  const gutTrainingPct = clamp(input.gutTrainingPct, 0, 100);

  const intensityPctFtp = (powerW / ftpW) * 100;

  const bgSensor = input.bloodGlucoseMmolL;
  const bloodGlucoseMmolL =
    bgSensor != null && Number.isFinite(bgSensor) && bgSensor >= 2.2 && bgSensor <= 22 ? round(bgSensor, 2) : undefined;
  const glucoseDeficitStress01 =
    bloodGlucoseMmolL != null
      ? clamp((5.0 - bloodGlucoseMmolL) / 2.0, 0, 1) * clamp((intensityPctFtp - 70) / 50, 0, 1)
      : 0;

  // Accoppiamento Metabolic Profile: sostenibilità iperbolica + motore glicolitico dell'atleta.
  let profileAnaerobicModulation01 = 0;
  let profileMetabolicCouplingActive = false;
  const cpMet = input.cpW;
  const wPrimeJIn = input.wPrimeJ;
  const tSec = Math.max(45, durationMin * 60);
  if (
    cpMet != null &&
    Number.isFinite(cpMet) &&
    cpMet > 40 &&
    wPrimeJIn != null &&
    Number.isFinite(wPrimeJIn) &&
    wPrimeJIn > 1000
  ) {
    profileMetabolicCouplingActive = true;
    const pSust = cpMet + wPrimeJIn / tSec;
    const wPrimeRate = wPrimeJIn / tSec;
    const unsustainableW = Math.max(0, powerW - pSust);
    const unsustainNorm = clamp(unsustainableW / Math.max(50, wPrimeRate * 0.55), 0, 1.1);
    const aboveCpW = Math.max(0, powerW - cpMet);
    const glyFluxNorm = wPrimeRate > 1e-6 ? clamp(aboveCpW / wPrimeRate, 0, 1.2) : 0;
    profileAnaerobicModulation01 = clamp(0.5 * unsustainNorm + 0.38 * glyFluxNorm, 0, 1);
  }
  const glyProxy = input.glycolyticIndexProxy;
  if (glyProxy != null && Number.isFinite(glyProxy) && glyProxy >= 0.28) {
    profileMetabolicCouplingActive = true;
    const phenGlyc = clamp((glyProxy - 0.3) / 0.48, 0, 1);
    const int01 = clamp((intensityPctFtp - 55) / 70, 0, 1);
    profileAnaerobicModulation01 = clamp(
      profileAnaerobicModulation01 + 0.14 * phenGlyc + 0.1 * phenGlyc * int01,
      0,
      1.15,
    );
  }
  const profileEngineBoost = 0.2 * clamp(profileAnaerobicModulation01, 0, 1.15);

  const kcalPerL = 3.9 + 1.1 * rer;
  const energyDemandKcal = (powerW / eta) * durationMin * 60 / 4184;
  // Keep VO2 and power metabolically coherent:
  // if manual VO2 is far from power-implied VO2, softly pull it toward expected.
  const expectedVo2FromPower = ((powerW / eta) * 60 / 4184) / kcalPerL;
  const vo2GapRatio = Math.abs(vo2Input - expectedVo2FromPower) / Math.max(0.25, expectedVo2FromPower);
  const vo2InputTrust = clamp(1 - vo2GapRatio / 0.25, 0, 0.9);
  const vo2Effective = expectedVo2FromPower * (1 - vo2InputTrust) + vo2Input * vo2InputTrust;
  const aerobicPotentialKcal = vo2Effective * durationMin * kcalPerL;

  const smo2Drop = clamp((smo2Rest - smo2Work) / smo2Rest, 0, 0.9);
  const oxygenGapShare = clamp((energyDemandKcal - aerobicPotentialKcal) / Math.max(1, energyDemandKcal), 0, 0.6);
  const intensityStress = Math.max(0, (intensityPctFtp - 88) / 30);
  const smo2Stress = Math.max(0, (smo2Drop - 0.22) / 0.35);
  const rerStress = Math.max(0, (rer - 0.92) / 0.12);
  const anaerobicShareRaw =
    0.55 * oxygenGapShare +
    0.2 * intensityStress +
    0.15 * smo2Stress +
    0.1 * rerStress +
    profileEngineBoost;
  const anaerobicShare =
    intensityPctFtp >= 115
      ? clamp(Math.max(0.14, anaerobicShareRaw), 0.12, 0.5)
      : intensityPctFtp >= 100
        ? clamp(Math.max(0.08, anaerobicShareRaw), 0.06, 0.35)
        : intensityPctFtp >= 90
          ? clamp(Math.max(0.03, anaerobicShareRaw), 0.02, 0.22)
          : clamp(anaerobicShareRaw, 0, 0.14);

  const anaerobicKcal = energyDemandKcal * anaerobicShare;
  const aerobicKcal = Math.min(aerobicPotentialKcal, Math.max(0, energyDemandKcal - anaerobicKcal));

  // Frayn (non-protein) substrate oxidation equations from gas exchange:
  // CHO g/min = 4.210*VCO2 - 2.962*VO2
  // FAT g/min = 1.695*VO2 - 1.701*VCO2
  const vco2 = Math.max(0, input.vco2LMin ?? (vo2Effective * rer));
  const choGMinFromGas = Math.max(0, 4.21 * vco2 - 2.962 * vo2Effective);
  const fatGMinFromGas = Math.max(0, 1.695 * vo2Effective - 1.701 * vco2);
  const choKcalMinFromGas = choGMinFromGas * 4;
  const fatKcalMinFromGas = fatGMinFromGas * 9;
  const substrateKcalMin = choKcalMinFromGas + fatKcalMinFromGas;
  const choShareFromGas =
    substrateKcalMin > 0
      ? clamp(choKcalMinFromGas / substrateKcalMin, 0.05, 0.98)
      : clamp((rer - 0.7) / 0.3, 0.05, 0.98);

  const glycolyticRaw =
    0.18 +
    0.34 * Math.max(0, (intensityPctFtp - 70) / 50) +
    0.2 * Math.max(0, (rer - 0.82) / 0.2) +
    0.22 * anaerobicShare +
    0.12 * smo2Drop +
    0.07 * glucoseDeficitStress01;
  const glycolyticFloor =
    intensityPctFtp >= 120 ? 0.98 :
    intensityPctFtp >= 108 ? 0.97 :
    intensityPctFtp >= 100 ? 0.92 :
    intensityPctFtp >= 90 ? 0.85 :
    // Keep tempo / high-aerobic work carbohydrate-biased, but still
    // allow VO2/VCO2-derived substrate shifts to move the final share.
    intensityPctFtp >= 80 ? 0.76 :
    intensityPctFtp >= 70 ? 0.5 : 0.25;
  const glycolyticShareBlended = 0.75 * choShareFromGas + 0.25 * glycolyticRaw;
  const glycolyticShare = clamp(Math.max(glycolyticShareBlended, glycolyticFloor), 0.18, 0.99);
  const choKcal = energyDemandKcal * glycolyticShare;
  const nonChoKcal = Math.max(0, energyDemandKcal - choKcal);
  const glycogenCombustedGrossG = choKcal / 4;

  // Lactate production should primarily follow anaerobic glycolytic flux,
  // with a smaller background from aerobic glycolysis.
  const anaerobicChoFluxG = (anaerobicKcal / 4) * 0.92;
  const yieldAthleteScale =
    1 +
    0.14 *
      clamp(profileAnaerobicModulation01, 0, 1) *
      clamp(((glyProxy ?? 0.52) - 0.32) / 0.38, 0, 1);
  const lactateYieldAnaerobic = clamp(
    (0.35 +
      0.45 * Math.max(0, (intensityPctFtp - 92) / 35) +
      0.25 * smo2Stress +
      0.2 * rerStress) *
      yieldAthleteScale,
    0.22,
    0.95,
  );
  const aerobicBackgroundFrac = clamp(
    0.04 + 0.08 * Math.max(0, (intensityPctFtp - 85) / 25),
    0.02,
    0.14,
  );
  const lactateFromAnaerobicGlycolysisG = anaerobicChoFluxG * lactateYieldAnaerobic;
  const lactateFromAerobicGlycolysisG = glycogenCombustedGrossG * aerobicBackgroundFrac;
  const lactateProducedG = lactateFromAnaerobicGlycolysisG + lactateFromAerobicGlycolysisG;

  const oxFracRaw = oxidationPct / 100;
  const coriFracRaw = coriPct / 100;
  const fracScale = oxFracRaw + coriFracRaw > 0.98 ? 0.98 / (oxFracRaw + coriFracRaw) : 1;
  const oxFrac = oxFracRaw * fracScale;
  const coriFrac = coriFracRaw * fracScale;
  const lactateOxidizedG = lactateProducedG * oxFrac;
  const lactateCoriG = lactateProducedG * coriFrac;
  const lactateAccumG = Math.max(0, lactateProducedG - lactateOxidizedG - lactateCoriG);

  // Cori cycle: 2 lactate -> 1 glucose molar; mass conversion approx 1:1.
  const glucoseFromCoriG = lactateCoriG;
  // 6 ATP/glucose from lactate; simplified energetic penalty in kcal.
  const coriCostKcal = glucoseFromCoriG * 0.75;
  const glucoseNetFromCoriG = Math.max(0, glucoseFromCoriG - coriCostKcal / 4);

  const gutModel = computeGutAbsorptionEngine({
    durationH,
    choIngestedGH,
    gutAbsorptionPct,
    microbiotaSequestrationPct,
    gutTrainingPct,
    intensityPctFtp,
    coreTempC: input.coreTempC,
    candidaOvergrowthPct: input.candidaOvergrowthPct,
    bifidobacteriaPct: input.bifidobacteriaPct,
    akkermansiaPct: input.akkermansiaPct,
    butyrateProducersPct: input.butyrateProducersPct,
    endotoxinRiskPct: input.endotoxinRiskPct,
  });
  const choAvailableG = gutModel.choAvailableG;
  const exogenousOxidizedG = gutModel.exogenousOxidizedG;

  const glycogenCombustedNetG = Math.max(0, glycogenCombustedGrossG - exogenousOxidizedG - glucoseNetFromCoriG);
  const glucoseRequiredForStrategyG = Math.max(0, glycogenCombustedGrossG - glucoseNetFromCoriG);

  const lp = Math.max(1e-9, lactateProducedG);
  const lactateFateOxidationPct = round((lactateOxidizedG / lp) * 100, 1);
  const lactateFateCoriPct = round((lactateCoriG / lp) * 100, 1);
  const lactateFateAccumPct = round((lactateAccumG / lp) * 100, 1);
  const gutAbsorptionYieldPctOfIngested =
    gutModel.choIngestedTotalG > 0
      ? round((gutModel.choAfterAbsorptionG / gutModel.choIngestedTotalG) * 100, 1)
      : 0;

  return {
    energyDemandKcal: round(energyDemandKcal),
    aerobicKcal: round(aerobicKcal),
    anaerobicKcal: round(anaerobicKcal),
    intensityPctFtp: round(intensityPctFtp),
    choKcal: round(choKcal),
    nonChoKcal: round(nonChoKcal),
    glycolyticSharePct: round(glycolyticShare * 100),
    glycogenCombustedGrossG: round(glycogenCombustedGrossG),
    lactateProducedG: round(lactateProducedG),
    lactateFromAnaerobicGlycolysisG: round(lactateFromAnaerobicGlycolysisG),
    lactateFromAerobicGlycolysisG: round(lactateFromAerobicGlycolysisG),
    lactateOxidizedG: round(lactateOxidizedG),
    lactateCoriG: round(lactateCoriG),
    lactateAccumG: round(lactateAccumG),
    lactateFateOxidationPct,
    lactateFateCoriPct,
    lactateFateAccumPct,
    glucoseFromCoriG: round(glucoseFromCoriG),
    coriCostKcal: round(coriCostKcal),
    glucoseNetFromCoriG: round(glucoseNetFromCoriG),
    choIngestedTotalG: round(gutModel.choIngestedTotalG),
    choAfterAbsorptionG: round(gutModel.choAfterAbsorptionG),
    choAvailableG: round(choAvailableG),
    exogenousOxidizedG: round(exogenousOxidizedG),
    microbiotaSequestrationG: round(gutModel.microbiotaSequestrationG),
    choIntoBloodstreamG: round(gutModel.choIntoBloodstreamG),
    bloodDeliveryPctOfIngested: round(gutModel.bloodDeliveryPctOfIngested),
    gutAbsorptionYieldPctOfIngested,
    microbiotaPredationPctOfIngested: round(gutModel.microbiotaPredationPctOfIngested),
    effectiveSequestrationPct: round(gutModel.effectiveSequestrationPct),
    microbiotaDysbiosisScore: round(gutModel.microbiotaDysbiosisScore),
    gutStressScore: round(gutModel.gutStressScore),
    fermentationLoadScore: round(gutModel.fermentationLoadScore),
    gutPathwayRisk: gutModel.pathwayRisk,
    glycogenCombustedNetG: round(glycogenCombustedNetG),
    glucoseRequiredForStrategyG: round(glucoseRequiredForStrategyG),
    profileMetabolicCouplingActive,
    profileAnaerobicModulation01: round(clamp(profileAnaerobicModulation01, 0, 1.2), 3),
    ...(bloodGlucoseMmolL != null ? { bloodGlucoseMmolL } : {}),
    version: "lactate-engine-v1.5",
  };
}
