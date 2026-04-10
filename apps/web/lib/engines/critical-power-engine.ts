import { computeVo2maxMetabolicEstimate } from "@/lib/engines/vo2max-metabolic-estimate";
import type { Vo2maxMetabolicEstimateOutput } from "@/lib/engines/vo2max-metabolic-estimate";
import {
  buildCpWorkTimeCrossCheck,
  fitCpWorkTimeLinearModel,
} from "@/lib/engines/cp-work-time-linear-fit";
import type { CpWorkTimeLinearCrossCheck } from "@/lib/engines/cp-work-time-linear-fit";
import { defaultVo2OnsetTauSec } from "@/lib/physiology/vo2-on-kinetics";

/** Bump when CP / glycolytic proxy / VO2max blend logic changes (show in UI + snapshot JSON). */
export const METABOLIC_CP_ENGINE_REVISION = "empathy-cp-2026-03-28-canonical-worktime-truth-split";

export type MetabolicCpFitModel = "canonical-work-time" | "blended-work-hybrid" | "hybrid-2p-3p";

export type CpInputPoint = {
  sec: number;
  powerW: number;
};

export type ZoneRow = {
  name: string;
  low: number;
  high: number;
  avgW: number;
  rer: number;
  choFrac: number;
  fatFrac: number;
  kcalH: number;
  choG: number;
  fatG: number;
};

export type PowerComponentRow = {
  sec: number;
  label: string;
  modelPowerW: number;
  /** Flusso equivalente ossidativo-dominante: P − P_PCr − P_glic. */
  aerobicW: number;
  /** Somma PCr + glicolisi come in barra (può eccedere W′/t: glicolisi sostenuta a scala interpretativa). */
  anaerobicW: number;
  /** PCr con decadimento exp(−t/τ). */
  pcrW: number;
  /** Glicolisi: max(0, W′/t − P_PCr) + CP·f_parallel(t). */
  glycolyticW: number;
  aerobicPct: number;
  anaerobicPct: number;
  aerobicKJ: number;
  anaerobicKJ: number;
  pcrKJ: number;
  glycolyticKJ: number;
};

