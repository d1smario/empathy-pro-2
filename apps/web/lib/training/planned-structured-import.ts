import "server-only";

import {
  buildPro2BuilderSessionContract,
  defaultManualPlanBlock,
  manualPlanBlocksToChartSegments,
  type ManualPlanBlock,
  type PlanExpandOpts,
} from "@/lib/training/builder/manual-plan-block";
import type { Pro2BuilderSessionContract, Pro2RenderProfile } from "@/lib/training/builder/pro2-session-contract";
import type { Pro2IntensityLabel } from "@/lib/training/builder/pro2-intensity";
import { extractSessionDurationHintSec, scanFitWorkoutStepsFromBuffer } from "@/lib/training/fit-workout-step-scan";

const DEFAULT_IMPORT_RENDER_PROFILE: Pro2RenderProfile = {
  intensityUnit: "watt",
  ftpW: 250,
  hrMax: 190,
  lengthMode: "time",
  speedRefKmh: 35,
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function ftpFractionToZone(p: number): Pro2IntensityLabel {
  const x = clamp(p, 0.35, 1.5);
  if (x < 0.56) return "Z1";
  if (x < 0.76) return "Z2";
  if (x < 0.88) return "Z3";
  if (x < 1.02) return "Z4";
  if (x < 1.12) return "Z5";
  if (x < 1.22) return "Z6";
  return "Z7";
}

function wattsToZone(w: number, ftpW: number): Pro2IntensityLabel {
  return ftpFractionToZone(w / Math.max(1, ftpW));
}

function splitDuration(totalSec: number): { minutes: number; seconds: number } {
  const s = Math.max(1, Math.round(totalSec));
  return { minutes: Math.floor(s / 60), seconds: s % 60 };
}

function parseXmlAttrs(attrStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:]+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) != null) {
    out[m[1]!.toLowerCase()] = m[2] ?? "";
  }
  return out;
}

function readZwoName(text: string): string | null {
  const m = text.match(/<name>([^<]+)<\/name>/i);
  return m?.[1]?.trim() || null;
}

function parseZwoToManualBlocks(xml: string, ftpW: number): ManualPlanBlock[] {
  const wMatch = xml.match(/<workout[^>]*>([\s\S]*?)<\/workout>/i);
  const inner = wMatch?.[1] ?? xml;
  const re = /<([A-Za-z][\w]*)([^/>]*)\/>/g;
  const blocks: ManualPlanBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) != null) {
    const tag = (m[1] ?? "").toLowerCase();
    const attrs = parseXmlAttrs(m[2] ?? "");
    const durSec = asNumber(attrs.duration) ?? 120;

    if (tag === "steadystate") {
      const p = asNumber(attrs.power) ?? 0.75;
      const b = defaultManualPlanBlock("steady", tag);
      const dm = splitDuration(durSec);
      b.minutes = dm.minutes;
      b.seconds = dm.seconds;
      b.label = "SteadyState";
      b.intensity = b.startIntensity = b.endIntensity = ftpFractionToZone(p);
      blocks.push(b);
      continue;
    }

    if (tag === "warmup" || tag === "cooldown" || tag === "ramp") {
      const low = asNumber(attrs.powerlow) ?? asNumber(attrs.power) ?? 0.5;
      const high = asNumber(attrs.powerhigh) ?? asNumber(attrs.power) ?? 0.85;
      const b = defaultManualPlanBlock("ramp", tag);
      const dm = splitDuration(durSec);
      b.minutes = dm.minutes;
      b.seconds = dm.seconds;
      b.startIntensity = ftpFractionToZone(low);
      b.endIntensity = ftpFractionToZone(high);
      b.intensity = b.endIntensity;
      blocks.push(b);
      continue;
    }

    if (tag === "intervalst") {
      const repeat = Math.max(1, Math.round(asNumber(attrs.repeat) ?? 1));
      const onS = asNumber(attrs.onduration) ?? 60;
      const offS = asNumber(attrs.offduration) ?? 120;
      const onP = asNumber(attrs.onpower) ?? 0.95;
      const offP = asNumber(attrs.offpower) ?? 0.55;
      const b = defaultManualPlanBlock("interval2", "Intervals");
      b.repeats = repeat;
      b.workSeconds = Math.max(10, Math.round(onS));
      b.recoverSeconds = Math.max(10, Math.round(offS));
      b.intensity = ftpFractionToZone(onP);
      b.intensity2 = ftpFractionToZone(offP);
      const totalSec = repeat * (b.workSeconds + b.recoverSeconds);
      const dm = splitDuration(totalSec);
      b.minutes = dm.minutes;
      b.seconds = dm.seconds;
      blocks.push(b);
      continue;
    }

    if (tag === "maxeffort") {
      const b = defaultManualPlanBlock("steady", "MaxEffort");
      const dm = splitDuration(Math.min(durSec, 600));
      b.minutes = dm.minutes;
      b.seconds = dm.seconds;
      b.intensity = b.startIntensity = b.endIntensity = "Z6";
      blocks.push(b);
      continue;
    }

    if (tag === "freeride") {
      const b = defaultManualPlanBlock("steady", "FreeRide");
      const dm = splitDuration(durSec);
      b.minutes = dm.minutes;
      b.seconds = dm.seconds;
      b.intensity = b.startIntensity = b.endIntensity = "Z2";
      blocks.push(b);
    }
  }

  if (!blocks.length) throw new Error("ZWO: nessun blocco riconosciuto (<workout> vuoto o formato non supportato).");
  return blocks;
}

