/**
 * EMPATHY multisport energy engine (v0.1): unifica stimoli non-cycling in potenza metabolica equivalente
 * e indici compatibili con il lab fisiologia (W, intensità relativa, substrati qualitativi).
 *
 * Non sostituisce test di laboratorio né la curva CP; fornisce **proxy operativi** per sessioni
 * senza power meter e per alimentare `metabolic_lab_runs` + motore lactato.
 */

import { estimateVo2FromDevice, type SupportedSport } from "@/lib/engines/vo2-estimator";

export type MultisportEngineSport =
  | "cycling"
  | "running"
  | "swimming"
  | "xc_ski"
  | "ski_alpine"
  | "soccer"
  | "team_court";

export type MultisportEnergyEngineInput = {
  sport: MultisportEngineSport;
  bodyMassKg: number;
  durationSec: number;
  /** Potenza meccanica misurata (ciclismo). */
  powerW?: number | null;
  /** Velocità orizzontale media (m/s). Running / sci / campo. */
  velocityMps?: number | null;
  /** Pendenza frazionaria (es. 0.02 = 2%). */
  gradeFraction?: number | null;
  /** Accelerazione media |a| (m/s²) per fattore neuromuscolare intermittente. */
  meanAbsAccelerationMps2?: number | null;
  heartRateBpm?: number | null;
  restingHrBpm?: number | null;
  maxHrBpm?: number | null;
  efficiency?: number | null;
  /** FTP ciclismo nota: ancora di intensità quando sport=cycling. */
  ftpWatts?: number | null;
  /** VO₂max da lab o profilo: ancora intensità relativa quando manca FTP. */
  vo2maxMlKgMinLab?: number | null;
};

export type MultisportEnergyEngineOutput = {
  modelVersion: "empathy-multisport-energy-v0.1";
  sport: MultisportEngineSport;
  /** Potenza metabolica meccanica equivalente prima del fattore neuromuscolare (W). */
  pMetW: number;
  neuromuscularFactor: number;
  /** Potenza dopo fattore intermittenza (W). */
  pFinalW: number;
  wKg: number;
  intensityRatio: number;
  zoneLabel: string;
  fatOxFraction01: number;
  choOxFraction01: number;
  /** g/h CHO ossidativo qualitativo (proxy). */
  choGh: number;
  fatigueScore: number;
  neuromuscularLoad01: number;
  metabolicLoad01: number;
  epi: number;
  edi: number;
  vo2MlKgMin: number;
  vo2LMin: number;
  vo2Method: string;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 2) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

function mapSportToEstimatorSport(sport: MultisportEngineSport): SupportedSport {
  if (sport === "cycling") return "cycling";
  if (sport === "swimming") return "swimming";
  if (sport === "xc_ski" || sport === "ski_alpine") return "xc_ski";
  return "running";
}

const RER_DEFAULT = 0.93;
const kcalPerLo2Default = 3.815 + 1.232 * RER_DEFAULT;

/** VO₂ (L/min) → potenza meccanica equivalente (W) a η fissata (inverso Prampero / vo2-estimator). */
function mechanicalWFromVo2(vo2LMin: number, kcalPerLO2: number, efficiency: number): number {
  const eta = clamp(efficiency, 0.18, 0.32);
  const vo2 = Math.max(0, vo2LMin);
  return (vo2 * kcalPerLO2 * 4186 * eta) / 60;
}

function vo2LMinFromMechanicalW(pWatts: number, efficiency: number, kcalPerLO2 = kcalPerLo2Default): number {
  const eta = clamp(efficiency, 0.18, 0.32);
  const p = Math.max(0, pWatts);
  return (p / eta) * 60 / (4186 * kcalPerLO2);
}

function zoneFromIntensity(r: number): string {
  if (r < 0.56) return "Z1";
  if (r < 0.76) return "Z2";
  if (r < 0.91) return "Z3";
  if (r < 1.05) return "Z4";
  return "Z5";
}

function substrateSplit(intensityRatio: number): { fat: number; cho: number } {
  if (intensityRatio < 0.75) return { fat: 0.6, cho: 0.4 };
  if (intensityRatio < 0.9) return { fat: 0.3, cho: 0.7 };
  return { fat: 0.1, cho: 0.9 };
}

function resolveIntensityRatio(input: MultisportEnergyEngineInput, pFinalW: number, vo2MlKgMin: number): number {
  if (input.sport === "cycling" && input.ftpWatts && input.ftpWatts > 40) {
    return clamp(pFinalW / input.ftpWatts, 0.28, 2.0);
  }
  if (input.vo2maxMlKgMinLab && input.vo2maxMlKgMinLab > 22 && vo2MlKgMin > 0) {
    return clamp(vo2MlKgMin / input.vo2maxMlKgMinLab, 0.35, 1.12);
  }
  const hr = input.heartRateBpm;
  const hrMax = input.maxHrBpm ?? 185;
  const hrRest = input.restingHrBpm ?? 48;
  if (hr != null && hr > hrRest + 5) {
    const denom = Math.max(8, hrMax - hrRest);
    const hrr = clamp((hr - hrRest) / denom, 0.12, 1);
    return clamp(0.42 + 0.52 * hrr, 0.38, 1.08);
  }
  return 0.72;
}

