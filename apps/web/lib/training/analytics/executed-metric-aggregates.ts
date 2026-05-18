import { EMPATHY_LOAD_LABELS_IT } from "@empathy/contracts";
import { resolveExecutedTrainingLoad } from "@/lib/training/infer-executed-training-load";
import {
  resolveExecutedAvgPowerW,
  resolveExecutedKcal,
} from "@/lib/training/resolve-executed-session-energy";

/** Per-workout e per-giorno: estrae metriche da `executed_workouts` + `trace_summary` (best-effort). */

export type ExecutedAnalyticsRow = {
  date: string | null;
  tss: number | null;
  duration_minutes: number | null;
  kcal: number | null;
  kj?: number | null;
  trace_summary: Record<string, unknown> | null;
  lactate_mmoll: number | null;
  glucose_mmol: number | null;
  smo2: number | null;
};

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickMetric(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const value = asNum(trace[key]);
    if (value != null) return value;
  }
  return null;
}

export type DailyMetricAgg = {
  tss: number;
  kcal: number;
  minutes: number;
  /** Durata‑weighted sum(power); dividere per minutes per media */
  powerWeighted: number;
  hrWeighted: number;
  glucoseLast: number | null;
  smo2Last: number | null;
  coreTempLast: number | null;
  vo2Last: number | null;
  vco2Last: number | null;
  lactateLast: number | null;
  nadIndexLast: number | null;
  noIndexLast: number | null;
  naSweatLast: number | null;
  kSweatLast: number | null;
};

const EMPTY_DAY: DailyMetricAgg = {
  tss: 0,
  kcal: 0,
  minutes: 0,
  powerWeighted: 0,
  hrWeighted: 0,
  glucoseLast: null,
  smo2Last: null,
  coreTempLast: null,
  vo2Last: null,
  vco2Last: null,
  lactateLast: null,
  nadIndexLast: null,
  noIndexLast: null,
  naSweatLast: null,
  kSweatLast: null,
};

function mergeDay(prev: DailyMetricAgg, row: ExecutedAnalyticsRow): DailyMetricAgg {
  const tr = row.trace_summary;
  const tss = resolveExecutedTrainingLoad({
    storedTss: row.tss,
    durationMinutes: Math.max(0, Number(row.duration_minutes ?? 0)),
    traceSummary: tr,
    vendorLoad: pickMetric(tr, [
      "training_load",
      "trainingLoad",
      "training_load_score",
      "activity_training_load",
    ]),
  });
  const minutes = Math.max(0, Number(row.duration_minutes ?? 0));
  const power = resolveExecutedAvgPowerW({
    storedKj: row.kj,
    durationMinutes: minutes,
    traceSummary: tr,
  });
  const kcal = resolveExecutedKcal({
    storedKcal: row.kcal,
    storedKj: row.kj,
    durationMinutes: minutes,
    traceSummary: tr,
    avgPowerW: power,
  });
  const hr = pickMetric(tr, ["hr_avg_bpm", "avg_hr", "heart_rate_avg", "avg_heart_rate", "average_heart_rate"]) ?? null;
  const glucose = row.glucose_mmol ?? pickMetric(tr, ["glucose_mmol", "glucose_mg_dl"]);
  const smo2 = row.smo2 ?? pickMetric(tr, ["smo2", "smO2", "moxy_smo2"]);
  const core = pickMetric(tr, ["core_temp_c", "core_temperature_c", "skin_temp_c"]);
  const vo2 = pickMetric(tr, ["vo2_ml_kg_min", "vo2_l_min", "vo2"]);
  const vco2 = pickMetric(tr, ["vco2_ml_kg_min", "vco2_l_min", "vco2"]);
  const lactate =
    row.lactate_mmoll ?? pickMetric(tr, ["lactate_mmol_l", "lactate_mmoll", "lactate"]);
  const nadIndex = pickMetric(tr, ["nad_index", "nad", "nad_plus"]);
  const noIndex = pickMetric(tr, ["nitric_oxide_index", "no_index", "nitric_oxide"]);
  const naSweat = pickMetric(tr, ["sweat_sodium_mmol_l", "na_sweat_mmol_l", "na_sweat", "sweat_na"]);
  const kSweat = pickMetric(tr, ["sweat_potassium_mmol_l", "k_sweat_mmol_l", "k_sweat", "sweat_k"]);

  const w = minutes > 0 ? minutes : 1;
  const next: DailyMetricAgg = {
    tss: prev.tss + tss,
    kcal: prev.kcal + kcal,
    minutes: prev.minutes + minutes,
    powerWeighted: prev.powerWeighted + (power != null ? power * w : 0),
    hrWeighted: prev.hrWeighted + (hr != null ? hr * w : 0),
    glucoseLast: glucose ?? prev.glucoseLast,
    smo2Last: smo2 ?? prev.smo2Last,
    coreTempLast: core ?? prev.coreTempLast,
    vo2Last: vo2 ?? prev.vo2Last,
    vco2Last: vco2 ?? prev.vco2Last,
    lactateLast: lactate ?? prev.lactateLast,
    nadIndexLast: nadIndex ?? prev.nadIndexLast,
    noIndexLast: noIndex ?? prev.noIndexLast,
    naSweatLast: naSweat ?? prev.naSweatLast,
    kSweatLast: kSweat ?? prev.kSweatLast,
  };
  return next;
}