export type MetabolicProfileOutput = {
  cp: number;
  ftp: number;
  lt1: number;
  lt2: number;
  fatmax: number;
  /** Adimensional glycolytic proxy in ~[0.3, 0.8], not lab V̇La max (mmol·L⁻¹·s⁻¹). */
  vlamax: number;
  sprintReserve: number;
  wPrimeJ: number;
  pcrCapacityJ: number;
  glycolyticCapacityJ: number;
  fitR2: number;
  fitConfidence: number;
  fitModel: MetabolicCpFitModel;
  phenotype: "oxidative" | "balanced" | "glycolytic";
  substrateTable: ZoneRow[];
  powerComponents: PowerComponentRow[];
  /** Field VO2max: CP+W′ model, 5–6 min band + aerobic/anaerobic modulation (`vo2max-metabolic-estimate` v2). */
  vo2maxMlMinKg: number;
  vo2maxLMin: number;
  vo2maxEstimate: Vo2maxMetabolicEstimateOutput;
  /** W = W′ + CP·t linear fit vs hybrid CP (sanity check / outlier flag). */
  cpWorkTimeLinear: CpWorkTimeLinearCrossCheck | null;
  /** Default τ (s) for VO₂ mono-exponential onset; override when measured. */
  vo2OnsetTauSecDefault: number;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Two-parameter critical power model (Monod–Scherrer; Poole et al.): P(t) = CP + W′/t.
 * Standard plot: power vs duration (hyperbolic) or power vs 1/t (asymptote CP).
 */
export function modelPowerForDurationSec(cpWatts: number, wPrimeJoules: number, durationSec: number): number {
  const t = Math.max(0.5, durationSec);
  return cpWatts + wPrimeJoules / t;
}

/** τ ~40 s: decadimento contributo PCr (pool ~15–25 kJ). */
const PCR_KINETIC_TAU_SEC = 40;

/**
 * Quota di CP attribuibile a glicolisi aerobica / flusso parallelo a soglia (non al termine W′/t).
 * Cresce logaritmicamente con t ≥ 90 s, limitata ~14%; modulata dal fenotipo.
 */
function parallelGlycolysisFractionOfCp(
  durationSec: number,
  phenotype: "oxidative" | "balanced" | "glycolytic",
): number {
  if (durationSec < 90) return 0;
  const u = Math.log10(Math.max(durationSec, 60) / 60);
  const base = clamp(0.034 + 0.058 * u, 0, 0.118);
  const phen = phenotype === "glycolytic" ? 1.14 : phenotype === "oxidative" ? 0.9 : 1;
  return clamp(base * phen, 0, 0.14);
}

function round(v: number, digits = 3) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

function weightedLinearRegression(xs: number[], ys: number[], ws: number[]) {
  const wSum = ws.reduce((s, w) => s + w, 0);
  if (wSum <= 0 || xs.length < 2 || ys.length < 2 || ws.length < 2) {
    return { slope: 0, intercept: 0, r2: 0, rmse: Number.POSITIVE_INFINITY };
  }
  const meanX = xs.reduce((s, x, i) => s + x * ws[i], 0) / wSum;
  const meanY = ys.reduce((s, y, i) => s + y * ws[i], 0) / wSum;
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - meanX;
    cov += ws[i] * dx * (ys[i] - meanY);
    varX += ws[i] * dx * dx;
  }
  const slope = varX > 1e-9 ? cov / varX : 0;
  const intercept = meanY - slope * meanX;
  const preds = xs.map((x) => slope * x + intercept);
  const rmse = Math.sqrt(
    preds.reduce((s, p, i) => s + ws[i] * (ys[i] - p) ** 2, 0) / Math.max(1, wSum),
  );
  const ssTot = ys.reduce((s, y, i) => s + ws[i] * (y - meanY) ** 2, 0);
  const ssRes = preds.reduce((s, p, i) => s + ws[i] * (ys[i] - p) ** 2, 0);
  const r2 = ssTot > 0 ? clamp(1 - ssRes / ssTot, -1, 1) : 0;
  return { slope, intercept, r2, rmse };
}

function robustWeightedLinearRegression(
  xs: number[],
  ys: number[],
  baseWeights: number[],
  iterations = 4,
) {
  let weights = [...baseWeights];
  let fit = weightedLinearRegression(xs, ys, weights);
  for (let iter = 0; iter < iterations; iter += 1) {
    const preds = xs.map((x) => fit.slope * x + fit.intercept);
    const absResiduals = preds.map((p, i) => Math.abs(ys[i] - p));
    const medianAbsResidual =
      [...absResiduals].sort((a, b) => a - b)[Math.floor(absResiduals.length / 2)] || 1;
    const huberK = 1.345 * Math.max(1e-6, medianAbsResidual);
    weights = baseWeights.map((w, i) => {
      const r = Math.abs(ys[i] - preds[i]);
      const robust = r <= huberK ? 1 : huberK / Math.max(r, 1e-6);
      return w * robust;
    });
    fit = weightedLinearRegression(xs, ys, weights);
  }
  return fit;
}

function rerFromIntensityAndPhenotype(
  intensityPctFtp: number,
  phenotype: MetabolicProfileOutput["phenotype"],
) {
  const x = clamp(intensityPctFtp, 40, 130);
  const points = [
    { x: 40, y: 0.76 },
    { x: 55, y: 0.8 },
    { x: 70, y: 0.86 },
    { x: 80, y: 0.9 },
    { x: 90, y: 0.93 },
    { x: 100, y: 0.95 },
    { x: 108, y: 1.0 },
    { x: 120, y: 1.03 },
    { x: 130, y: 1.05 },
  ];
  let base = 0.9;
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    if (x >= left.x && x <= right.x) {
      const t = (x - left.x) / (right.x - left.x);
      base = left.y + (right.y - left.y) * t;
      break;
    }
  }
  const shift =
    phenotype === "oxidative" ? (x < 95 ? -0.022 : -0.008) :
    phenotype === "glycolytic" ? (x < 95 ? 0.018 : 0.008) : 0;
  return clamp(base + shift, 0.72, 1.06);
}

