import "server-only";

import {
  buildPro2BuilderSessionContract,
  defaultManualPlanBlock,
  manualPlanBlocksToChartSegments,
  type ManualPlanBlock,
  type PlanChartSegment,
  type PlanExpandOpts,
} from "@/lib/training/builder/manual-plan-block";
import type { Pro2BuilderSessionContract, Pro2RenderProfile } from "@/lib/training/builder/pro2-session-contract";
import { intensityToRelativeLoad, type Pro2IntensityLabel } from "@/lib/training/builder/pro2-intensity";
import { extractSessionDurationHintSec, scanFitWorkoutStepsFromBuffer } from "@/lib/training/fit-workout-step-scan";
import {
  expandFitWorkoutStepsForImport,
  type FitWorkoutStepForImport,
} from "@/lib/training/fit-workout-step-expand";
import {
  detectFitTimeScale,
  fitStepDurationSecForImport,
  fitStepDurationSecLegacy,
  fitStepPowerTargetRatios,
  normalizeFitWktDurationType,
  type FitTimeScale,
} from "@/lib/training/fit-step-duration-decode";
import type { StructuredIntervalRow } from "./planned-structured-interval-csv";
import { formatStructuredIntervalLadderCsv } from "./planned-structured-interval-csv";

export type { FitTimeScale } from "@/lib/training/fit-step-duration-decode";
export {
  detectFitTimeScale,
  fitStepDurationSecForImport,
  fitStepDurationSecLegacy,
  normalizeFitWktDurationType,
} from "@/lib/training/fit-step-duration-decode";

export type { StructuredIntervalRow } from "./planned-structured-interval-csv";
export { formatStructuredIntervalLadderCsv } from "./planned-structured-interval-csv";

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

