import type { SimDayKernelV1Input } from "./day-simulator-v1";
import {
  activityStepIntensity01V2,
  hourFromIsoTs,
  minutesFromMidnightLocalTs,
} from "./sim-timeline-v1";
import type { SimTimelineEventV1 } from "./sim-timeline-v1";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Modulazione circadiana leggera sul proxy (notte più bassa, giorno più alta) — moltiplicatore ~0.55–1.0; `h` in ore frazionarie 0–24. */
function circadianInsulinMod(h: number): number {
  return 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(((h - 14) * Math.PI) / 12));
}

/** Distanza circolare in ore tra due istanti del giorno (0–12). */
function circularHourDeltaHours(fa: number, fb: number): number {
  const da = ((fa % 24) + 24) % 24;
  const db = ((fb % 24) + 24) % 24;
  let d = Math.abs(da - db);
  if (d > 12) d = 24 - d;
  return d;
}

/** Versione contratto predittore sub-orario domanda insulinica (proxy). */
export const INSULIN_STIMULUS_PREDICTOR_CONTRACT_VERSION = 1 as const;

export const INSULIN_STIMULUS_PREDICTOR_SOURCE_PREFIX = "insulin_stimulus_predictor_v1_" as const;

export type InsulinStimulusPriorTopicV1 =
  | "postprandial_insulin_demand_shape"
  | "exercise_muscle_glucose_uptake_proxy"
  | "circadian_operational_rhythm";

export type InsulinStimulusLiteratureManifestEntryV1 = {
  id: string;
  topicIt: string;
  appliesTo: InsulinStimulusPriorTopicV1;
  refs: readonly string[];
};

export const PRED_INSULIN_STIMULI_LITERATURE_MANIFEST_V1: readonly InsulinStimulusLiteratureManifestEntryV1[] = [
  {
    id: "meal_insulinogenic_signal_v1",
    topicIt: "Segnale post-prandiale da carico CHO e insulin_load diario (proxy operativo).",
    appliesTo: "postprandial_insulin_demand_shape",
    refs: [],
  },
  {
    id: "exercise_insulin_sensitivity_shift_v1",
    topicIt: "Attenuazione durante esercizio (uptake muscolo-dominated, proxy su intensità finestra).",
    appliesTo: "exercise_muscle_glucose_uptake_proxy",
    refs: [],
  },
  {
    id: "circadian_endocrine_ultradian_proxy_v1",
    topicIt: "Modulazione circadiana leggera (non ritmo insulinemico misurato).",
    appliesTo: "circadian_operational_rhythm",
    refs: [],
  },
] as const;

export type InsulinProxySeriesPointV1 = {
  ts: string;
  value: number;
  source: string;
};

export function insulinStimulusPredictorSourceV1(stepMinutes: 5 | 10): string {
  return `${INSULIN_STIMULUS_PREDICTOR_SOURCE_PREFIX}${stepMinutes}m`;
}

/**
 * Domanda insulinica (proxy) 0–100 a passo 5/10 min: base kernel × circadiano × (1 − 0.18·intensità attività)
 * + bump gaussiani pasto (CHO + insulin_load) in ore frazionarie. Convoglia la stessa logica dell’orario
 * (`buildInsulinProxyHourly24` = media oraria di questa serie a passo 5).
 */
export function buildInsulinStimulusPredictorSubhourlyV1(
  date: string,
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
  stepMinutes: 5 | 10,
): InsulinProxySeriesPointV1[] {
  const day = date.slice(0, 10);
  if (stepMinutes !== 5 && stepMinutes !== 10) {
    throw new Error("buildInsulinStimulusPredictorSubhourlyV1: stepMinutes must be 5 or 10");
  }
  const base = clamp(kernel.insulinDemandScore, 0, 100);
  const steps = (24 * 60) / stepMinutes;
  const actI = activityStepIntensity01V2(steps, stepMinutes, timeline);
  const src = insulinStimulusPredictorSourceV1(stepMinutes);
  const sigma = 2.05;
  const out: InsulinProxySeriesPointV1[] = [];

  for (let i = 0; i < steps; i += 1) {
    const tStart = i * stepMinutes;
    const hh = Math.floor(tStart / 60) % 24;
    const mm = tStart % 60;
    const fhMid = (tStart + stepMinutes / 2) / 60;
    const aInt = actI[i] ?? 0;

    let v = base * circadianInsulinMod(fhMid);
    v *= 1 - 0.18 * aInt;

    for (const ev of timeline) {
      if (ev.type !== "meal") continue;
      const mins = minutesFromMidnightLocalTs(ev.ts);
      if (mins == null) continue;
      const mealFh = mins / 60;
      const carbs = (ev.payload?.carbsG as number | undefined) ?? 0;
      const insulinLoad = (ev.payload?.insulinLoad as number | undefined) ?? 0;
      const c = typeof carbs === "number" && Number.isFinite(carbs) ? Math.max(0, carbs) : 0;
      const il = typeof insulinLoad === "number" && Number.isFinite(insulinLoad) ? Math.max(0, insulinLoad) : 0;
      const mealPush = il * 1.08 + c * 0.2;
      if (mealPush <= 0) continue;
      const d = circularHourDeltaHours(fhMid, mealFh);
      const g = Math.exp(-(d * d) / (2 * sigma * sigma));
      v += mealPush * g;
    }

    v = clamp(v, 0, 100);
    const ts = `${day}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
    out.push({ ts, value: Math.round(v * 10) / 10, source: src });
  }
  return out;
}

/**
 * Domanda insulinica (proxy) 0–100 su 24 h: **media oraria** dei punti 5 min da `buildInsulinStimulusPredictorSubhourlyV1`
 * (un solo motore; nessun calcolo parallelo su formula oraria legacy).
 */
export function buildInsulinProxyHourly24(
  date: string,
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
): number[] {
  const pts = buildInsulinStimulusPredictorSubhourlyV1(date, kernel, timeline, 5);
  const buckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const p of pts) {
    const h = hourFromIsoTs(p.ts);
    if (h != null) buckets[h]!.push(p.value);
  }
  return buckets.map((b) => {
    if (!b.length) return Math.round(clamp(kernel.insulinDemandScore, 0, 100) * 10) / 10;
    const mean = b.reduce((s, x) => s + x, 0) / b.length;
    return Math.round(clamp(mean, 0, 100) * 10) / 10;
  });
}