function neuromuscularFactorFromAccel(meanAbsA: number | null | undefined): number {
  if (meanAbsA == null || !Number.isFinite(meanAbsA) || meanAbsA <= 0) return 1;
  const g = 9.81;
  const bump = clamp((meanAbsA / g) * 0.18, 0, 0.38);
  return round(1 + bump, 3);
}

/**
 * Calcolo deterministico sessione / finestra: output pronto per bridge verso physiology snapshot.
 */
export function computeMultisportEnergyEngine(input: MultisportEnergyEngineInput): MultisportEnergyEngineOutput {
  const mass = clamp(input.bodyMassKg, 35, 120);
  const durationSec = Math.max(30, input.durationSec);
  const durationH = durationSec / 3600;
  const eta = clamp(input.efficiency ?? 0.24, 0.18, 0.32);
  const grade = clamp(input.gradeFraction ?? 0, -0.12, 0.22);

  let pMetW = 0;
  let vo2Method = "resting_fallback";

  if (input.sport === "cycling") {
    const p = Math.max(0, input.powerW ?? 0);
    pMetW = p > 0 ? p : 0;
    vo2Method = p > 0 ? "cycling_measured_power" : "cycling_missing_power";
  }

  const estSport = mapSportToEstimatorSport(input.sport);
  const vMps = Math.max(0, input.velocityMps ?? 0);
  const velocityMMin = vMps > 0 ? vMps * 60 : 0;
  const powerForBlend = input.sport === "cycling" ? Math.max(0, input.powerW ?? 0) : 0;

  if (pMetW <= 0 && (velocityMMin > 0 || powerForBlend > 0 || input.sport !== "cycling")) {
    const vo2 = estimateVo2FromDevice({
      sport: estSport,
      bodyMassKg: mass,
      rer: 0.93,
      efficiency: eta,
      powerW: powerForBlend > 0 ? powerForBlend : undefined,
      velocityMMin: velocityMMin > 0 ? velocityMMin : undefined,
      gradeFraction: grade,
    });
    pMetW = mechanicalWFromVo2(vo2.vo2LMin, vo2.kcalPerLO2, eta);
    vo2Method = vo2.method;
  }

  if (pMetW <= 0) {
    const restingVo2MlKg = 3.5;
    const vo2LMinRest = (restingVo2MlKg * mass) / 1000;
    pMetW = mechanicalWFromVo2(vo2LMinRest, kcalPerLo2Default, eta);
    vo2Method = "resting_mass_fallback";
  }

  const nf = neuromuscularFactorFromAccel(input.meanAbsAccelerationMps2);
  const pFinalW = round(pMetW * nf, 1);
  const wKg = round(pFinalW / mass, 2);

  const vo2LMin = vo2LMinFromMechanicalW(pFinalW, eta);
  const vo2MlKgMin = round((vo2LMin * 1000) / mass, 2);

  const intensityRatio = round(resolveIntensityRatio(input, pFinalW, vo2MlKgMin), 3);
  const zoneLabel = zoneFromIntensity(intensityRatio);
  const { fat: fatOxFraction01, cho: choOxFraction01 } = substrateSplit(intensityRatio);
  const kcalH = (pFinalW / eta) * 3.6;
  const choKcalH = kcalH * choOxFraction01;
  const choGh = round(choKcalH / 4, 1);

  const metabolicLoad01 = round(clamp(intensityRatio / 1.15, 0, 1), 3);
  const neuromuscularLoad01 = round(clamp((nf - 1) / 0.45, 0, 1), 3);
  const fatigueScore = round(clamp(intensityRatio ** 2 * durationH * 42, 0, 100), 1);

  const epi = round(
    clamp(42 * wKg + 28 * intensityRatio + 14 * (choOxFraction01 / Math.max(0.15, fatOxFraction01)), 0, 100),
    1,
  );
  const edi = round(metabolicLoad01 + 0.85 * neuromuscularLoad01 + 0.15 * clamp(fatigueScore / 100, 0, 1), 2);

  return {
    modelVersion: "empathy-multisport-energy-v0.1",
    sport: input.sport,
    pMetW: round(pMetW, 1),
    neuromuscularFactor: nf,
    pFinalW,
    wKg,
    intensityRatio,
    zoneLabel,
    fatOxFraction01,
    choOxFraction01,
    choGh,
    fatigueScore,
    neuromuscularLoad01,
    metabolicLoad01,
    epi,
    edi,
    vo2MlKgMin,
    vo2LMin: round(vo2LMin, 3),
    vo2Method,
  };
}
