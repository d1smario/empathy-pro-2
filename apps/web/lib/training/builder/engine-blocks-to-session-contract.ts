/**
 * Pipeline canonica Pro 2: motore → `TrainingBlock` → `Pro2BuilderSessionContract` con `chart` pieno.
 * VIRYA (`ViryaAnnualPlanOrchestrator`) per aerobic / technical / lifestyle deve usare solo questo
 * (non il percorso parallelo solo-`materializePro2BlocksFromEngine` → JSON senza chart).
 */
import type { AdaptationTarget } from "@/lib/training/engine";
import { materializeEngineSessionToSlimBlocks } from "@/lib/training/engine/materialize-engine-session-to-slim-blocks";
import type {
  Pro2BuilderBlockContract,
  Pro2BuilderSessionContract,
  Pro2SessionSummary,
} from "@/lib/training/builder/pro2-session-contract";

type MaterializeEngineInput = Parameters<typeof materializeEngineSessionToSlimBlocks>[0];

export type BlockKind = "steady" | "interval2" | "interval3" | "ramp" | "pyramid";
export type IntensityDisplayUnit = "watt" | "hr";
export type BlockLengthMode = "time" | "distance";

export type TrainingBlock = {
  id: string;
  name: string;
  kind: BlockKind;
  minutes: number;
  seconds: number;
  intensity: string;
  startIntensity: string;
  endIntensity: string;
  intensity2: string;
  intensity3: string;
  repeats: number;
  workSeconds: number;
  recoverSeconds: number;
  step1Seconds: number;
  step2Seconds: number;
  step3Seconds: number;
  pyramidSteps: number;
  pyramidStepSeconds: number;
  pyramidStartTarget: number;
  pyramidEndTarget: number;
  distanceKm: number;
  gradePercent: number;
  elevationMeters: number;
  cadence: string;
  frequencyHint: string;
  target: string;
  notes: string;
  loadFactor: number;
  mediaUrl?: string;
};

export type TrainingBlockSegment = {
  label: string;
  intensity: string;
  seconds: number;
  sourceBlockId: string;
  targetValue?: number;
};

export function intensityScore(intensity: string): number {
  const map: Record<string, number> = {
    Z1: 1,
    Z2: 2,
    Z3: 3,
    Z4: 4,
    Z5: 5,
    Z6: 6,
    Z7: 7,
    LT1: 3,
    LT2: 4,
    FatMax: 2,
  };
  return map[intensity] ?? 3;
}

export function intensityToRelativeLoad(intensity: string): number {
  const map: Record<string, number> = {
    Z1: 0.55,
    Z2: 0.68,
    Z3: 0.8,
    Z4: 0.92,
    Z5: 1.02,
    Z6: 1.1,
    Z7: 1.18,
    LT1: 0.78,
    LT2: 0.94,
    FatMax: 0.64,
  };
  return map[intensity] ?? 0.8;
}

export function zoneForTargetValue(value: number, unit: IntensityDisplayUnit, ftpW: number, hrMax: number): string {
  const rel = unit === "watt" ? value / Math.max(1, ftpW) : value / Math.max(1, hrMax);
  if (rel < 0.6) return "Z1";
  if (rel < 0.74) return "Z2";
  if (rel < 0.86) return "Z3";
  if (rel < 0.98) return "Z4";
  if (rel < 1.08) return "Z5";
  if (rel < 1.15) return "Z6";
  return "Z7";
}

export function defaultBlock(kind: BlockKind = "steady", name = "Nuovo blocco"): TrainingBlock {
  return {
    id: crypto.randomUUID(),
    name,
    kind,
    minutes: 10,
    seconds: 0,
    intensity: "Z2",
    startIntensity: "Z2",
    endIntensity: "Z4",
    intensity2: "Z1",
    intensity3: "Z5",
    repeats: 6,
    workSeconds: 180,
    recoverSeconds: 90,
    step1Seconds: 120,
    step2Seconds: 90,
    step3Seconds: 60,
    pyramidSteps: 5,
    pyramidStepSeconds: 180,
    pyramidStartTarget: 100,
    pyramidEndTarget: 200,
    distanceKm: 5,
    gradePercent: 0,
    elevationMeters: 0,
    cadence: "",
    frequencyHint: "",
    target: "Performance",
    notes: "",
    loadFactor: 1,
  };
}