type FitCandidate = {
  cp: number;
  wPrime: number;
  r2: number;
  rmse: number;
  weight: number;
};

function fitThreeParameterCp(points: CpInputPoint[]) {
  const set = points.filter((p) => p.sec >= 30 && p.sec <= 3600 && p.powerW > 0);
  if (set.length < 4) return null;

  let best: { cp: number; wPrime: number; thetaSec: number; r2: number; rmse: number } | null = null;
  for (let thetaSec = 0; thetaSec <= 240; thetaSec += 2) {
    const xs = set.map((p) => 1 / (p.sec + thetaSec));
    const ys = set.map((p) => p.powerW);
    const ws = set.map((p) => clamp(Math.sqrt(p.sec / 90), 0.5, 2.5));
    const fit = robustWeightedLinearRegression(xs, ys, ws, 3);
    const cp = fit.intercept;
    const wPrime = fit.slope;
    if (!Number.isFinite(cp) || !Number.isFinite(wPrime) || cp <= 20 || wPrime <= 2000) continue;
    if (!best || fit.rmse < best.rmse) {
      best = { cp, wPrime, thetaSec, r2: fit.r2, rmse: fit.rmse };
    }
  }
  return best;
}

function fitCpCandidates(points: CpInputPoint[]): FitCandidate[] {
  const candidates: FitCandidate[] = [];

  const pInvTSet = points.filter((p) => p.sec >= 30 && p.sec <= 2400 && p.powerW > 0);
  if (pInvTSet.length >= 3) {
    const xs = pInvTSet.map((p) => 1 / p.sec);
    const ys = pInvTSet.map((p) => p.powerW);
    const ws = pInvTSet.map((p) => clamp(Math.sqrt(p.sec / 60), 0.55, 2.4));
    const fit = robustWeightedLinearRegression(xs, ys, ws);
    candidates.push({
      cp: fit.intercept,
      wPrime: fit.slope,
      r2: fit.r2,
      rmse: fit.rmse,
      weight: 1.0,
    });
  }

  const workSet = points.filter((p) => p.sec >= 120 && p.sec <= 2400 && p.powerW > 0);
  if (workSet.length >= 3) {
    const xs = workSet.map((p) => p.sec);
    const ys = workSet.map((p) => p.powerW * p.sec);
    const ws = workSet.map((p) => clamp(1 / Math.sqrt(p.sec / 120), 0.55, 1.7));
    const fit = robustWeightedLinearRegression(xs, ys, ws);
    candidates.push({
      cp: fit.slope,
      wPrime: fit.intercept,
      r2: fit.r2,
      rmse: fit.rmse / 100,
      weight: 0.95,
    });
  }

  const fit3p = fitThreeParameterCp(points);
  if (fit3p) {
    candidates.push({
      cp: fit3p.cp,
      wPrime: fit3p.wPrime,
      r2: fit3p.r2,
      rmse: fit3p.rmse,
      weight: 1.08,
    });
  }

  return candidates.filter(
    (c) =>
      Number.isFinite(c.cp) &&
      Number.isFinite(c.wPrime) &&
      c.cp > 20 &&
      c.wPrime > 2000 &&
      c.r2 > -0.7,
  );
}

