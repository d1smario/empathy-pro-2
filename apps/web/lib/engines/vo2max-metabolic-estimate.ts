/**
 * Field cycling VO2max (ml/kg/min) from Critical Power + W′ and aerobic/anaerobic split.
 *
 * Design intent (aligned with CP literature and common training-software practice — WKO5-style
 * power-duration curve, INSCYD/Aerotune-style separation of oxidative vs glycolytic lanes at a
 * given duration, without claiming their proprietary fits):
 *
 * - **Hyperbolic model** P(t) = CP + W′/t (Monod–Scherrer; Poole et al., MSSE).
 * - At **5–6 min**, mean power is **only slightly above CP** in trained cyclists (W′/t small);
 *   many platforms use this band as a **practical correlate** of maximal aerobic power / VO2max
 *   field tests (alongside shorter severe-domain points).
 * - **Aerobic share** at duration t is CP/P(t); **anaerobic rate** is W′/t. Short-interval
 *   anaerobic work does not add 1:1 to **steady O2 demand** in the same way as CP-level power;
 *   we down-weight the W′ term when estimating **oxidative-relevant** power for VO2 (γ < 1), with
 *   γ rising when the 5–6 min effort is **more aerobic** (high CP/P ratio), similar in spirit to
 *   comparing oxidative vs glycolytic contribution in metabolic profiling tools.
 *
 * Anchors retained for cross-check: FTP-line proxy (threshold fraction), CP+W′/180 s (severe domain),
 * gross-efficiency energy balance at RER ~1.
 *
 * Not a laboratory cardiopulmonary VO2max. Down-weight short-domain extrapolation when CP fit
 * confidence is low.
 */

export type MetabolicVo2maxPhenotype = "oxidative" | "balanced" | "glycolytic";

/** P(t) = CP + W′/t — duplicated here to avoid circular import with critical-power-engine. */
function powerFromCpModel(cpWatts: number, wPrimeJoules: number, durationSec: number): number {
  return cpWatts + wPrimeJoules / Math.max(0.5, durationSec);
}

export type Vo2maxMetabolicEstimateInput = {
  cpW: number;
  ftpW: number;
  wPrimeJ: number;
  bodyMassKg: number;
  efficiency: number;
  phenotype: MetabolicVo2maxPhenotype;
  fitConfidence: number;
};

export type Vo2maxMetabolicEstimateOutput = {
  vo2maxMlMinKg: number;
  vo2maxLMin: number;
  modelVersion: "empathy-vo2max-metabolic-v2";
  /** FTP / f(threshold) — legacy MAP-style proxy */
  pVo2ProxyW: number;
  /** CP + W′/180 s */
  pThreeMinW: number;
  /** CP + W′/300 s (5 min) */
  pFiveMinW: number;
  /** CP + W′/360 s (6 min) */
  pSixMinW: number;
  /** Mean of 5 and 6 min model power — primary field correlate band */
  pRef56W: number;
  /** CP / P_ref56 (oxidative fraction of model power at ~5.5 min) */
  aerobicFractionAt56: number;
  /** (W′/t_ref) / P_ref56 with t_ref = 330 s */
  anaerobicFractionAt56: number;
  /** Fraction of W′/t applied to “oxidative-relevant” power for VO2 (0–1) */
  gammaOxidativeWeight: number;
  /** CP + γ·W′/330 s — modulated power for O2-cost equations */
  pEffModulatedW: number;
  methods: {
    acsmFromPVo2ProxyMlKgMin: number;
    acsmFromP3MlKgMin: number;
    energyFromP3MlKgMin: number;
    acsmFromCpMlKgMin: number;
    acsmFromP56MeanMlKgMin: number;
    energyFromP56MeanMlKgMin: number;
    acsmFromModulatedMlKgMin: number;
    energyFromModulatedMlKgMin: number;
  };
  blendWeights: {
    wModulated: number;
    wP56: number;
    wFtpLine: number;
    wP3: number;
    wCpFloor: number;
  };
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 2) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