function zoneFromIntensityCue(cue: string, fallback: string = "Z2"): string {
  const text = cue.toUpperCase();
  if (text.includes("LT2")) return "LT2";
  if (text.includes("LT1")) return "LT1";
  if (text.includes("Z7")) return "Z7";
  if (text.includes("Z6")) return "Z6";
  if (text.includes("Z5")) return "Z5";
  if (text.includes("Z4")) return "Z4";
  if (text.includes("Z3")) return "Z3";
  if (text.includes("Z2")) return "Z2";
  if (text.includes("Z1")) return "Z1";
  if (text.includes("RECOVERY") || text.includes("LOW INTENSITY") || text.includes("BREATHING")) return "Z1";
  if (text.includes("EXPLOSIVE") || text.includes("POWER")) return "Z5";
  if (text.includes("THRESHOLD")) return "LT2";
  return fallback;
}

function formatTaxonomyLabel(input: string): string {
  const value = input.replace(/_/g, " ").trim();
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function targetFromAdaptation(adaptation: string): string {
  const label = formatTaxonomyLabel(adaptation);
  return label || "Performance";
}

function blockKindFromEngineMethod(method: string): BlockKind {
  if (method === "interval" || method === "repeated_sprint") return "interval2";
  return "steady";
}

/**
 * Preset Virya / motore in `intensityCue` → work/recovery/repeats per blocchi interval
 * (solo label "Main block" per non alterare warm-up / cool-down).
 */
function intervalShapeFromViryaPreset(
  label: string,
  method: string,
  intensityCue: string,
  durationMinutes: number,
): { workSeconds: number; recoverSeconds: number; repeats: number } | null {
  if (label !== "Main block") return null;
  if (method !== "interval" && method !== "repeated_sprint") return null;
  const c = intensityCue;
  const totalSec = Math.max(600, Math.round(durationMinutes * 60 * 0.72));

  if (/PRESET_NORWEGIAN/i.test(c)) {
    const work = 8 * 60;
    const recover = 2 * 60;
    const reps = Math.max(3, Math.min(10, Math.round(totalSec / (work + recover))));
    return { workSeconds: work, recoverSeconds: recover, repeats: reps };
  }
  if (/PRESET_VO2_Z6/i.test(c)) {
    const work = 45;
    const recover = 60;
    const reps = Math.max(8, Math.min(18, Math.round(totalSec / (work + recover))));
    return { workSeconds: work, recoverSeconds: recover, repeats: reps };
  }
  if (/PRESET_VO2_Z5/i.test(c)) {
    const work = 90;
    const recover = 90;
    const reps = Math.max(5, Math.min(14, Math.round(totalSec / (work + recover))));
    return { workSeconds: work, recoverSeconds: recover, repeats: reps };
  }
  if (/PRESET_LACTATE_MAX/i.test(c)) {
    const work = 40;
    const recover = 80;
    const reps = Math.max(10, Math.min(24, Math.round(totalSec / (work + recover))));
    return { workSeconds: work, recoverSeconds: recover, repeats: reps };
  }
  if (/PRESET_ON_OFF/i.test(c)) {
    const work = 3 * 60;
    const recover = 90;
    const reps = Math.max(6, Math.min(16, Math.round(totalSec / (work + recover))));
    return { workSeconds: work, recoverSeconds: recover, repeats: reps };
  }
  if (/PRESET_LADDER/i.test(c)) {
    const work = 5 * 60;
    const recover = 2 * 60;
    const reps = Math.max(4, Math.min(12, Math.round(totalSec / (work + recover))));
    return { workSeconds: work, recoverSeconds: recover, repeats: reps };
  }
  return null;
}

function loadFactorFromEngineMethod(method: string): number {
  if (method === "flow_recovery") return 0.55;
  if (method === "technical_drill") return 0.8;
  if (method === "mixed_circuit") return 1.05;
  if (method === "strength_sets") return 1.2;
  if (method === "power_sets") return 1.15;
  if (method === "repeated_sprint") return 1.3;
  if (method === "interval") return 1.18;
  return 0.95;
}

function blockMediaUrl(block: Pro2BuilderBlockContract): string | undefined {
  return block.mediaUrl ?? block.lifestyleRx?.mediaUrl;
}

export function mapEngineSessionToTrainingBlocks(input: MaterializeEngineInput): TrainingBlock[] {
  const builderBlocks = materializeEngineSessionToSlimBlocks(input);
  return builderBlocks.map((block, index) => {
    const method = String(block.kind ?? "steady");
    const intensityCue = String(block.intensityCue ?? "");
    const primaryZone = zoneFromIntensityCue(intensityCue, method === "flow_recovery" ? "Z1" : "Z2");
    const secondaryZone = method === "interval" || method === "repeated_sprint" ? "Z1" : "Z2";
    const durationMinutes = Math.max(4, Math.round(Number(block.durationMinutes ?? 10) || 10));
    const labelStr = String(block.label ?? `Block ${index + 1}`);
    const presetShape = intervalShapeFromViryaPreset(labelStr, method, intensityCue, durationMinutes);
    const intervalWork = presetShape
      ? presetShape.workSeconds
      : Math.max(30, Math.round((durationMinutes * 60) / 6));
    const intervalRecover = presetShape
      ? presetShape.recoverSeconds
      : Math.max(20, Math.round(intervalWork / 2));
    const intervalRepeats = presetShape
      ? presetShape.repeats
      : Math.max(3, Math.round(durationMinutes / 4));

    return {
      ...defaultBlock(blockKindFromEngineMethod(method), labelStr),
      minutes: durationMinutes,
      seconds: 0,
      intensity: primaryZone,
      startIntensity: method === "flow_recovery" ? "Z1" : primaryZone,
      endIntensity: primaryZone,
      intensity2: secondaryZone,
      intensity3: "Z5",
      repeats: intervalRepeats,
      workSeconds: intervalWork,
      recoverSeconds: intervalRecover,
      target: targetFromAdaptation(String(block.target ?? "")),
      notes: [intensityCue, block.notes ?? ""].filter(Boolean).join(" | "),
      loadFactor: loadFactorFromEngineMethod(method),
      mediaUrl: blockMediaUrl(block),
    };
  });
}

export function mapEngineBlocksToBuilderBlocks(
  session: Record<string, unknown>,
  blockExercises?: Array<Record<string, unknown>>,
): TrainingBlock[] {
  return mapEngineSessionToTrainingBlocks({
    session,
    blockExercises,
    fallbackDurationMinutes: 10,
  });
}

function resolveBlockDurationSeconds(block: TrainingBlock, lengthMode: BlockLengthMode, speedRefKmh: number): number {
  if (lengthMode === "distance" && (block.kind === "steady" || block.kind === "ramp" || block.kind === "pyramid")) {
    const km = Math.max(0.1, block.distanceKm || 0);
    return Math.max(30, Math.round((km / Math.max(1, speedRefKmh)) * 3600));
  }
  return Math.max(30, block.minutes * 60 + block.seconds);
}

export function expandBlockSegments(
  block: TrainingBlock,
  opts: {
    unit: IntensityDisplayUnit;
    ftpW: number;
    hrMax: number;
    lengthMode: BlockLengthMode;
    speedRefKmh: number;
  },
): TrainingBlockSegment[] {
  if (block.kind === "steady") {
    return [
      {
        label: block.name,
        intensity: block.intensity,
        seconds: resolveBlockDurationSeconds(block, opts.lengthMode, opts.speedRefKmh),
        sourceBlockId: block.id,
      },
    ];
  }
  if (block.kind === "ramp") {
    return [
      {
        label: `${block.name} ${block.startIntensity}->${block.endIntensity}`,
        intensity: block.endIntensity,
        seconds: resolveBlockDurationSeconds(block, opts.lengthMode, opts.speedRefKmh),
        sourceBlockId: block.id,
      },
    ];
  }
  if (block.kind === "pyramid") {
    const steps = Math.max(1, block.pyramidSteps || 1);
    const stepSeconds = Math.max(20, block.pyramidStepSeconds || 20);
    const start = block.pyramidStartTarget;
    const end = block.pyramidEndTarget;
    const stepDelta = (end - start) / steps;
    const out: TrainingBlockSegment[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const targetValue = Math.round((start + stepDelta * i) * 10) / 10;
      out.push({
        label: `${block.name} step ${i + 1}/${steps + 1}`,
        intensity: zoneForTargetValue(targetValue, opts.unit, opts.ftpW, opts.hrMax),
        seconds: stepSeconds,
        sourceBlockId: block.id,
        targetValue,
      });
    }
    return out;
  }
  if (block.kind === "interval2") {
    const reps = Math.max(1, block.repeats);
    const work = Math.max(10, block.workSeconds);
    const rec = Math.max(10, block.recoverSeconds);
    const out: TrainingBlockSegment[] = [];
    for (let i = 0; i < reps; i += 1) {
      out.push({ label: `${block.name} work`, intensity: block.intensity, seconds: work, sourceBlockId: block.id });
      out.push({ label: `${block.name} rec`, intensity: block.intensity2, seconds: rec, sourceBlockId: block.id });
    }
    return out;
  }
  const reps = Math.max(1, block.repeats);
  const a = Math.max(10, block.step1Seconds);
  const b = Math.max(10, block.step2Seconds);
  const c = Math.max(10, block.step3Seconds);
  const out: TrainingBlockSegment[] = [];
  for (let i = 0; i < reps; i += 1) {
    out.push({ label: `${block.name} A`, intensity: block.intensity, seconds: a, sourceBlockId: block.id });
    out.push({ label: `${block.name} B`, intensity: block.intensity2, seconds: b, sourceBlockId: block.id });
    out.push({ label: `${block.name} C`, intensity: block.intensity3, seconds: c, sourceBlockId: block.id });
  }
  return out;
}

export function summarizeTrainingBlocks(
  blocks: TrainingBlock[],
  opts: { unit: IntensityDisplayUnit; ftpW: number; hrMax: number; lengthMode: BlockLengthMode; speedRefKmh: number },
): Pro2SessionSummary {
  const durationSec = blocks.flatMap((b) => expandBlockSegments(b, opts)).reduce((sum, s) => sum + s.seconds, 0);
  const tss = Math.round(
    blocks.reduce((sum, b) => {
      const avgIntensity =
        b.kind === "steady"
          ? intensityScore(b.intensity)
          : b.kind === "ramp"
            ? (intensityScore(b.startIntensity) + intensityScore(b.endIntensity)) / 2
            : b.kind === "interval2"
              ? (intensityScore(b.intensity) + intensityScore(b.intensity2)) / 2
              : b.kind === "pyramid"
                ? (intensityScore(zoneForTargetValue(b.pyramidStartTarget, opts.unit, opts.ftpW, opts.hrMax)) +
                    intensityScore(zoneForTargetValue(b.pyramidEndTarget, opts.unit, opts.ftpW, opts.hrMax))) /
                  2
                : (intensityScore(b.intensity) + intensityScore(b.intensity2) + intensityScore(b.intensity3)) / 3;
      const mins = expandBlockSegments(b, opts).reduce((acc, seg) => acc + seg.seconds, 0) / 60;
      return sum + mins * b.loadFactor * (0.45 + avgIntensity * 0.2);
    }, 0),
  );
  const totalWorkJ = blocks.reduce((sum, b) => {
    const secs = expandBlockSegments(b, opts).reduce((acc, seg) => acc + seg.seconds, 0);
    const rel =
      b.kind === "steady"
        ? intensityToRelativeLoad(b.intensity)
        : b.kind === "ramp"
          ? (intensityToRelativeLoad(b.startIntensity) + intensityToRelativeLoad(b.endIntensity)) / 2
          : b.kind === "interval2"
            ? (intensityToRelativeLoad(b.intensity) + intensityToRelativeLoad(b.intensity2)) / 2
            : b.kind === "pyramid"
              ? (b.pyramidStartTarget + b.pyramidEndTarget) / 2 / Math.max(1, opts.ftpW)
              : (intensityToRelativeLoad(b.intensity) + intensityToRelativeLoad(b.intensity2) + intensityToRelativeLoad(b.intensity3)) / 3;
    const estPower = Math.max(60, Math.round(opts.ftpW * rel));
    return sum + estPower * secs;
  }, 0);
  const kj = Math.round(totalWorkJ / 1000);
  const avgPowerW = durationSec > 0 ? Math.round(totalWorkJ / durationSec) : 0;
  const kcal = Math.round(Math.max(0, tss) * 9.3);
  return { durationSec, tss, kcal, kj, avgPowerW };
}

export const summarizeBlocks = summarizeTrainingBlocks;

function scaleRounded(value: number, scale: number, minimum = 0) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.max(minimum, Math.round(value * scale));
}

