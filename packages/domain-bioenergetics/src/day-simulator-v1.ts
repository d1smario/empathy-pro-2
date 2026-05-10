import {
  SIM_CORTISOL_MEAL_MOD_V1,
  SIM_DIURNAL_GLUCOSE_V1,
  SIM_DIURNAL_LACTATE_V1,
  SIM_PATHWAY_SCALE_V1,
  SIM_STRESS_V1,
} from "./sim-bank-v1";
import { activitySupportHours, mealGlycemicHourWeights24 } from "./sim-timeline-v1";
import type { SimTimelineEventV1 } from "./sim-timeline-v1";

export type SimDayKernelV1Input = {
  insulinDemandScore: number;
  anabolicSuppressionScore: number;
  glucoseHandlingScore: number;
  oxidationDriveScore: number;
  pathwayState: "supportive" | "mixed" | "inhibitory";
};

export type SimSeriesPointV1 = {
  ts: string;
  value: number;
  source: string;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Moltiplicatore su valori `simulatedLabNumeric` quando il report skeleton v1 dichiara osservabilità `partial`
 * (tile senza referto: sim attenuata, non assente come per `blocked`).
 */
export const SIM_LAB_TILE_PARTIAL_SCALE_V1 = 0.82 as const;

export function scaleSimulatedLabNumericForSkeletonPartialV1(value: number): number {
  return Math.round(1000 * value * SIM_LAB_TILE_PARTIAL_SCALE_V1) / 1000;
}

function stress01(k: SimDayKernelV1Input): number {
  const { insulinWeight, anabolicWeight, glucoseHandlingDeficitWeight, divisor } = SIM_STRESS_V1;
  return clamp(
    (insulinWeight * k.insulinDemandScore +
      anabolicWeight * k.anabolicSuppressionScore +
      glucoseHandlingDeficitWeight * (100 - k.glucoseHandlingScore)) /
      divisor,
    0,
    1,
  );
}

/** Stress 0–1 da kernel (stesso `buildSimulatedGluLacDiurnal`); esportato per synthesizer evidenza. */
export function kernelDayStress01(k: SimDayKernelV1Input): number {
  return stress01(k);
}

function pathwayScale(k: SimDayKernelV1Input): number {
  if (k.pathwayState === "inhibitory") return SIM_PATHWAY_SCALE_V1.inhibitory;
  if (k.pathwayState === "supportive") return SIM_PATHWAY_SCALE_V1.supportive;
  return SIM_PATHWAY_SCALE_V1.mixed;
}

/** Modula ampiezza risposta glicemica / catabolismo da contesto (fusione v1 → più contesto = più «motore»). */
export type SimGluLacDiurnalModulationV1 = {
  mealResponseScale01?: number;
  activityResponseScale01?: number;
};

/** Profilo glucosio/lattato 24h (1 punto/ora) da kernel + pasti (peso da CHO/kcal e orario) + finestra allenamento da durata. */
export function buildSimulatedGluLacDiurnal(
  date: string,
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
  modulation?: SimGluLacDiurnalModulationV1,
): { glucose: SimSeriesPointV1[]; lactate: SimSeriesPointV1[] } {
  const day = date.slice(0, 10);
  const mealW = mealGlycemicHourWeights24(timeline);
  const act = activitySupportHours(timeline);
  const mealScale = modulation?.mealResponseScale01 != null ? clamp(modulation.mealResponseScale01, 0.35, 1.2) : 1;
  const actScale = modulation?.activityResponseScale01 != null ? clamp(modulation.activityResponseScale01, 0.35, 1.2) : 1;
  const s = stress01(kernel);
  const gCfg = SIM_DIURNAL_GLUCOSE_V1;
  const lCfg = SIM_DIURNAL_LACTATE_V1;
  const gBase =
    gCfg.baseMmol + kernel.insulinDemandScore * gCfg.insulinLinear + s * gCfg.stressLinear;
  const lacBase =
    lCfg.baseMmol + kernel.oxidationDriveScore * lCfg.oxidationLinear + s * lCfg.stressLinear;
  const glucose: SimSeriesPointV1[] = [];
  const lactate: SimSeriesPointV1[] = [];
  for (let h = 0; h < 24; h += 1) {
    const circ = gCfg.circAmp * Math.sin(((h - gCfg.circPhaseHour) * Math.PI) / 12);
    let g = gBase + circ;
    if (mealW[h] > 0) g += gCfg.mealBumpMmol * mealW[h] * mealScale;
    if (act.has(h)) g -= gCfg.activityDipMmol * actScale;
    g = clamp(g, gCfg.clampLo, gCfg.clampHi);
    let lac = lacBase + lCfg.circAmp * Math.sin(((h - lCfg.circPhaseHour) * Math.PI) / 12);
    if (act.has(h)) lac += (lCfg.activityBumpMmol + kernel.oxidationDriveScore * lCfg.oxidationActivityK) * actScale;
    if (mealW[h] > 0) lac -= lCfg.mealDipMmol * Math.min(1.15, mealW[h] * 0.55) * mealScale;
    lac = clamp(lac, lCfg.clampLo, lCfg.clampHi);
    const ts = `${day}T${String(h).padStart(2, "0")}:12:00`;
    glucose.push({ ts, value: Math.round(g * 100) / 100, source: "sim_diurnal_v1" });
    lactate.push({ ts, value: Math.round(lac * 100) / 100, source: "sim_diurnal_v1" });
  }
  return { glucose, lactate };
}

/**
 * Valore tile quando manca il lab: ordine di grandezza deterministico da kernel + pathway.
 * `null` se tileId non supportato dalla banca v1.
 */
export function simulatedLabNumeric(tileId: string, k: SimDayKernelV1Input): number | null {
  const ps = pathwayScale(k);
  const st = stress01(k);
  const ox = clamp(k.oxidationDriveScore / 100, 0, 1);
  switch (tileId) {
    case "crp":
      return Math.round(100 * (0.62 * ps * (1 + st * 0.35))) / 100;
    case "testosterone":
      return Math.round(520 * (1 - 0.06 * ox) * (2 - ps));
    case "free_testosterone":
      return Math.round(100 * (11.5 * (1 - 0.05 * ox) * (2 - ps))) / 100;
    case "tsh":
      return Math.round(100 * (1.75 * ps * (1 + st * 0.2))) / 100;
    case "ft3":
      return Math.round(10 * (3.1 * (1 + 0.04 * ox))) / 10;
    case "ft4":
      return Math.round(100 * (1.05 * ps)) / 100;
    case "cortisol":
      return Math.round(10 * (11.5 * ps * (1 + st * 0.25))) / 10;
    case "acth":
      return Math.round(10 * (24 * ps * (1 + st * 0.15))) / 10;
    case "gh":
      return Math.round(100 * (0.55 * (1 - st * 0.2))) / 100;
    case "igf1":
      return Math.round(175 * (1 - 0.03 * st));
    case "dhea":
      return Math.round(195 * (1 - 0.04 * st));
    case "progesterone":
      return Math.round(100 * (0.55 * (2 - ps))) / 100;
    case "prolactin":
      return Math.round(10 * (9.5 * ps)) / 10;
    case "homa_ir":
      return Math.round(100 * (1.05 + k.insulinDemandScore * 0.008)) / 100;
    case "insulin_lab":
      return Math.round(10 * (7.5 + k.insulinDemandScore * 0.06)) / 10;
    case "gaba":
      return Math.round(100 * (0.48 + st * 0.12)) / 100;
    case "serotonin":
      return Math.round(100 * (0.52 + ox * 0.08)) / 100;
    case "dopamine":
      return Math.round(100 * (0.5 + ox * 0.1)) / 100;
    case "gastrin":
      return Math.round(65 + st * 18);
    case "ghrelin":
      return Math.round(420 + st * 40);
    case "leptin":
      return Math.round(10 * (1.2 + st * 0.35)) / 10;
    case "lh":
      return Math.round(10 * (4.2 * ps)) / 10;
    case "fsh":
      return Math.round(10 * (5.1 * ps)) / 10;
    case "estradiol":
      return Math.round(28 + (1 - ps) * 12);
    default:
      return null;
  }
}

/** Opzionale: modulazione educativa da pasti (stesso file `buildNominalCortisolActhHourly24`, roadmap 2.2). */
export type NominalCortisolActhModulationV1 = {
  /** 0–1 da timeline pasti (CHO/kcal); pesa `SIM_CORTISOL_MEAL_MOD_V1`. */
  postprandialMealLoad01?: number;
};

/**
 * Profili ormonali diurni nominali (24 valori/ora) per confronto temporale educativo con il pathway:
 * non sono concentrazioni da campionamento ematico seriato.
 * ACTH: impulso ipofisario più stretto e anticipato; cortisolo: risposta surrenale più larga e ritardata,
 * con modesta modulazione pomeridiana da stress — così le due serie non condividono la stessa forma normalizzata.
 */
export function buildNominalCortisolActhHourly24(
  kernel: SimDayKernelV1Input,
  mod?: NominalCortisolActhModulationV1,
): { cortisolUgdL: number[]; acthPgMl: number[] } {
  const st = stress01(kernel);
  const ps = pathwayScale(kernel);
  const meal01 = clamp(mod?.postprandialMealLoad01 ?? 0, 0, 1);
  const acthCenter = 4.5 - meal01 * SIM_CORTISOL_MEAL_MOD_V1.acthPeakAdvanceHoursMax;
  const cortisolUgdL: number[] = [];
  const acthPgMl: number[] = [];
  for (let h = 0; h < 24; h += 1) {
    const acthEnvelope = Math.exp(-0.5 * ((h - acthCenter) / 2.05) ** 2);
    const acthRaw = 8 + acthEnvelope * (32 + st * 14) * (0.92 + (ps - 1) * 0.18);
    acthPgMl.push(Math.round(clamp(acthRaw, 5, 55) * 10) / 10);

    const cortPrimary = Math.exp(-0.5 * ((h - 7.75) / 3.45) ** 2);
    const cortStressAfternoon = st * 0.38 * Math.exp(-0.5 * ((h - 14.25) / 3.1) ** 2);
    const cortMealAfternoon =
      meal01 * SIM_CORTISOL_MEAL_MOD_V1.afternoonCortisolMaxUgdL * Math.exp(-0.5 * ((h - 15.25) / 2.85) ** 2);
    const cortRaw = 3.2 + cortPrimary * (13.5 + st * 7) + cortStressAfternoon * 4.2 + (ps - 1) * 2.0 + cortMealAfternoon;
    cortisolUgdL.push(Math.round(clamp(cortRaw, 2, 26) * 10) / 10);
  }
  return { cortisolUgdL, acthPgMl };
}