type ErgPoint = { tSec: number; watts: number };

function parseErgMrcPowerCourse(text: string): ErgPoint[] {
  const lines = text.split(/\r?\n/);
  const markers = [/^\[INTERVAL DATA\]/i, /^\[WORKOUT DATA\]/i, /^\[COURSE DATA\]/i];
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const L = lines[i]!.trim();
    if (markers.some((re) => re.test(L))) {
      start = i;
      break;
    }
  }
  if (start < 0) throw new Error("ERG/MRC: sezione [INTERVAL DATA] / [WORKOUT DATA] non trovata.");
  const pairs: ErgPoint[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const raw = lines[i]!.trim();
    if (!raw || raw.startsWith(";") || raw.startsWith("[")) break;
    const m = raw.match(/^([\d.]+)\s+([\d.]+)\s*$/);
    if (!m) continue;
    pairs.push({ tSec: Number(m[1]), watts: Number(m[2]) });
  }
  if (pairs.length < 2) throw new Error("ERG/MRC: dati potenza insufficienti (servono almeno 2 punti tempo/watt).");
  pairs.sort((a, b) => a.tSec - b.tSec);
  return pairs;
}

function ergCourseToManualBlocks(points: ErgPoint[], ftpW: number): ManualPlanBlock[] {
  const blocks: ManualPlanBlock[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dur = Math.max(1, Math.round(b.tSec - a.tSec));
    if (dur <= 0) continue;
    const zone = wattsToZone(a.watts, ftpW);
    const blk = defaultManualPlanBlock("steady", `${Math.round(a.watts)}W`);
    const dm = splitDuration(dur);
    blk.minutes = dm.minutes;
    blk.seconds = dm.seconds;
    blk.intensity = blk.startIntensity = blk.endIntensity = zone;
    blk.target = `${Math.round(a.watts)} W`;
    blocks.push(blk);
  }
  if (!blocks.length) throw new Error("ERG/MRC: impossibile derivare segmenti.");
  return blocks;
}

function pickStepNumber(step: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = asNumber(step[k]);
    if (n != null && Number.isFinite(n)) return n;
  }
  return null;
}

/** Garmin/TP: spesso `repeat_count` (uint16) su definizione estesa del messaggio. */
function fitStepRepeatMultiplier(step: Record<string, unknown>): number {
  const n = pickStepNumber(step, ["repeat_count", "repeatCount", "num_repetitions", "repetitions"]);
  if (n == null || !Number.isFinite(n) || n < 2) return 1;
  return Math.min(400, Math.max(2, Math.round(n)));
}

/** Percentuale FTP ×10000 (es. 7525 → 75,25%) in `custom_target_*` / `target_value`. */
function maybeScaledPercentFtp(v: number): number | null {
  if (v >= 2000 && v <= 15000 && Number.isFinite(v)) return clamp(v / 10000, 0.35, 1.55);
  return null;
}