function planChartSegmentsToStructuredLadder(
  segments: PlanChartSegment[],
  ftpW: number,
): StructuredIntervalRow[] {
  return segments.map((seg, i) => {
    const rel = intensityToRelativeLoad(seg.intensityLabel);
    const w = Math.round(Math.max(45, rel * ftpW));
    return {
      index: i + 1,
      durationSec: Math.max(1, Math.round(seg.durationSeconds)),
      powerAvgW: w,
      powerLowW: w,
      powerHighW: w,
      durationType: "time",
      kind: "steady",
      label: seg.label?.slice(0, 120),
    };
  });
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

function ergPointsToIntervalLadder(points: ErgPoint[]): StructuredIntervalRow[] {
  const rows: StructuredIntervalRow[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const d = Math.max(1, Math.round(b.tSec - a.tSec));
    const w = Math.round(a.watts);
    rows.push({
      index: rows.length + 1,
      durationSec: d,
      powerAvgW: w,
      powerLowW: w,
      powerHighW: w,
      durationType: "time",
      kind: "steady",
      label: `${w}W`,
    });
  }
  return rows;
}

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

/** Garmin/TP: `repeat_count` su step singolo (non marker) — raro; preferire expand repeat FIT. */
function fitStepRepeatMultiplier(step: Record<string, unknown>): number {
  const dtype = normalizeFitWktDurationType(step);
  if (dtype === "repeat_until_steps_cmplt") return 1;
  const n = pickStepNumber(step, ["repeat_count", "repeatCount", "num_repetitions", "repetitions"]);
  if (n == null || !Number.isFinite(n) || n < 2) return 1;
  return Math.min(400, Math.max(2, Math.round(n)));
}

function fitStepToManualBlock(
  step: Record<string, unknown>,
  ftpW: number,
  mps: number,
  timeScale: FitTimeScale,
  legacy: boolean,
): { block: ManualPlanBlock | null; ladder: StructuredIntervalRow | null } {
  let durSec = legacy ? fitStepDurationSecLegacy(step, timeScale) : fitStepDurationSecForImport(step, mps, timeScale);
  if (durSec == null) return { block: null, ladder: null };
  durSec *= fitStepRepeatMultiplier(step);
  const { low, high } = fitStepFtpRange(step, ftpW);
  const dtype = normalizeFitWktDurationType(step);
  const wLow = Math.round(low * ftpW);
  const wHigh = Math.round(high * ftpW);
  const wAvg = Math.round(((low + high) / 2) * ftpW);
  const isRamp = Math.abs(high - low) >= 0.04;
  const ladder: StructuredIntervalRow = {
    index: 0,
    durationSec: durSec,
    powerAvgW: wAvg,
    powerLowW: wLow,
    powerHighW: wHigh,
    durationType: dtype,
    kind: isRamp ? "ramp" : "steady",
    label: fitStepLabel(step),
  };
  const dm = splitDuration(durSec);
  if (!isRamp) {
    const b = defaultManualPlanBlock("steady", fitStepLabel(step) ?? "FIT step");
    b.minutes = dm.minutes;
    b.seconds = dm.seconds;
    b.intensity = b.startIntensity = b.endIntensity = ftpFractionToZone((low + high) / 2);
    return { block: b, ladder };
  }
  const b = defaultManualPlanBlock("ramp", fitStepLabel(step) ?? "FIT ramp");
  b.minutes = dm.minutes;
  b.seconds = dm.seconds;
  b.startIntensity = ftpFractionToZone(low);
  b.endIntensity = ftpFractionToZone(high);
  b.intensity = b.endIntensity;
  return { block: b, ladder };
}

function fitInterval2ShapeToManualBlock(
  shape: NonNullable<FitWorkoutStepForImport["_fitInterval2"]>,
  ftpW: number,
  mps: number,
  timeScale: FitTimeScale,
  legacy: boolean,
): { block: ManualPlanBlock; ladderRows: StructuredIntervalRow[] } | null {
  const workParsed = fitStepToManualBlock(shape.work, ftpW, mps, timeScale, legacy);
  const recParsed = fitStepToManualBlock(shape.recovery, ftpW, mps, timeScale, legacy);
  if (!workParsed.block || !recParsed.block) return null;

  const workSec =
    workParsed.ladder?.durationSec ??
    workParsed.block.minutes * 60 + workParsed.block.seconds;
  const recSec =
    recParsed.ladder?.durationSec ??
    recParsed.block.minutes * 60 + recParsed.block.seconds;
  const repeats = Math.max(2, shape.repeats);

  const b = defaultManualPlanBlock("interval2", fitStepLabel(shape.work) ?? "Intervals");
  b.repeats = repeats;
  b.workSeconds = Math.max(10, workSec);
  b.recoverSeconds = Math.max(10, recSec);
  b.intensity = workParsed.block.intensity;
  b.intensity2 = recParsed.block.intensity;
  const totalSec = repeats * (b.workSeconds + b.recoverSeconds);
  const dm = splitDuration(totalSec);
  b.minutes = dm.minutes;
  b.seconds = dm.seconds;

  const ladderRows: StructuredIntervalRow[] = [];
  for (let r = 0; r < repeats; r += 1) {
    if (workParsed.ladder) ladderRows.push({ ...workParsed.ladder, index: ladderRows.length + 1 });
    if (recParsed.ladder) ladderRows.push({ ...recParsed.ladder, index: ladderRows.length + 1 });
  }

  return { block: b, ladderRows };
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
 * Helpers di decoding step FIT (detectFitTimeScale, fitStepDurationSecForImport,
 * fitStepDurationSecLegacy, normalizeFitWktDurationType, FitTimeScale) sono
 * importati da `@/lib/training/fit-step-duration-decode` (modulo puro testabile
 * senza dipendenza server-only) e ri-esportati piu' in alto in questo file.
 */

/**
 * Wrapper di compatibilita': delega al decoder canonico
 * `fitStepPowerTargetRatios` (modulo puro `fit-step-duration-decode`).
 *
 * Risolve regression "tutti gli step a Z7 311-346 W" su file TrainingPeaks:
 * il vecchio decoder leggeva 1105 (= 105 W con bias +1000) come watt assoluti
 * e finiva sempre clamped a 1.5×FTP (Z7). Il decoder nuovo riconosce la
 * convention Garmin SDK (value-1000 quando >= 1000 → watt; < 1000 → % FTP).
 */
function fitStepFtpRange(step: Record<string, unknown>, ftpW: number): { low: number; high: number } {
  return fitStepPowerTargetRatios(step, ftpW);
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

function scaleIntervalLadderByFactor(rows: StructuredIntervalRow[], factor: number): void {
  if (!Number.isFinite(factor) || factor < 1.06) return;
  const f = Math.min(factor, 80);
  for (const r of rows) {
    r.durationSec = Math.max(20, Math.round(r.durationSec * f));
  }
}

function fitStepLabel(step: Record<string, unknown>): string | undefined {
  const keys = ["custom_name", "customName", "wkt_step_name", "wktStepName", "notes", "message", "name"];
  for (const k of keys) {
    const v = step[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
  }
  return undefined;
}

function parseFitWorkoutToManualBlocks(
  buffer: Buffer,
  ftpW: number,
): { blocks: ManualPlanBlock[]; wktName: string | null; intervalLadder: StructuredIntervalRow[] } {
  const scan = scanFitWorkoutStepsFromBuffer(buffer);
  const rawSteps = scan.workoutSteps;
  if (!rawSteps.length) throw new Error("FIT: nessun workout step decodificabile.");
  const steps = expandFitWorkoutStepsForImport(rawSteps);
  const mps = defaultMpsFromFitWorkout(scan.workout);
  /** Decisione UNICA per il file: ms vs s. Risolve regression "step da 1440' = 24h"
   *  dovuta a Garmin FIT SDK scale=1000 sui campi time-based (TrainingPeaks export). */
  const timeScale = detectFitTimeScale(steps);
  const wn = scan.workout?.wkt_name ?? scan.workout?.wktName;
  const wktName = typeof wn === "string" && wn.trim() ? wn.trim().slice(0, 200) : null;

  const buildBlocksAndLadder = (legacy: boolean): { blocks: ManualPlanBlock[]; ladder: StructuredIntervalRow[] } => {
    const blocks: ManualPlanBlock[] = [];
    const ladder: StructuredIntervalRow[] = [];
    for (const step of steps) {
      const interval2Shape = step._fitInterval2;
      if (interval2Shape) {
        const parsed = fitInterval2ShapeToManualBlock(interval2Shape, ftpW, mps, timeScale, legacy);
        if (parsed) {
          blocks.push(parsed.block);
          for (const row of parsed.ladderRows) {
            ladder.push({ ...row, index: ladder.length + 1 });
          }
        }
        continue;
      }

      const parsed = fitStepToManualBlock(step, ftpW, mps, timeScale, legacy);
      if (!parsed.block) continue;
      if (parsed.ladder) {
        ladder.push({ ...parsed.ladder, index: ladder.length + 1 });
      }
      blocks.push(parsed.block);
    }
    return { blocks, ladder };
  };

  let first = buildBlocksAndLadder(false);
  if (!first.blocks.length) first = buildBlocksAndLadder(true);
  const { blocks, ladder: intervalLadder } = first;
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
    const factor = hintSec / sumSec;
    scaleManualPlanBlocksByFactor(blocks, factor);
    scaleIntervalLadderByFactor(intervalLadder, factor);
  }

  for (let i = 0; i < intervalLadder.length; i += 1) {
    intervalLadder[i]!.index = i + 1;
  }

  return { blocks, wktName, intervalLadder };
}

export type PlannedStructuredFormat = "zwo" | "erg" | "mrc" | "fit_workout";

export async function parseStructuredPlannedWorkoutFromBuffer(input: {
  fileName: string;
  buffer: Buffer;
  format: PlannedStructuredFormat;
  renderProfile?: Pro2RenderProfile;
}): Promise<{
  sessionName: string;
  discipline: string;
  contract: Pro2BuilderSessionContract;
  sourceVendorTag: string;
  intervalLadder: StructuredIntervalRow[];
  intervalLadderCsv: string;
}> {
  const profile: Pro2RenderProfile = input.renderProfile ?? DEFAULT_IMPORT_RENDER_PROFILE;
  const ftpW = profile.ftpW;
  let blocks: ManualPlanBlock[];
  let intervalLadder: StructuredIntervalRow[] = [];
  let sessionName = input.fileName.replace(/\.[^.]+$/, "");

  if (input.format === "zwo") {
    const text = input.buffer.toString("utf8");
    sessionName = readZwoName(text) ?? sessionName;
    blocks = parseZwoToManualBlocks(text, ftpW);
  } else if (input.format === "erg" || input.format === "mrc") {
    const text = input.buffer.toString("utf8");
    const pts = parseErgMrcPowerCourse(text);
    intervalLadder = ergPointsToIntervalLadder(pts);
    blocks = ergCourseToManualBlocks(pts, ftpW);
  } else if (input.format === "fit_workout") {
    const parsedFit = parseFitWorkoutToManualBlocks(input.buffer, ftpW);
    blocks = parsedFit.blocks;
    intervalLadder = parsedFit.intervalLadder;
    if (parsedFit.wktName) sessionName = parsedFit.wktName;
  } else {
    throw new Error("Formato strutturato non supportato.");
  }

  const expandOpts: PlanExpandOpts = {
    unit: profile.intensityUnit,
    ftpW: profile.ftpW,
    hrMax: profile.hrMax,
    lengthMode: profile.lengthMode,
    speedRefKmh: profile.speedRefKmh,
  };
  const segments = manualPlanBlocksToChartSegments(blocks, expandOpts);
  if (!intervalLadder.length) {
    intervalLadder = planChartSegmentsToStructuredLadder(segments, ftpW);
  }
  const intervalLadderCsv = formatStructuredIntervalLadderCsv(intervalLadder);

  const durationSec = segments.reduce((sum, seg) => sum + seg.durationSeconds, 0);
  const plannedSessionDurationMinutes = Math.max(1, Math.round(durationSec / 60));

  const contract = buildPro2BuilderSessionContract({
    blocks,
    renderProfile: profile,
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
    intervalLadder,
    intervalLadderCsv,
  };
}
