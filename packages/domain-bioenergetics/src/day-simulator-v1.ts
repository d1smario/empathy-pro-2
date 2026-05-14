import { applyCgmLikeSurfaceToSubhourlyGluLac } from "./cgm-surface-realism-v1";
import { buildInsulinStimulusPredictorSubhourlyV1 } from "./insulin-proxy-hourly-v1";
import {
  SIM_CORTISOL_MEAL_MOD_V1,
  SIM_DIURNAL_GLUCOSE_V1,
  SIM_DIURNAL_LACTATE_V1,
  SIM_PATHWAY_SCALE_V1,
  SIM_STRESS_V1,
} from "./sim-bank-v1";
import {
  activitySupportHours,
  activityStepIntensity01V2,
  mealGlycemicHourWeights24,
  mealGlycemicStepImpulseV2,
} from "./sim-timeline-v1";
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
    const circ = glucoseCircadianSleepDayEnvelopeMmol(h + 0.5, mealScale, gCfg.circAmp);
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

/** Sorgente serie diurna ad alta risoluzione (solo modello; non sostituisce misura device). */
export const SIM_DIURNAL_SUBHOURLY_SOURCE_PREFIX = "sim_diurnal_v1_" as const;

/** Versione contratto predittore glucosio da stimoli (pasto + attività + involucro circadiano). */
export const GLUCOSE_STIMULUS_PREDICTOR_CONTRACT_VERSION = 1 as const;

/** Prefisso `source` punti glucosio prodotti dal predittore (dopo superficie CGM-like resta invariato). */
export const GLUCOSE_STIMULUS_PREDICTOR_SOURCE_PREFIX = "glucose_stimulus_predictor_v1_" as const;

export type GlucoseStimulusPriorTopicV1 =
  | "postprandial_impulse_shape"
  | "gi_load_amplification"
  | "activity_muscle_clearance"
  | "circadian_sleep_envelope";

export type GlucoseStimulusLiteratureManifestEntryV1 = {
  id: string;
  topicIt: string;
  appliesTo: GlucoseStimulusPriorTopicV1;
  /** DOI/PMC quando versionati; vuoto = placeholder roadmap (coefficienti ancora in `sim-bank-v1`). */
  refs: readonly string[];
};

/**
 * Prior letteratura v1 (metadati): i numeri operativi vivono in `SIM_DIURNAL_GLUCOSE_V1` / timeline;
 * qui solo tracciabilità dominio per estensioni future senza LLM nel loop numerico.
 */
export const PRED_GLUCOSE_STIMULI_LITERATURE_MANIFEST_V1: readonly GlucoseStimulusLiteratureManifestEntryV1[] = [
  {
    id: "cgm_postprandial_timing_v1",
    topicIt: "Timing e forma risposta post-prandiale (CGM popolazioni sane/atleti).",
    appliesTo: "postprandial_impulse_shape",
    refs: [],
  },
  {
    id: "gi_glycemic_load_v1",
    topicIt: "Carico glicemico e IG in pasti misti (scaling impulso pasto).",
    appliesTo: "gi_load_amplification",
    refs: [],
  },
  {
    id: "exercise_glucose_clearance_v1",
    topicIt: "Dip glicemico durante esercizio (clearance muscolo-dominated).",
    appliesTo: "activity_muscle_clearance",
    refs: [],
  },
  {
    id: "sleep_wake_circadian_v1",
    topicIt: "Involucro circadiano veglia/sonno senza rampa notturna artificiale.",
    appliesTo: "circadian_sleep_envelope",
    refs: [],
  },
] as const;

export function glucoseStimulusPredictorSourceV1(stepMinutes: 5 | 10): string {
  return `${GLUCOSE_STIMULUS_PREDICTOR_SOURCE_PREFIX}${stepMinutes}m`;
}

/**
 * Predittore deterministico glucosio a passo 5/10 min da kernel + timeline (impulsi pasto + attività)
 * e involucro circadiano. Stessa matematica usata da `buildSimulatedGluLacDiurnalSubHourly` per il ramo glucosio.
 */