function scaleDecimal(value: number, scale: number, digits = 1) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const factor = 10 ** digits;
  return Math.round(value * scale * factor) / factor;
}

export function scaleTrainingBlock(block: TrainingBlock, scale: number): TrainingBlock {
  return {
    ...block,
    minutes: block.minutes > 0 ? scaleRounded(block.minutes, scale, 1) : 0,
    seconds: block.seconds > 0 ? scaleRounded(block.seconds, scale, 1) : 0,
    workSeconds: block.workSeconds > 0 ? scaleRounded(block.workSeconds, scale, 1) : 0,
    recoverSeconds: block.recoverSeconds > 0 ? scaleRounded(block.recoverSeconds, scale, 1) : 0,
    step1Seconds: block.step1Seconds > 0 ? scaleRounded(block.step1Seconds, scale, 1) : 0,
    step2Seconds: block.step2Seconds > 0 ? scaleRounded(block.step2Seconds, scale, 1) : 0,
    step3Seconds: block.step3Seconds > 0 ? scaleRounded(block.step3Seconds, scale, 1) : 0,
    pyramidStepSeconds: block.pyramidStepSeconds > 0 ? scaleRounded(block.pyramidStepSeconds, scale, 1) : 0,
    distanceKm: block.distanceKm > 0 ? scaleDecimal(block.distanceKm, scale, 2) : 0,
    elevationMeters: block.elevationMeters > 0 ? scaleRounded(block.elevationMeters, scale, 1) : 0,
  };
}

