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
import { scanFitWorkoutStepsFromBuffer } from "@/lib/training/fit-workout-step-scan";

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

function fitStepDurationSec(step: Record<string, unknown>): number {
  const raw =
    pickStepNumber(step, ["duration_value", "durationValue", "duration_time", "durationTime", "duration"]) ?? 120;
  if (raw > 48 * 3600) return 120;
  if (raw > 10000) return Math.max(1, Math.round(raw / 1000));
  return Math.max(1, Math.round(raw));
}

function fitStepFtpRange(step: Record<string, unknown>, ftpW: number): { low: number; high: number } {
  const lowRaw =
    pickStepNumber(step, ["custom_target_value_low", "customTargetValueLow", "target_value_low", "power_low"]) ??
    null;
  const highRaw =
    pickStepNumber(step, ["custom_target_value_high", "customTargetValueHigh", "target_value_high", "power_high"]) ??
    null;
  const mid = pickStepNumber(step, ["target_value", "targetValue", "power", "intensity"]) ?? null;

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

function parseFitWorkoutToManualBlocks(buffer: Buffer, ftpW: number): ManualPlanBlock[] {
  const steps = scanFitWorkoutStepsFromBuffer(buffer).workoutSteps;
  if (!steps.length) throw new Error("FIT: nessun workout step decodificabile.");

  const blocks: ManualPlanBlock[] = [];
  for (const step of steps) {
    const durSec = fitStepDurationSec(step);
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
    blocks = parseFitWorkoutToManualBlocks(input.buffer, ftpW);
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