export function buildGlucoseStimulusPredictorSubhourlyV1(
  date: string,
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
  modulation: SimGluLacDiurnalModulationV1 | undefined,
  stepMinutes: 5 | 10,
): SimSeriesPointV1[] {
  const day = date.slice(0, 10);
  if (stepMinutes !== 5 && stepMinutes !== 10) {
    throw new Error("buildGlucoseStimulusPredictorSubhourlyV1: stepMinutes must be 5 or 10");
  }
  const mealScale = modulation?.mealResponseScale01 != null ? clamp(modulation.mealResponseScale01, 0.35, 1.2) : 1;
  const actScale = modulation?.activityResponseScale01 != null ? clamp(modulation.activityResponseScale01, 0.35, 1.2) : 1;
  const s = stress01(kernel);
  const gCfg = SIM_DIURNAL_GLUCOSE_V1;
  const gBase = gCfg.baseMmol + kernel.insulinDemandScore * gCfg.insulinLinear + s * gCfg.stressLinear;
  const steps = (24 * 60) / stepMinutes;
  const gSrc = glucoseStimulusPredictorSourceV1(stepMinutes);
  const mealI = mealGlycemicStepImpulseV2(steps, stepMinutes, timeline);
  const actI = activityStepIntensity01V2(steps, stepMinutes, timeline);
  const glucose: SimSeriesPointV1[] = [];

  for (let i = 0; i < steps; i += 1) {
    const tStart = i * stepMinutes;
    const hh = Math.floor(tStart / 60) % 24;
    const mm = tStart % 60;
    const fhMid = (tStart + stepMinutes / 2) / 60;

    const mw = mealI[i] ?? 0;
    const aInt = actI[i] ?? 0;

    const circG = glucoseCircadianSleepDayEnvelopeMmol(fhMid, mealScale, gCfg.circAmp);
    let g = gBase + circG;
    if (mw > 0) g += gCfg.mealBumpMmol * mw * mealScale;
    if (aInt > 0) g -= gCfg.activityDipMmol * actScale * (0.5 * aInt + 0.5 * aInt * aInt);
    const jitterG =
      Math.sin(fhMid * 6.2 + day.length * 0.13) * 0.048 * mealScale + Math.cos((tStart % 60) * 0.21) * 0.015;
    g = clamp(g + jitterG, gCfg.clampLo, gCfg.clampHi);

    const ts = `${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
    glucose.push({ ts, value: Math.round(g * 1000) / 1000, source: gSrc });
  }
  return glucose;
}

/** Versione contratto predittore lattato da stimoli (pasto + attività + circadiano lieve). */
export const LACTATE_STIMULUS_PREDICTOR_CONTRACT_VERSION = 1 as const;

/** Prefisso `source` punti lattato prodotti dal predittore (dopo superficie CGM-like resta invariato). */
export const LACTATE_STIMULUS_PREDICTOR_SOURCE_PREFIX = "lactate_stimulus_predictor_v1_" as const;

export type LactateStimulusPriorTopicV1 =
  | "exercise_lactate_release"
  | "postprandial_relative_suppression"
  | "diurnal_circadian_oscillation";

export type LactateStimulusLiteratureManifestEntryV1 = {
  id: string;
  topicIt: string;
  appliesTo: LactateStimulusPriorTopicV1;
  refs: readonly string[];
};

/**
 * Prior letteratura v1 (metadati): coefficienti operativi in `SIM_DIURNAL_LACTATE_V1` / timeline;
 * tracciabilità dominio senza LLM nel loop numerico.
 */
export const PRED_LACTATE_STIMULI_LITERATURE_MANIFEST_V1: readonly LactateStimulusLiteratureManifestEntryV1[] = [
  {
    id: "blood_lactate_exercise_transient_v1",
    topicIt: "Lattato ematico in esercizio prolungato / sotto-soglia vs sopra-soglia (scaling intensità).",
    appliesTo: "exercise_lactate_release",
    refs: [],
  },
  {
    id: "meal_metabolic_shift_lactate_v1",
    topicIt: "Modulazione relativa post-prandiale (dip da carico glicemico operativo nel modello).",
    appliesTo: "postprandial_relative_suppression",
    refs: [],
  },
  {
    id: "circadian_ultradian_lactate_proxy_v1",
    topicIt: "Oscillazione diurna leggera (proxy educativo, non ritmo notturno misurato).",
    appliesTo: "diurnal_circadian_oscillation",
    refs: [],
  },
] as const;

export function lactateStimulusPredictorSourceV1(stepMinutes: 5 | 10): string {
  return `${LACTATE_STIMULUS_PREDICTOR_SOURCE_PREFIX}${stepMinutes}m`;
}

/**
 * Predittore deterministico lattato a passo 5/10 min da kernel + timeline (stessi impulsi pasto/attività del glucosio).
 * Stessa matematica usata da `buildSimulatedGluLacDiurnalSubHourly` per il ramo lattato.
 */
export function buildLactateStimulusPredictorSubhourlyV1(
  date: string,
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
  modulation: SimGluLacDiurnalModulationV1 | undefined,
  stepMinutes: 5 | 10,
): SimSeriesPointV1[] {
  const day = date.slice(0, 10);
  if (stepMinutes !== 5 && stepMinutes !== 10) {
    throw new Error("buildLactateStimulusPredictorSubhourlyV1: stepMinutes must be 5 or 10");
  }
  const mealScale = modulation?.mealResponseScale01 != null ? clamp(modulation.mealResponseScale01, 0.35, 1.2) : 1;
  const actScale = modulation?.activityResponseScale01 != null ? clamp(modulation.activityResponseScale01, 0.35, 1.2) : 1;
  const s = stress01(kernel);
  const lCfg = SIM_DIURNAL_LACTATE_V1;
  const lacBase = lCfg.baseMmol + kernel.oxidationDriveScore * lCfg.oxidationLinear + s * lCfg.stressLinear;
  const steps = (24 * 60) / stepMinutes;
  const lSrc = lactateStimulusPredictorSourceV1(stepMinutes);
  const mealI = mealGlycemicStepImpulseV2(steps, stepMinutes, timeline);
  const actI = activityStepIntensity01V2(steps, stepMinutes, timeline);
  const lactate: SimSeriesPointV1[] = [];

  for (let i = 0; i < steps; i += 1) {
    const tStart = i * stepMinutes;
    const hh = Math.floor(tStart / 60) % 24;
    const mm = tStart % 60;
    const fhMid = (tStart + stepMinutes / 2) / 60;

    const mw = mealI[i] ?? 0;
    const aInt = actI[i] ?? 0;

    const circL = lCfg.circAmp * Math.sin(((fhMid - lCfg.circPhaseHour) * Math.PI) / 12);
    let lac = lacBase + circL;
    if (aInt > 0) {
      const lt = aInt * actScale;
      lac += (lCfg.activityBumpMmol + kernel.oxidationDriveScore * lCfg.oxidationActivityK) * (0.22 + 0.78 * lt);
    }
    if (mw > 0) lac -= lCfg.mealDipMmol * Math.min(1.15, mw * 0.55) * mealScale;
    const jitterL = Math.sin(fhMid * 5.1 + 1.7) * 0.028 * actScale + Math.sin((tStart % 55) * 0.17) * 0.009;
    lac = clamp(lac + jitterL, lCfg.clampLo, lCfg.clampHi);

    const ts = `${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
    lactate.push({ ts, value: Math.round(lac * 1000) / 1000, source: lSrc });
  }
  return lactate;
}

/**
 * Soppressione notturna 0–1: cresce da sera tarda a mezzanotte e decade verso le 6:30,
 * senza la risalita artificiale 22→4 del vecchio sin((h−4)·π/12) (che alzava il glucosio tutta la notte).
 */
function glucoseSleepSuppression01(fh: number): number {
  const f = ((fh % 24) + 24) % 24;
  if (f >= 21.5) return clamp((f - 21.5) / 2.5, 0, 1);
  if (f < 6.5) return clamp((6.5 - f) / 6.5, 0, 1);
  return 0;
}

/**
 * Envelope circadiano glucosio (solo modello educativo): notte stabile/basso, niente rampa notturna lunga;
 * alba breve in veglia precoce; giorno onda morbida centrata ~14h. Pasti restano sugli impulsi `mealI`.
 */
export function glucoseCircadianSleepDayEnvelopeMmol(
  fh: number,
  mealScale: number,
  circAmp: number,
): number {
  const f = ((fh % 24) + 24) % 24;
  let d = -0.22 * glucoseSleepSuppression01(f);
  if (f >= 6 && f < 8.25) {
    const t = clamp((f - 6) / 2.25, 0, 1);
    d += 0.07 * Math.sin(Math.PI * t) * (0.45 + 0.55 * mealScale);
  }
  if (f >= 8.25 && f < 21.25) {
    d += circAmp * 0.68 * Math.sin(((f - 14) * Math.PI) / 12);
  }
  return d;
}

/**
 * Glucosio/lattato con passo 5 o 10 min: impulsi pasto centrati al minuto (CHO+IG), allenamento su finestra
 * start+durata con ramp; glucosio con involucro circadiano alba/sonno (`buildGlucoseStimulusPredictorSubhourlyV1`),
 * lattato con modello attività/pasto (`buildLactateStimulusPredictorSubhourlyV1`). Superficie CGM-like condivisa.
 * Domanda insulinica proxy (`buildInsulinStimulusPredictorSubhourlyV1`) stesso passo — **non** passa dalla superficie CGM (scala 0–100).
 */
export function buildSimulatedGluLacDiurnalSubHourly(
  date: string,
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
  modulation: SimGluLacDiurnalModulationV1 | undefined,
  stepMinutes: 5 | 10,
): { glucose: SimSeriesPointV1[]; lactate: SimSeriesPointV1[]; insulinProxy: SimSeriesPointV1[] } {
  const day = date.slice(0, 10);
  if (stepMinutes !== 5 && stepMinutes !== 10) {
    throw new Error("buildSimulatedGluLacDiurnalSubHourly: stepMinutes must be 5 or 10");
  }
  const gCfg = SIM_DIURNAL_GLUCOSE_V1;
  const lCfg = SIM_DIURNAL_LACTATE_V1;
  const glucose = buildGlucoseStimulusPredictorSubhourlyV1(date, kernel, timeline, modulation, stepMinutes);
  const lactate = buildLactateStimulusPredictorSubhourlyV1(date, kernel, timeline, modulation, stepMinutes);
  const insulinProxyRaw = buildInsulinStimulusPredictorSubhourlyV1(day, kernel, timeline, stepMinutes);
  const insulinProxy: SimSeriesPointV1[] = insulinProxyRaw.map((p) => ({
    ts: p.ts,
    value: p.value,
    source: p.source,
  }));
  const { glucose: gOut, lactate: lOut } = applyCgmLikeSurfaceToSubhourlyGluLac({
    glucose,
    lactate,
    date: day,
    kernel,
    glucoseClamp: { lo: gCfg.clampLo, hi: gCfg.clampHi },
    lactateClamp: { lo: lCfg.clampLo, hi: lCfg.clampHi },
  });
  return { glucose: gOut, lactate: lOut, insulinProxy };
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
    const cortRaw = 3.2 + cortPrimary * (13.5 + st * 7) + cortStressAfternoon * 4.2 + (ps - 1) * 2.0 + cortMealAfternoon * 1.22;
    cortisolUgdL.push(Math.round(clamp(cortRaw, 2, 26) * 10) / 10);
  }
  return { cortisolUgdL, acthPgMl };
}