export function dailyMetricMap(rows: ExecutedAnalyticsRow[]): Map<string, DailyMetricAgg> {
  const map = new Map<string, DailyMetricAgg>();
  for (const row of rows) {
    if (!row.date || row.date.length < 10) continue;
    const d = row.date.slice(0, 10);
    const prev = map.get(d) ?? { ...EMPTY_DAY };
    map.set(d, mergeDay(prev, row));
  }
  return map;
}

export function dayMetricValue(day: DailyMetricAgg | undefined, key: MetricSeriesKey): number {
  if (!day) return 0;
  switch (key) {
    case "tss":
      return day.tss;
    case "kcal":
      return day.kcal;
    case "minutes":
      return day.minutes;
    case "power":
      return day.minutes > 0 ? day.powerWeighted / day.minutes : 0;
    case "hr":
      return day.minutes > 0 ? day.hrWeighted / day.minutes : 0;
    case "glucose":
      return day.glucoseLast ?? 0;
    case "smo2":
      return day.smo2Last ?? 0;
    case "coreTemp":
      return day.coreTempLast ?? 0;
    case "vo2":
      return day.vo2Last ?? 0;
    case "vco2":
      return day.vco2Last ?? 0;
    case "lactate":
      return day.lactateLast ?? 0;
    case "nadIndex":
      return day.nadIndexLast ?? 0;
    case "noIndex":
      return day.noIndexLast ?? 0;
    case "naSweat":
      return day.naSweatLast ?? 0;
    case "kSweat":
      return day.kSweatLast ?? 0;
    default:
      return 0;
  }
}

export function valuesForDates(map: Map<string, DailyMetricAgg>, dates: string[], key: MetricSeriesKey): number[] {
  return dates.map((date) => dayMetricValue(map.get(date), key));
}

export type CompareDayRow = {
  date: string;
  planned: number;
  executed: number;
  internal: number;
  ctl: number;
  iCtl: number;
};

/** Valore giornaliero per overlay / esagono: carico da `compare` + fisiologia da aggregati sessioni. */
export function valueForMetric(
  key: MetricSeriesKey,
  row: CompareDayRow | undefined,
  dm: Map<string, DailyMetricAgg>,
  date: string,
): number {
  if (!row) return 0;
  switch (key) {
    case "planned":
      return row.planned;
    case "executed":
      return row.executed;
    case "internal":
      return row.internal;
    case "ctl":
      return row.ctl;
    case "iCtl":
      return row.iCtl;
    case "tss":
      return row.executed;
    default:
      return dayMetricValue(dm.get(date), key);
  }
}

export type MetricSeriesKey =
  | "planned"
  | "executed"
  | "internal"
  | "ctl"
  | "iCtl"
  | "tss"
  | "kcal"
  | "minutes"
  | "power"
  | "hr"
  | "glucose"
  | "smo2"
  | "coreTemp"
  | "vo2"
  | "vco2"
  | "lactate"
  | "nadIndex"
  | "noIndex"
  | "naSweat"
  | "kSweat";