/** ACSM-style cycling: VO2 (ml/kg/min) ≈ 10.8·(W/kg) + 7 */
function acsmCyclingVo2MlKgMin(powerW: number, bodyMassKg: number): number {
  const wKg = clamp(bodyMassKg, 35, 120);
  const p = Math.max(0, powerW);
  return 10.8 * (p / wKg) + 7;
}

/** VO2 ml/kg/min from mechanical power, η, RER≈1 oxygen equivalent */
function vo2MlKgMinFromPowerEnergy(powerW: number, bodyMassKg: number, efficiency: number): number {
  const wKg = clamp(bodyMassKg, 35, 120);
  const eta = clamp(efficiency, 0.18, 0.32);
  const p = Math.max(0, powerW);
  const kcalPerLO2 = 3.815 + 1.232 * 1.0;
  const vo2LMin = (p / eta) * 60 / (4186 * kcalPerLO2);
  return (vo2LMin * 1000) / wKg;
}

function ftpToPVo2Fraction(phenotype: MetabolicVo2maxPhenotype): number {
  if (phenotype === "oxidative") return 0.84;
  if (phenotype === "glycolytic") return 0.78;
  return 0.81;
}

/** Harmonic-style mean duration between 5 and 6 min (seconds) */
const T_REF_56 = 2 / (1 / 300 + 1 / 360); // ≈ 327.27, use 330 for stability