/**
 * Profili nominali TSH / FT4 (24 valori/ora) ancorati a `simulatedLabNumeric` per lo stesso kernel:
 * modulazione diurna **solo educativa** (non sostituisce campionamento ematico seriato né monitoraggio tiroideo denso).
 */
export function buildNominalThyroidTshFt4Hourly24(kernel: SimDayKernelV1Input): {
  tshMiuL: number[];
  ft4NgDl: number[];
} {
  const tsh0 = simulatedLabNumeric("tsh", kernel) ?? 1.75;
  const ft40 = simulatedLabNumeric("ft4", kernel) ?? 1.05;
  const tshMiuL: number[] = [];
  const ft4NgDl: number[] = [];
  for (let h = 0; h < 24; h += 1) {
    const phase = ((h - 3 + 24) % 24) * (Math.PI / 12);
    const tshMod = 1 + 0.07 * Math.cos(phase);
    const tshRaw = tsh0 * tshMod;
    tshMiuL.push(Math.round(clamp(tshRaw, 0.2, 10) * 100) / 100);
    const ft4Mod = 1 + 0.045 * Math.sin(phase - 0.4);
    const ft4Raw = ft40 * ft4Mod;
    ft4NgDl.push(Math.round(clamp(ft4Raw, 0.35, 3.5) * 100) / 100);
  }
  return { tshMiuL, ft4NgDl };
}