/** Allineato a `fit-file-parser` / Garmin `wkt_step_duration` (uint8). */
const WKT_STEP_DURATION_BY_NUM: Record<number, string> = {
  0: "time",
  1: "distance",
  2: "hr_less_than",
  3: "hr_greater_than",
  4: "calories",
  5: "open",
  6: "repeat_until_steps_cmplt",
  7: "repeat_until_time",
  8: "repeat_until_distance",
  9: "repeat_until_calories",
  10: "repeat_until_hr_less_than",
  11: "repeat_until_hr_greater_than",
  12: "repeat_until_power_less_than",
  13: "repeat_until_power_greater_than",
  14: "power_less_than",
  15: "power_greater_than",
  16: "training_peaks_tss",
  17: "repeat_until_power_last_lap_less_than",
  18: "repeat_until_max_power_last_lap_less_than",
  19: "power_3s_less_than",
  20: "power_10s_less_than",
  21: "power_30s_less_than",
  22: "power_3s_greater_than",
  23: "power_10s_greater_than",
  24: "power_30s_greater_than",
  25: "power_lap_less_than",
  26: "power_lap_greater_than",
  27: "repeat_until_training_peaks_tss",
  28: "repetition_time",
  29: "reps",
};

function normalizeFitWktDurationType(step: Record<string, unknown>): string {
  const t = step.duration_type ?? step.durationType;
  if (typeof t === "string") {
    const s = t.toLowerCase().trim().replace(/[\s-]+/g, "_");
    return s || "time";
  }
  if (typeof t === "number" && Number.isFinite(t) && Number.isInteger(t)) {
    return WKT_STEP_DURATION_BY_NUM[t] ?? "time";
  }
  return "time";
}

function defaultMpsFromFitWorkout(workout: Record<string, unknown> | null | undefined): number {
  const s = workout?.sport;
  const str = typeof s === "string" ? s.toLowerCase() : "";
  if (str === "running" || str === "walking" || s === 1 || s === 11) return 3.2;
  if (str === "cycling" || str === "e_biking" || s === 2 || s === 21) return 9.5;
  if (str === "swimming" || s === 5) return 1.0;
  return 9.5;
}

/**
 * Secondi per un blocco grafico. `null` = step da non materializzare (contenitori / open senza valore).
 * TrainingPeaks spesso usa `distance` (metri) o `training_peaks_tss`: trattarli come secondi FIT rompe durate e zone.
 */
function fitStepDurationSecForImport(step: Record<string, unknown>, mps: number): number | null {
  const dtype = normalizeFitWktDurationType(step);
  const raw = pickStepNumber(step, ["duration_value", "durationValue", "duration_time", "durationTime"]);

  if (dtype === "repeat_until_steps_cmplt") return null;

  if (dtype === "open") {
    const v = raw ?? 0;
    if (!Number.isFinite(v) || v <= 0) return null;
    return Math.min(Math.max(1, Math.round(v)), 24 * 3600);
  }

  if (dtype === "reps") return null;

  if (dtype === "distance" || dtype === "repeat_until_distance") {
    const meters = Math.max(0, Math.round(raw ?? 0));
    if (meters <= 0) return null;
    return Math.max(45, Math.round(meters / Math.max(0.7, mps)));
  }

  if (dtype === "training_peaks_tss" || dtype === "repeat_until_training_peaks_tss") {
    const tss = Math.max(1, Math.round(raw ?? 1));
    const ifAssumed = 0.72;
    const hours = tss / (ifAssumed * ifAssumed * 100);
    return Math.max(300, Math.min(8 * 3600, Math.round(hours * 3600)));
  }

  if (dtype === "calories" || dtype === "repeat_until_calories") {
    const kcal = Math.max(1, Math.round(raw ?? 1));
    return Math.max(120, Math.min(8 * 3600, Math.round((kcal / 650) * 3600)));
  }

  if (dtype === "time" || dtype === "repeat_until_time" || dtype === "repetition_time") {
    const v = Math.max(1, Math.round(raw ?? 120));
    return Math.min(v, 24 * 3600);
  }

  if (
    dtype === "hr_less_than" ||
    dtype === "hr_greater_than" ||
    dtype.startsWith("power_") ||
    dtype.startsWith("repeat_until_hr_") ||
    dtype.startsWith("repeat_until_power_")
  ) {
    return null;
  }

  const v0 = raw ?? 120;
  const v = Math.max(1, Math.round(v0));
  return Math.min(v, 24 * 3600);
}

/** Fallback minimale se tutti gli step risultano «saltati» (file anomali). */
function fitStepDurationSecLegacy(step: Record<string, unknown>): number {
  const raw =
    pickStepNumber(step, ["duration_value", "durationValue", "duration_time", "durationTime", "duration"]) ?? 120;
  const v = Math.max(1, Math.round(raw));
  return Math.min(v, 48 * 3600);
}