export function computeVo2maxMetabolicEstimate(input: Vo2maxMetabolicEstimateInput): Vo2maxMetabolicEstimateOutput {
  const mass = clamp(input.bodyMassKg, 35, 120);
  const cp = Math.max(1, input.cpW);
  const ftp = Math.max(1, input.ftpW);
  const wPrime = Math.max(0, input.wPrimeJ);
  const eta = input.efficiency;

  const pThreeMinW = powerFromCpModel(cp, wPrime, 180);
  const pFiveMinW = powerFromCpModel(cp, wPrime, 300);
  const pSixMinW = powerFromCpModel(cp, wPrime, 360);
  const pRef56W = (pFiveMinW + pSixMinW) / 2;

  const wPrimeRateRef = wPrime / T_REF_56;
  const aerobicFractionAt56 = clamp(cp / Math.max(1, pRef56W), 0.35, 0.995);
  /** Complement of aerobic share of model power at the 5–6 min band (CP vs W′/t). */
  const anaerobicFractionAt56 = clamp(1 - aerobicFractionAt56, 0.005, 0.65);

  /**
   * γ: share of W′/t counted toward “oxidative-relevant” power in VO2 estimation.
   * High aerobic fraction (5–6 min close to CP) → γ high; sprinter-like curve → γ lower.
   */
  const phenotypeGamma =
    input.phenotype === "oxidative" ? 0.08 : input.phenotype === "glycolytic" ? -0.1 : 0;
  const gammaOxidativeWeight = clamp(
    0.34 + 0.52 * aerobicFractionAt56 + phenotypeGamma,
    0.26,
    0.88,
  );
  const pEffModulatedW = cp + gammaOxidativeWeight * wPrimeRateRef;

  const fTh = ftpToPVo2Fraction(input.phenotype);
  let pVo2ProxyW = ftp / fTh;
  pVo2ProxyW = clamp(pVo2ProxyW, ftp * 1.02, Math.max(pThreeMinW, ftp, pRef56W) * 1.35);

  const acsmFromPVo2ProxyMlKgMin = acsmCyclingVo2MlKgMin(pVo2ProxyW, mass);
  const acsmFromP3MlKgMin = acsmCyclingVo2MlKgMin(pThreeMinW, mass);
  const energyFromP3MlKgMin = vo2MlKgMinFromPowerEnergy(pThreeMinW, mass, eta);
  const acsmFromCpMlKgMin = acsmCyclingVo2MlKgMin(cp, mass);
  const acsmFromP56MeanMlKgMin = acsmCyclingVo2MlKgMin(pRef56W, mass);
  const energyFromP56MeanMlKgMin = vo2MlKgMinFromPowerEnergy(pRef56W, mass, eta);
  const acsmFromModulatedMlKgMin = acsmCyclingVo2MlKgMin(pEffModulatedW, mass);
  const energyFromModulatedMlKgMin = vo2MlKgMinFromPowerEnergy(pEffModulatedW, mass, eta);

  const conf = clamp(input.fitConfidence / 100, 0.35, 1);

  /**
   * Blend: prioritize modulated (aerobic/anaerobic-aware) and 5–6 min band; keep FTP-line and
   * 3-min severe as anchors; small CP floor for stability.
   */
  let wModulated = 0.34 + 0.22 * conf;
  let wP56 = 0.28 + 0.12 * conf * aerobicFractionAt56;
  let wFtpLine = 0.16 * (0.85 + 0.15 * conf);
  let wP3 = 0.12 * conf;
  let wCpFloor = 0.06;

  const s = wModulated + wP56 + wFtpLine + wP3 + wCpFloor;
  wModulated /= s;
  wP56 /= s;
  wFtpLine /= s;
  wP3 /= s;
  wCpFloor /= s;

  const blended =
    wModulated * (0.55 * energyFromModulatedMlKgMin + 0.45 * acsmFromModulatedMlKgMin) +
    wP56 * (0.5 * energyFromP56MeanMlKgMin + 0.5 * acsmFromP56MeanMlKgMin) +
    wFtpLine * acsmFromPVo2ProxyMlKgMin +
    wP3 * (0.55 * energyFromP3MlKgMin + 0.45 * acsmFromP3MlKgMin) +
    wCpFloor * acsmFromCpMlKgMin;

  const vo2maxMlMinKg = round(clamp(blended, 28, 92), 2);
  const vo2maxLMin = round((vo2maxMlMinKg * mass) / 1000, 3);

  return {
    vo2maxMlMinKg,
    vo2maxLMin,
    modelVersion: "empathy-vo2max-metabolic-v2",
    pVo2ProxyW: round(pVo2ProxyW, 1),
    pThreeMinW: round(pThreeMinW, 1),
    pFiveMinW: round(pFiveMinW, 1),
    pSixMinW: round(pSixMinW, 1),
    pRef56W: round(pRef56W, 1),
    aerobicFractionAt56: round(aerobicFractionAt56, 4),
    anaerobicFractionAt56: round(anaerobicFractionAt56, 4),
    gammaOxidativeWeight: round(gammaOxidativeWeight, 4),
    pEffModulatedW: round(pEffModulatedW, 1),
    methods: {
      acsmFromPVo2ProxyMlKgMin: round(acsmFromPVo2ProxyMlKgMin, 2),
      acsmFromP3MlKgMin: round(acsmFromP3MlKgMin, 2),
      energyFromP3MlKgMin: round(energyFromP3MlKgMin, 2),
      acsmFromCpMlKgMin: round(acsmFromCpMlKgMin, 2),
      acsmFromP56MeanMlKgMin: round(acsmFromP56MeanMlKgMin, 2),
      energyFromP56MeanMlKgMin: round(energyFromP56MeanMlKgMin, 2),
      acsmFromModulatedMlKgMin: round(acsmFromModulatedMlKgMin, 2),
      energyFromModulatedMlKgMin: round(energyFromModulatedMlKgMin, 2),
    },
    blendWeights: {
      wModulated: round(wModulated, 4),
      wP56: round(wP56, 4),
      wFtpLine: round(wFtpLine, 4),
      wP3: round(wP3, 4),
      wCpFloor: round(wCpFloor, 4),
    },
  };
}