export const OVERLAY_METRIC_DEFS: Array<{ key: MetricSeriesKey; label: string; color: string }> = [
  { key: "planned", label: "Piano · carico", color: "#60a5fa" },
  { key: "executed", label: `${EMPATHY_LOAD_LABELS_IT.trainingLoad} eseguito`, color: "#ff7a1a" },
  { key: "internal", label: EMPATHY_LOAD_LABELS_IT.stressCore, color: "#d946ef" },
  { key: "ctl", label: EMPATHY_LOAD_LABELS_IT.fitness4, color: "#ff9e4a" },
  { key: "iCtl", label: EMPATHY_LOAD_LABELS_IT.conditioningInt4, color: "#f59e0b" },
  { key: "hr", label: "FC media", color: "#f43f5e" },
  { key: "glucose", label: "Glucosio", color: "#22d3ee" },
  { key: "coreTemp", label: "Core temp", color: "#fb923c" },
  { key: "smo2", label: "Moxy smO2", color: "#a78bfa" },
  { key: "vo2", label: "VO2", color: "#4ade80" },
  { key: "vco2", label: "VCO2", color: "#2dd4bf" },
  { key: "lactate", label: "Lattato", color: "#fb7185" },
  { key: "nadIndex", label: "NAD index", color: "#facc15" },
  { key: "noIndex", label: "NO index", color: "#34d399" },
  { key: "naSweat", label: "Na+ sudore", color: "#38bdf8" },
  { key: "kSweat", label: "K+ sudore", color: "#c084fc" },
];

/** 0–100 per vertex; flat series → midline. */
export function normalize01Series(values: number[]): number[] {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return values.map(() => 50);
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (max - min < 1e-6) return values.map(() => 50);
  return values.map((v) => {
    if (!Number.isFinite(v)) return 50;
    return ((v - min) / (max - min)) * 100;
  });
}

/** 6 valori (medie settimanali su chunk da 7 giorni); array corto → pad a 0. */
export function sixWeekMeans(dailyValues: number[]): number[] {
  const chunk = 7;
  const out: number[] = [];
  for (let w = 0; w < 6; w += 1) {
    const slice = dailyValues.slice(w * chunk, (w + 1) * chunk);
    if (!slice.length) {
      out.push(0);
      continue;
    }
    const sum = slice.reduce((a, b) => a + b, 0);
    out.push(sum / slice.length);
  }
  return out;
}

export function refKpisLastNDays(
  rows: ExecutedAnalyticsRow[],
  days: number,
  endDate: string,
): { tss: number; kcal: number; wattAvg: number | null; totalMinutes: number } {
  const end = new Date(`${endDate}T12:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const startS = start.toISOString().slice(0, 10);
  const endS = end.toISOString().slice(0, 10);

  let tss = 0;
  let kcal = 0;
  let totalMinutes = 0;
  let powerWeighted = 0;

  for (const row of rows) {
    const ds = row.date?.slice(0, 10);
    if (!ds || ds < startS || ds > endS) continue;
    const m = Math.max(0, Number(row.duration_minutes ?? 0));
    const tr = row.trace_summary;
    const power = resolveExecutedAvgPowerW({
      storedKj: row.kj,
      durationMinutes: m,
      traceSummary: tr,
    });
    tss += resolveExecutedTrainingLoad({
      storedTss: row.tss,
      durationMinutes: m,
      traceSummary: tr,
      vendorLoad: pickMetric(tr, [
        "training_load",
        "trainingLoad",
        "training_load_score",
        "activity_training_load",
      ]),
    });
    kcal += resolveExecutedKcal({
      storedKcal: row.kcal,
      storedKj: row.kj,
      durationMinutes: m,
      traceSummary: tr,
      avgPowerW: power,
    });
    totalMinutes += m;
    const w = m > 0 ? m : 1;
    if (power != null) powerWeighted += power * w;
  }

  const wattAvg = totalMinutes > 0 && powerWeighted > 0 ? powerWeighted / totalMinutes : null;
  return { tss, kcal, wattAvg, totalMinutes };
}

export type HexCompare = { recent: number[]; baseline: number[] };

/**
 * Timeline completa (es. 120g). Ultimi 42g vs 42g precedenti → medie su 6 settimane (7g ciascuna).
 */
export function hexWeekCompareFromTimeline(
  dailyValues: Map<string, number>,
  allDatesAscending: string[],
): HexCompare {
  const zeros = [0, 0, 0, 0, 0, 0];
  if (allDatesAscending.length < 14) return { recent: zeros, baseline: zeros };

  const recentDaily = allDatesAscending.slice(-42).map((d) => dailyValues.get(d) ?? 0);
  const recent = sixWeekMeans(recentDaily);

  if (allDatesAscending.length < 84) {
    return { recent, baseline: zeros };
  }
  const baselineDaily = allDatesAscending.slice(-84, -42).map((d) => dailyValues.get(d) ?? 0);
  return { recent, baseline: sixWeekMeans(baselineDaily) };
}