export function buildPro2BlockSessionContract(input: {
  discipline: string;
  family: "aerobic" | "technical" | "lifestyle";
  sessionName: string;
  adaptationTarget?: AdaptationTarget;
  phase?: string;
  summary: Pro2SessionSummary;
  plannedSessionDurationMinutes?: number;
  blocks: TrainingBlock[];
  unit: IntensityDisplayUnit;
  ftpW: number;
  hrMax: number;
  lengthMode: BlockLengthMode;
  speedRefKmh: number;
}): Pro2BuilderSessionContract {
  const blocksOut: Pro2BuilderBlockContract[] = input.blocks.map((block) => ({
    id: block.id,
    label: block.name,
    kind: block.kind,
    durationMinutes:
      Math.round(
        (expandBlockSegments(block, {
          unit: input.unit,
          ftpW: input.ftpW,
          hrMax: input.hrMax,
          lengthMode: input.lengthMode,
          speedRefKmh: input.speedRefKmh,
        }).reduce((sum, segment) => sum + segment.seconds, 0) /
          60) *
          10,
      ) / 10,
    intensityCue:
      block.kind === "ramp"
        ? `${block.startIntensity}->${block.endIntensity}`
        : block.kind === "interval2"
          ? `${block.intensity}/${block.intensity2}`
          : block.kind === "interval3"
            ? `${block.intensity}/${block.intensity2}/${block.intensity3}`
            : block.intensity,
    target: block.target,
    notes: block.notes,
    mediaUrl: block.mediaUrl,
    chart: {
      minutes: block.minutes,
      seconds: block.seconds,
      intensity: block.intensity,
      startIntensity: block.startIntensity,
      endIntensity: block.endIntensity,
      intensity2: block.intensity2,
      intensity3: block.intensity3,
      repeats: block.repeats,
      workSeconds: block.workSeconds,
      recoverSeconds: block.recoverSeconds,
      step1Seconds: block.step1Seconds,
      step2Seconds: block.step2Seconds,
      step3Seconds: block.step3Seconds,
      pyramidSteps: block.pyramidSteps,
      pyramidStepSeconds: block.pyramidStepSeconds,
      pyramidStartTarget: block.pyramidStartTarget,
      pyramidEndTarget: block.pyramidEndTarget,
      distanceKm: block.distanceKm,
      gradePercent: block.gradePercent,
      elevationMeters: block.elevationMeters,
      cadence: block.cadence,
      frequencyHint: block.frequencyHint,
      loadFactor: block.loadFactor,
    },
  }));

  return {
    version: 1,
    source: "builder",
    family: input.family,
    discipline: input.discipline,
    sessionName: input.sessionName || input.discipline,
    adaptationTarget: input.adaptationTarget,
    phase: input.phase,
    plannedSessionDurationMinutes: input.plannedSessionDurationMinutes,
    summary: input.summary,
    renderProfile: {
      intensityUnit: input.unit,
      ftpW: input.ftpW,
      hrMax: input.hrMax,
      lengthMode: input.lengthMode,
      speedRefKmh: input.speedRefKmh,
    },
    blocks: blocksOut,
  };
}