function fitStepFtpRange(step: Record<string, unknown>, ftpW: number): { low: number; high: number } {
  const targetType = String(step.target_type ?? step.targetType ?? "").toLowerCase();
  const lowRaw =
    pickStepNumber(step, ["custom_target_value_low", "customTargetValueLow", "target_value_low", "power_low"]) ??
    null;
  const highRaw =
    pickStepNumber(step, ["custom_target_value_high", "customTargetValueHigh", "target_value_high", "power_high"]) ??
    null;
  const mid = pickStepNumber(step, ["target_value", "targetValue", "power", "intensity"]) ?? null;

  if (lowRaw != null && highRaw != null) {
    const sl = maybeScaledPercentFtp(lowRaw);
    const sh = maybeScaledPercentFtp(highRaw);
    if (sl != null && sh != null) {
      return { low: Math.min(sl, sh), high: Math.max(sl, sh) };
    }
  }
  if (mid != null && lowRaw == null && highRaw == null) {
    const sm = maybeScaledPercentFtp(mid);
    if (sm != null) return { low: sm, high: sm };
  }

  if (targetType === "power" && mid != null && lowRaw == null && highRaw == null) {
    if (mid >= 40 && mid <= 190 && Number.isInteger(mid)) {
      const r = clamp(mid / 100, 0.35, 1.5);
      return { low: r, high: r };
    }
  }

  const toRatio = (v: number): number => {
    if (v > 0 && v <= 3) return v;
    if (v > 3 && v < 600) return v / Math.max(1, ftpW);
    if (v >= 600) return clamp(v / Math.max(1, ftpW), 0.4, 1.5);
    return 0.75;
  };

  if (mid != null && lowRaw == null && highRaw == null) {
    const r = toRatio(mid);
    return { low: r, high: r };
  }
  const lo = lowRaw != null ? toRatio(lowRaw) : mid != null ? toRatio(mid) : 0.65;
  const hi = highRaw != null ? toRatio(highRaw) : mid != null ? toRatio(mid) : lo;
  return { low: Math.min(lo, hi), high: Math.max(lo, hi) };
}

function totalManualPlanBlocksSeconds(blocks: ManualPlanBlock[]): number {
  let s = 0;
  for (const b of blocks) {
    s += b.minutes * 60 + b.seconds;
  }
  return Math.max(1, s);
}

/** Se il FIT espone una durata macro (session / TP) molto maggiore della somma step, scala i blocchi in proporzione. */
function scaleManualPlanBlocksByFactor(blocks: ManualPlanBlock[], factor: number): void {
  if (!Number.isFinite(factor) || factor < 1.06) return;
  const f = Math.min(factor, 80);
  for (const b of blocks) {
    const totalSec = Math.max(1, b.minutes * 60 + b.seconds);
    const nt = Math.max(20, Math.round(totalSec * f));
    const dm = splitDuration(nt);
    b.minutes = dm.minutes;
    b.seconds = dm.seconds;
    if (b.kind === "interval2") {
      b.workSeconds = Math.max(10, Math.round(b.workSeconds * f));
      b.recoverSeconds = Math.max(10, Math.round(b.recoverSeconds * f));
    }
    if (b.kind === "interval3" || b.kind === "pyramid") {
      b.step1Seconds = Math.max(10, Math.round(b.step1Seconds * f));
      b.step2Seconds = Math.max(10, Math.round(b.step2Seconds * f));
      b.step3Seconds = Math.max(10, Math.round(b.step3Seconds * f));
    }
  }
}