/**
 * Profili nominali GH / ghrelina (24 ore) educativi: ancoraggio `simulatedLabNumeric` + timeline pasti
 * (`mealGlycemicHourWeights24`) e ore seduta (`activitySupportHours`). Non sostituisce profili pulsatile GH da
 * campionamento seriato né dosaggi ghrelina seriali.
 */
export function buildNominalGhGhrelinHourly24(
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
): { ghNgMl: number[]; ghrelinPgMl: number[] } {
  const st = stress01(kernel);
  const mealW = mealGlycemicHourWeights24(timeline);
  const actH = activitySupportHours(timeline);
  const gh0 = simulatedLabNumeric("gh", kernel) ?? 0.55;
  const ghr0 = simulatedLabNumeric("ghrelin", kernel) ?? 420;
  const ghNgMl: number[] = [];
  const ghrelinPgMl: number[] = [];

  for (let h = 0; h < 24; h += 1) {
    const postMeal01 = clamp(mealW[h] / 1.35, 0, 1);
    const circGhr = 1 + 0.055 * Math.cos(((h - 1 + 24) % 24) * (Math.PI / 12));
    const ghrRaw = ghr0 * circGhr * (0.52 + 0.48 * (1 - postMeal01 * 0.9));
    ghrelinPgMl.push(Math.round(clamp(ghrRaw, 65, 980)));

    const b1 = Math.exp(-0.5 * ((h - 1.1) / 0.78) ** 2);
    const b2 = Math.exp(-0.5 * ((h - 6.8) / 0.82) ** 2);
    const b3 = Math.exp(-0.5 * ((h - 12.4) / 0.75) ** 2);
    const b4 = Math.exp(-0.5 * ((h - 22.2) / 0.88) ** 2);
    let burst = b1 + b2 + b3 + b4;
    if (actH.has(h)) burst *= 1.14;
    const mealSuppGh = clamp(mealW[h] / 1.6, 0, 1);
    const ghRaw = gh0 * (0.22 + 2.55 * burst) * (1 - 0.14 * mealSuppGh) * (1 + st * 0.08);
    ghNgMl.push(Math.round(clamp(ghRaw, 0.06, 3.8) * 100) / 100);
  }
  return { ghNgMl, ghrelinPgMl };
}

