import {
  SIM_DIURNAL_GLUCOSE_V1,
  SIM_DIURNAL_LACTATE_V1,
  SIM_PATHWAY_SCALE_V1,
  SIM_STRESS_V1,
} from "./sim-bank-v1";
import { activitySupportHours, mealInhibitoryHours } from "./sim-timeline-v1";
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

function pathwayScale(k: SimDayKernelV1Input): number {
  if (k.pathwayState === "inhibitory") return SIM_PATHWAY_SCALE_V1.inhibitory;
  if (k.pathwayState === "supportive") return SIM_PATHWAY_SCALE_V1.supportive;
  return SIM_PATHWAY_SCALE_V1.mixed;
}

/** Profilo glucosio/lattato 24h (1 punto/ora) da kernel + pasti pesanti + finestre allenamento. */
export function buildSimulatedGluLacDiurnal(
  date: string,
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
): { glucose: SimSeriesPointV1[]; lactate: SimSeriesPointV1[] } {
  const day = date.slice(0, 10);
  const meals = mealInhibitoryHours(timeline);
  const act = activitySupportHours(timeline);
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
    if (meals.has(h)) g += gCfg.mealBumpMmol;
    if (act.has(h)) g -= gCfg.activityDipMmol;
    g = clamp(g, gCfg.clampLo, gCfg.clampHi);
    let lac = lacBase + lCfg.circAmp * Math.sin(((h - lCfg.circPhaseHour) * Math.PI) / 12);
    if (act.has(h)) lac += lCfg.activityBumpMmol + kernel.oxidationDriveScore * lCfg.oxidationActivityK;
    if (meals.has(h)) lac -= lCfg.mealDipMmol;
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

/**
 * Profili ormonali diurni nominali (24 valori/ora) per confronto temporale educativo con il pathway:
 * non sono concentrazioni da campionamento ematico seriato; forma circadiana modulata da stress/pathway del kernel v1.
 */
export function buildNominalCortisolActhHourly24(kernel: SimDayKernelV1Input): { cortisolUgdL: number[]; acthPgMl: number[] } {
  const st = stress01(kernel);
  const ps = pathwayScale(kernel);
  const cortisolUgdL: number[] = [];
  const acthPgMl: number[] = [];
  for (let h = 0; h < 24; h += 1) {
    const morning = Math.cos(((h - 8) * Math.PI) / 12);
    const circC = 0.5 * (1 + morning);
    const cortRaw = 3.5 + circC * (12 + st * 6) + (ps - 1) * 2.2;
    cortisolUgdL.push(Math.round(clamp(cortRaw, 2, 26) * 10) / 10);
    const dawn = Math.cos(((h - 5.5) * Math.PI) / 11);
    const circA = 0.5 * (1 + dawn);
    const acthRaw = 10 + circA * (28 + st * 12) * (0.95 + (ps - 1) * 0.15);
    acthPgMl.push(Math.round(clamp(acthRaw, 5, 55) * 10) / 10);
  }
  return { cortisolUgdL, acthPgMl };
}