function parseFitWorkoutToManualBlocks(
  buffer: Buffer,
  ftpW: number,
): { blocks: ManualPlanBlock[]; wktName: string | null } {
  const scan = scanFitWorkoutStepsFromBuffer(buffer);
  const steps = scan.workoutSteps;
  if (!steps.length) throw new Error("FIT: nessun workout step decodificabile.");
  const mps = defaultMpsFromFitWorkout(scan.workout);
  const wn = scan.workout?.wkt_name ?? scan.workout?.wktName;
  const wktName = typeof wn === "string" && wn.trim() ? wn.trim().slice(0, 200) : null;

  const buildBlocks = (legacy: boolean): ManualPlanBlock[] => {
    const blocks: ManualPlanBlock[] = [];
    for (const step of steps) {
      let durSec = legacy ? fitStepDurationSecLegacy(step) : fitStepDurationSecForImport(step, mps);
      if (durSec == null) continue;
      durSec *= fitStepRepeatMultiplier(step);
      const { low, high } = fitStepFtpRange(step, ftpW);
      const dm = splitDuration(durSec);
      if (Math.abs(high - low) < 0.04) {
        const b = defaultManualPlanBlock("steady", "FIT step");
        b.minutes = dm.minutes;
        b.seconds = dm.seconds;
        b.intensity = b.startIntensity = b.endIntensity = ftpFractionToZone((low + high) / 2);
        blocks.push(b);
      } else {
        const b = defaultManualPlanBlock("ramp", "FIT ramp");
        b.minutes = dm.minutes;
        b.seconds = dm.seconds;
        b.startIntensity = ftpFractionToZone(low);
        b.endIntensity = ftpFractionToZone(high);
        b.intensity = b.endIntensity;
        blocks.push(b);
      }
    }
    return blocks;
  };

  let blocks = buildBlocks(false);
  if (!blocks.length) blocks = buildBlocks(true);
  if (!blocks.length) {
    throw new Error(
      "FIT: nessuno step con durata decodificabile (solo contenitori repeat/open?). Prova export ZWO/ERG o un FIT workout con step «time»/«distance».",
    );
  }

  const sumSec = totalManualPlanBlocksSeconds(blocks);
  const fromList =
    scan.sessionDurationHintsSec.length > 0 ? Math.max(...scan.sessionDurationHintsSec) : null;
  const fromWorkout = extractSessionDurationHintSec(scan.workout);
  const hintSec = Math.max(fromList ?? 0, fromWorkout ?? 0);
  if (
    hintSec >= sumSec * 1.45 &&
    sumSec < 52 * 60 &&
    hintSec >= 40 * 60 &&
    hintSec <= 14 * 3600
  ) {
    scaleManualPlanBlocksByFactor(blocks, hintSec / sumSec);
  }

  return { blocks, wktName };
}

export type PlannedStructuredFormat = "zwo" | "erg" | "mrc" | "fit_workout";

export async function parseStructuredPlannedWorkoutFromBuffer(input: {
  fileName: string;
  buffer: Buffer;
  format: PlannedStructuredFormat;
}): Promise<{
  sessionName: string;
  discipline: string;
  contract: Pro2BuilderSessionContract;
  sourceVendorTag: string;
}> {
  const ftpW = DEFAULT_IMPORT_RENDER_PROFILE.ftpW;
  let blocks: ManualPlanBlock[];
  let sessionName = input.fileName.replace(/\.[^.]+$/, "");

  if (input.format === "zwo") {
    const text = input.buffer.toString("utf8");
    sessionName = readZwoName(text) ?? sessionName;
    blocks = parseZwoToManualBlocks(text, ftpW);
  } else if (input.format === "erg" || input.format === "mrc") {
    const text = input.buffer.toString("utf8");
    const pts = parseErgMrcPowerCourse(text);
    blocks = ergCourseToManualBlocks(pts, ftpW);
  } else if (input.format === "fit_workout") {
    const parsedFit = parseFitWorkoutToManualBlocks(input.buffer, ftpW);
    blocks = parsedFit.blocks;
    if (parsedFit.wktName) sessionName = parsedFit.wktName;
  } else {
    throw new Error("Formato strutturato non supportato.");
  }

  const expandOpts: PlanExpandOpts = {
    unit: DEFAULT_IMPORT_RENDER_PROFILE.intensityUnit,
    ftpW: DEFAULT_IMPORT_RENDER_PROFILE.ftpW,
    hrMax: DEFAULT_IMPORT_RENDER_PROFILE.hrMax,
    lengthMode: DEFAULT_IMPORT_RENDER_PROFILE.lengthMode,
    speedRefKmh: DEFAULT_IMPORT_RENDER_PROFILE.speedRefKmh,
  };
  const durationSec = manualPlanBlocksToChartSegments(blocks, expandOpts).reduce(
    (sum, seg) => sum + seg.durationSeconds,
    0,
  );
  const plannedSessionDurationMinutes = Math.max(1, Math.round(durationSec / 60));

  const contract = buildPro2BuilderSessionContract({
    blocks,
    renderProfile: DEFAULT_IMPORT_RENDER_PROFILE,
    discipline: "Cycling",
    sessionName: sessionName.slice(0, 200) || "Import strutturato",
    family: "aerobic",
    plannedSessionDurationMinutes,
  });

  const sourceVendorTag =
    input.format === "fit_workout"
      ? "structured_fit_workout"
      : input.format === "zwo"
        ? "structured_zwo"
        : input.format === "erg"
          ? "structured_erg"
          : "structured_mrc";

  return {
    sessionName: contract.sessionName,
    discipline: contract.discipline,
    contract,
    sourceVendorTag,
  };
}