/**
 * Profili nominali IGF-1 / leptina (24 ore) educativi: ancoraggio `simulatedLabNumeric`; leptina modulata da pasti
 * (`mealGlycemicHourWeights24`, sazietà proxy). IGF-1 con oscillazione **molto** attenuata (non serie da campionamento
 * seriato). Leptina coerente col nodo skeleton `leptin_energy_balance` a livello di tile, non duplicata qui.
 */
export function buildNominalIgf1LeptinHourly24(
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
): { igf1NgMl: number[]; leptinNgMl: number[] } {
  const st = stress01(kernel);
  const mealW = mealGlycemicHourWeights24(timeline);
  const igf0 = simulatedLabNumeric("igf1", kernel) ?? 165;
  const lep0 = simulatedLabNumeric("leptin", kernel) ?? 1.35;
  const igf1NgMl: number[] = [];
  const leptinNgMl: number[] = [];

  for (let h = 0; h < 24; h += 1) {
    const phase = ((h - 4 + 24) % 24) * (Math.PI / 12);
    const igfMod = 1 + 0.028 * Math.cos(phase) - st * 0.012 * Math.sin(phase * 0.5);
    const igfRaw = igf0 * igfMod;
    igf1NgMl.push(Math.round(clamp(igfRaw, 48, 340)));

    const postMeal01 = clamp(mealW[h] / 1.25, 0, 1);
    const circLep = 1 - 0.055 * Math.sin(((h - 2 + 24) % 24) * (Math.PI / 12));
    const lepRaw = lep0 * circLep * (0.78 + 0.34 * postMeal01);
    leptinNgMl.push(Math.round(clamp(lepRaw, 0.35, 6.2) * 100) / 100);
  }
  return { igf1NgMl, leptinNgMl };
}