export function computeMetabolicProfileEngine(params: {
  cpPoints: CpInputPoint[];
  bodyMassKg: number;
  efficiency?: number;
}): MetabolicProfileOutput {
  const bodyMassKg = clamp(params.bodyMassKg, 35, 120);
  const efficiency = clamp(params.efficiency ?? 0.24, 0.18, 0.3);
  const points = params.cpPoints
    .filter((p) => p.sec > 0 && p.powerW > 0)
    .sort((a, b) => a.sec - b.sec);

  const p20 = points.find((p) => p.sec === 1200)?.powerW ?? points[points.length - 1]?.powerW ?? 250;
  const p5 = points.find((p) => p.sec === 5)?.powerW ?? p20 * 1.8;
  const p15 = points.find((p) => p.sec === 15)?.powerW ?? p5 * 0.88;
  const p30 = points.find((p) => p.sec === 30)?.powerW ?? p20 * 1.45;
  const p60 = points.find((p) => p.sec === 60)?.powerW ?? p20 * 1.3;

  const candidates = fitCpCandidates(points);
  const maxPower = Math.max(...points.map((p) => p.powerW), p5);

  const weighted = candidates.reduce(
    (acc, c) => {
      const quality = clamp((c.r2 + 0.2) / 1.2, 0.05, 1.1) * c.weight;
      acc.cp += c.cp * quality;
      acc.wPrime += c.wPrime * quality;
      acc.r2 += c.r2 * quality;
      acc.rmse += c.rmse * quality;
      acc.w += quality;
      return acc;
    },
    { cp: 0, wPrime: 0, r2: 0, rmse: 0, w: 0 },
  );

  const fallbackCp = p20 * 0.97;
  const hybridCpRaw = weighted.w > 0 ? weighted.cp / weighted.w : fallbackCp;
  const hybridWPrimeRaw =
    weighted.w > 0
      ? weighted.wPrime / weighted.w
      : Math.max(6000, (Math.max(0, p180Fallback(p20) - fallbackCp) * 180));
  const hybridFitR2Raw = weighted.w > 0 ? weighted.r2 / weighted.w : 0;

  const linearFit = fitCpWorkTimeLinearModel(points);

  let cpBlendRaw = hybridCpRaw;
  let wPrimeBlendRaw = hybridWPrimeRaw;
  let fitR2Blend = hybridFitR2Raw;
  let fitModel: MetabolicCpFitModel = "hybrid-2p-3p";

  if (linearFit) {
    if (linearFit.r2 >= 0.86) {
      cpBlendRaw = linearFit.cpW;
      wPrimeBlendRaw = linearFit.wPrimeJ;
      fitR2Blend = linearFit.r2;
      fitModel = "canonical-work-time";
    } else if (linearFit.r2 >= 0.7) {
      const wLin = clamp((linearFit.r2 - 0.7) / (0.86 - 0.7), 0, 1);
      cpBlendRaw = wLin * linearFit.cpW + (1 - wLin) * hybridCpRaw;
      wPrimeBlendRaw = wLin * linearFit.wPrimeJ + (1 - wLin) * hybridWPrimeRaw;
      fitR2Blend = wLin * linearFit.r2 + (1 - wLin) * hybridFitR2Raw;
      if (wLin >= 0.85) fitModel = "canonical-work-time";
      else if (wLin <= 0.12) fitModel = "hybrid-2p-3p";
      else fitModel = "blended-work-hybrid";
    }
  }

  const maxWorkJ = points.reduce((m, p) => Math.max(m, p.powerW * p.sec), Math.max(1, p5 * 5));
  const wPrimeUpper = clamp(maxWorkJ * 1.12 - cpBlendRaw * 40, 12000, 52000);

  const cp = clamp(cpBlendRaw, 80, maxPower * 0.995);
  const wPrimeJ = clamp(wPrimeBlendRaw, 4000, wPrimeUpper);
  const fitR2 = clamp(fitR2Blend, 0, 1);

  const hasShort = points.some((p) => p.sec <= 30);
  const hasMid = points.some((p) => p.sec >= 180 && p.sec <= 720);
  const hasLong = points.some((p) => p.sec >= 1200);
  const coverageScore = (hasShort ? 1 : 0) + (hasMid ? 1 : 0) + (hasLong ? 1 : 0);
  const fitConfidence = clamp(
    Math.round(
      100 *
        (0.62 * fitR2 +
          0.23 * clamp((points.length - 3) / 6, 0, 1) +
          0.15 * (coverageScore / 3)),
    ),
    0,
    100,
  );

  const sprintReserve = Math.max(0, p5 - cp);
  const alacticFrac = clamp(
    0.27 + 0.18 * ((p5 - cp) / Math.max(1, cp)) + 0.12 * ((p15 - p30) / Math.max(1, p15)),
    0.22,
    0.62,
  );
  const pcrCapacityJ = clamp(wPrimeJ * alacticFrac, 2000, 32000);
  const glycolyticCapacityJ = clamp(wPrimeJ - pcrCapacityJ, 1200, 50000);

  const wPrimePerKg = wPrimeJ / bodyMassKg;
  const cpPerKg = cp / bodyMassKg;
  const oxidativeScore = clamp(
    0.5 * (cpPerKg / 5.4) + 0.3 * (1 - wPrimePerKg / 30) + 0.2 * (1 - sprintReserve / Math.max(350, cp * 1.3)),
    0,
    1,
  );
  const phenotype =
    oxidativeScore >= 0.62 ? "oxidative" :
    oxidativeScore <= 0.42 ? "glycolytic" : "balanced";

  const ftp = cp * 0.985;
  const lt1Factor = phenotype === "oxidative" ? 0.81 : phenotype === "glycolytic" ? 0.73 : 0.77;
  const lt2Factor = phenotype === "oxidative" ? 0.99 : phenotype === "glycolytic" ? 0.965 : 0.98;
  const fatmaxFactor = phenotype === "oxidative" ? 0.66 : phenotype === "glycolytic" ? 0.57 : 0.62;
  const lt1 = ftp * lt1Factor;
  const lt2 = cp * lt2Factor;
  const fatmax = cp * fatmaxFactor;

  /**
   * Adimensional glycolytic **proxy** in **[0.3, 0.8]**:
   * W′ glycolytic fraction, capacità glicolitica assoluta (J) e sprint vs CP (gli sprinter hanno spesso alta quota alattacida su W′, quindi serve il termine J e lo sprint).
   * Not laboratory V̇La max (mmol·L⁻¹·s⁻¹); UI must not label it as such.
   */
  const glycolyticShareOfWPrime = clamp(glycolyticCapacityJ / Math.max(1, wPrimeJ), 0, 1);
  const glycolyticJouleNorm = clamp(glycolyticCapacityJ / Math.max(11000, cp * 72), 0, 1);
  const sprintNorm = clamp(sprintReserve / Math.max(300, cp * 0.98), 0, 1);
  const glycolyticStrain = clamp(
    0.34 * glycolyticShareOfWPrime + 0.33 * glycolyticJouleNorm + 0.33 * sprintNorm,
    0,
    1,
  );
  const vlamax = 0.3 + glycolyticStrain * 0.5;

  const powerComponentDurations = [
    { sec: 60, label: "1min" },
    { sec: 180, label: "3min" },
    { sec: 300, label: "5min" },
    { sec: 1200, label: "20min" },
    { sec: 3600, label: "60min" },
  ];
  /**
   * P(t) = CP + W′/t. w′(t) = min(W′/t, 0.96·P).
   * P_PCr = min(w′, (E_PCr/t)·exp(−t/τ)).
   * P_glic = min(w′ − P_PCr + CP·f∥(t), P − P_PCr) con f∥ glicolisi parallela a soglia (log in t).
   * P_oss = P − P_PCr − P_glic. Chiusura: somma = P.
   */
  const powerComponents: PowerComponentRow[] = powerComponentDurations.map((d) => {
    const modelPowerW = modelPowerForDurationSec(cp, wPrimeJ, d.sec);
    const wPrimeTermW = clamp(wPrimeJ / d.sec, 0, modelPowerW * 0.96);
    const pcrKinetic = Math.exp(-d.sec / PCR_KINETIC_TAU_SEC);
    const pcrPowerFromPool = (pcrCapacityJ / d.sec) * pcrKinetic;
    const pcrW = Math.min(pcrPowerFromPool, wPrimeTermW);
    const fromHyperbola = Math.max(0, wPrimeTermW - pcrW);
    const parallelGlyW = cp * parallelGlycolysisFractionOfCp(d.sec, phenotype);
    const glycolyticW = Math.min(fromHyperbola + parallelGlyW, Math.max(0, modelPowerW - pcrW));
    const anaerobicW = pcrW + glycolyticW;
    const aerobicW = Math.max(0, modelPowerW - anaerobicW);
    const aerobicPct = aerobicW / Math.max(1, modelPowerW);
    const anaerobicPct = anaerobicW / Math.max(1, modelPowerW);
    return {
      sec: d.sec,
      label: d.label,
      modelPowerW: round(modelPowerW),
      aerobicW: round(aerobicW),
      anaerobicW: round(anaerobicW),
      pcrW: round(pcrW),
      glycolyticW: round(glycolyticW),
      aerobicPct: round(aerobicPct),
      anaerobicPct: round(anaerobicPct),
      aerobicKJ: round((aerobicW * d.sec) / 1000),
      anaerobicKJ: round((anaerobicW * d.sec) / 1000),
      pcrKJ: round((pcrW * d.sec) / 1000),
      glycolyticKJ: round((glycolyticW * d.sec) / 1000),
    };
  });

  const zones = [
    { name: "Z1 Recovery", low: 0.5 * cp, high: 0.65 * cp },
    { name: "Z2 Endurance", low: 0.66 * cp, high: 0.8 * cp },
    { name: "Z3 Tempo", low: 0.81 * cp, high: 0.92 * cp },
    { name: "Z4 Threshold", low: 0.93 * cp, high: 1.03 * cp },
    { name: "Z5 VO2", low: 1.04 * cp, high: 1.2 * cp },
  ];

  const substrateTable = zones.map((z) => {
    const avgW = (z.low + z.high) / 2;
    const intensityPctFtp = (avgW / Math.max(1, ftp)) * 100;
    const rer = rerFromIntensityAndPhenotype(intensityPctFtp, phenotype);
    const choFrac = clamp((rer - 0.7) / 0.3, 0.05, 0.99);
    const fatFrac = 1 - choFrac;
    const kcalH = (avgW / efficiency) * 3600 / 4184;
    const choG = (kcalH * choFrac) / 4;
    const fatG = (kcalH * fatFrac) / 9;
    return {
      name: z.name,
      low: round(z.low),
      high: round(z.high),
      avgW: round(avgW),
      rer: round(rer),
      choFrac: round(choFrac),
      fatFrac: round(fatFrac),
      kcalH: round(kcalH),
      choG: round(choG),
      fatG: round(fatG),
    };
  });

  const vo2maxEstimate = computeVo2maxMetabolicEstimate({
    cpW: round(cp),
    ftpW: round(ftp),
    wPrimeJ: round(wPrimeJ),
    bodyMassKg,
    efficiency,
    phenotype,
    fitConfidence,
  });

  const linearCross = buildCpWorkTimeCrossCheck(points, cp, wPrimeJ);
  const cpWorkTimeLinear: CpWorkTimeLinearCrossCheck | null = linearCross
    ? {
        cpW: round(linearCross.cpW),
        wPrimeJ: round(linearCross.wPrimeJ),
        r2: round(linearCross.r2, 4),
        rmseJ: round(linearCross.rmseJ),
        deltaHybridCpPct: round(linearCross.deltaHybridCpPct, 2),
        deltaHybridWPrimePct: round(linearCross.deltaHybridWPrimePct, 2),
      }
    : null;
  const vo2OnsetTauSecDefault = defaultVo2OnsetTauSec(phenotype);

  return {
    cp: round(cp),
    ftp: round(ftp),
    lt1: round(lt1),
    lt2: round(lt2),
    fatmax: round(fatmax),
    vlamax: round(vlamax),
    sprintReserve: round(sprintReserve),
    wPrimeJ: round(wPrimeJ),
    pcrCapacityJ: round(pcrCapacityJ),
    glycolyticCapacityJ: round(glycolyticCapacityJ),
    fitR2: round(fitR2),
    fitConfidence,
    fitModel,
    phenotype,
    substrateTable,
    powerComponents,
    vo2maxMlMinKg: vo2maxEstimate.vo2maxMlMinKg,
    vo2maxLMin: vo2maxEstimate.vo2maxLMin,
    vo2maxEstimate,
    cpWorkTimeLinear,
    vo2OnsetTauSecDefault,
  };
}

function p180Fallback(p20: number) {
  return p20 * 1.16;
}

/** Etichetta leggibile per il KPI Fit model (Pro2 / Physiology). */
export function labelMetabolicFitModel(m: MetabolicCpFitModel): string {
  if (m === "canonical-work-time") return "Work–time canonico (W = W′ + CP·t)";
  if (m === "blended-work-hybrid") return "Ibrido work–time + multi-fit";
  return "Multi-fit iperbolico";
}
