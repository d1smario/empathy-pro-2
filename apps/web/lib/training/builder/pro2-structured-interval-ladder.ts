/**
 * Espansione canonica contratto Builder → step ladder (grafico, tabella TP, ZWO/FIT).
 */
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import { intensityScore, zoneForTargetValue, zoneFromIntensityCue, zoneRelativeRange } from "@/lib/training/builder/pro2-intensity";
import { intensityLabelForContractBlock } from "@/lib/training/builder/pro2-session-notes";
import type { Pro2BlockChart, Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { coachNoteToTextEvents, type ZwoTextEvent } from "@/lib/training/builder/zwo-step-text-events";
import type { StructuredIntervalRow } from "@/lib/training/planned-structured-interval-csv";

export type ExpandedLadderStep = {
  id: string;
  order: number;
  label: string;
  durationSec: number;
  zoneLabel: string;
  kind: "steady" | "ramp";
  powerAvgW: number;
  powerLowW: number;
  powerHighW: number;
  coachNote?: string;
  textEvents: ZwoTextEvent[];
  barIntensityScore?: number;
  pyramidLinearT?: number;
};

function chartOrDefaults(block: Pro2BuilderBlockContract): Pro2BlockChart {
  const ch = block.chart;
  if (ch) return ch;
  return {
    minutes: Math.max(0, Math.floor(block.durationMinutes)),
    seconds: 0,
    intensity: "",
    startIntensity: "",
    endIntensity: "",
    intensity2: "",
    intensity3: "",
    repeats: 1,
    workSeconds: 180,
    recoverSeconds: 90,
    step1Seconds: 120,
    step2Seconds: 90,
    step3Seconds: 60,
    pyramidSteps: 5,
    pyramidStepSeconds: 180,
    pyramidStartTarget: 100,
    pyramidEndTarget: 200,
    distanceKm: 0,
    gradePercent: 0,
    elevationMeters: 0,
    cadence: "",
    frequencyHint: "",
    loadFactor: 1,
  };
}

function blockDurationSeconds(
  block: Pro2BuilderBlockContract,
  lengthMode: "time" | "distance",
  speedRefKmh: number,
): number {
  const ch = block.chart;
  if (lengthMode === "distance" && ch && (ch.distanceKm ?? 0) > 0) {
    return Math.max(30, Math.round((Math.max(0.1, ch.distanceKm) / Math.max(1, speedRefKmh)) * 3600));
  }
  const dm = Number(block.durationMinutes);
  if (Number.isFinite(dm) && dm > 0) return Math.max(30, Math.round(dm * 60));
  if (ch) {
    const sec = Math.max(0, ch.minutes * 60 + Math.min(59, ch.seconds));
    return Math.max(30, sec > 0 ? sec : 60);
  }
  return Math.max(60, Math.round(Math.max(0.25, Number(block.durationMinutes) || 1) * 60));
}

function wattsTripleForZoneLabel(label: string, ftpW: number): { low: number; high: number; avg: number } {
  const z = zoneFromIntensityCue(label, "Z3");
  const r = zoneRelativeRange(z);
  const low = Math.max(45, Math.round(r.min * ftpW));
  const high = Math.max(low, Math.round(r.max * ftpW));
  const avg = Math.max(45, Math.round(((r.min + r.max) / 2) * ftpW));
  return { low, high, avg };
}

type StepDraft = Omit<ExpandedLadderStep, "order">;

function draftStep(
  block: Pro2BuilderBlockContract,
  suffix: string,
  label: string,
  durationSec: number,
  zoneLabel: string,
  kind: "steady" | "ramp",
  watts: { low: number; high: number; avg: number },
  opts: { firstInBlock: boolean; extras?: Partial<StepDraft> },
): StepDraft {
  const coachNote = opts.firstInBlock ? (block.notes?.trim() || undefined) : undefined;
  return {
    id: `${block.id}-${suffix}`,
    label,
    durationSec: Math.max(1, Math.round(durationSec)),
    zoneLabel,
    kind,
    powerAvgW: watts.avg,
    powerLowW: watts.low,
    powerHighW: watts.high,
    coachNote,
    textEvents: coachNoteToTextEvents(coachNote),
    ...opts.extras,
  };
}

function expandContractBlock(block: Pro2BuilderBlockContract, contract: Pro2BuilderSessionContract): StepDraft[] {
  const kind = (block.kind ?? "steady").toLowerCase();
  const ch = chartOrDefaults(block);
  const ftpW = Math.max(1, contract.renderProfile?.ftpW ?? 250);
  const hrMax = Math.max(1, contract.renderProfile?.hrMax ?? 185);
  const unit = contract.renderProfile?.intensityUnit ?? "watt";
  const lengthMode = contract.renderProfile?.lengthMode ?? "time";
  const speedRef = contract.renderProfile?.speedRefKmh ?? 35;
  const dur = blockDurationSeconds(block, lengthMode, speedRef);
  const out: StepDraft[] = [];

  if (kind === "interval2") {
    const reps = Math.max(1, Math.round(ch.repeats || 1));
    const work = Math.max(10, Math.round(ch.workSeconds || 180));
    const rec = Math.max(10, Math.round(ch.recoverSeconds || 90));
    const zOn = zoneFromIntensityCue(String(ch.intensity || block.intensityCue || ""), "Z4");
    const zOff = zoneFromIntensityCue(String(ch.intensity2 || ""), "Z1");
    for (let i = 0; i < reps; i += 1) {
      out.push(
        draftStep(block, `w-${i}`, `${block.label} · lavoro`, work, zOn, "steady", wattsTripleForZoneLabel(zOn, ftpW), {
          firstInBlock: i === 0,
        }),
      );
      out.push(
        draftStep(block, `r-${i}`, `${block.label} · recupero`, rec, zOff, "steady", wattsTripleForZoneLabel(zOff, ftpW), {
          firstInBlock: false,
        }),
      );
    }
    return out;
  }

  if (kind === "interval3") {
    const reps = Math.max(1, Math.round(ch.repeats || 1));
    const a = Math.max(10, Math.round(ch.step1Seconds || 120));
    const b = Math.max(10, Math.round(ch.step2Seconds || 90));
    const c = Math.max(10, Math.round(ch.step3Seconds || 60));
    const z1 = zoneFromIntensityCue(String(ch.intensity || ""), "Z4");
    const z2 = zoneFromIntensityCue(String(ch.intensity2 || ""), "Z3");
    const z3 = zoneFromIntensityCue(String(ch.intensity3 || ""), "Z2");
    for (let i = 0; i < reps; i += 1) {
      out.push(draftStep(block, `a-${i}`, `${block.label} · A`, a, z1, "steady", wattsTripleForZoneLabel(z1, ftpW), { firstInBlock: i === 0 }));
      out.push(draftStep(block, `b-${i}`, `${block.label} · B`, b, z2, "steady", wattsTripleForZoneLabel(z2, ftpW), { firstInBlock: false }));
      out.push(draftStep(block, `c-${i}`, `${block.label} · C`, c, z3, "steady", wattsTripleForZoneLabel(z3, ftpW), { firstInBlock: false }));
    }
    return out;
  }

  if (kind === "pyramid") {
    const steps = Math.max(1, Math.round(ch.pyramidSteps || 1));
    const stepSec = Math.max(20, Math.round(ch.pyramidStepSeconds || 60));
    const start = ch.pyramidStartTarget || 0.75 * ftpW;
    const end = ch.pyramidEndTarget || 1.05 * ftpW;
    const span = end - start;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const spanAbs = hi - lo || 1;
    const unitLabel = unit === "watt" ? "W" : "bpm";
    for (let i = 1; i <= steps; i += 1) {
      const targetValue = Math.round(start + (span * i) / steps);
      const z = zoneForTargetValue(targetValue, unit, ftpW, hrMax);
      const pyramidLinearT = Math.min(1, Math.max(0, (targetValue - lo) / spanAbs));
      const barIntensityScore = Math.min(7, Math.max(0.35, 0.35 + pyramidLinearT * 6.65));
      out.push(
        draftStep(
          block,
          `py-${i}`,
          `${block.label} ${i}/${steps} (~${targetValue} ${unitLabel})`,
          stepSec,
          z,
          "steady",
          wattsTripleForZoneLabel(z, ftpW),
          { firstInBlock: i === 1, extras: { barIntensityScore, pyramidLinearT } },
        ),
      );
    }
    return out;
  }

  if (kind === "ramp") {
    const zStart = zoneFromIntensityCue(String(ch.startIntensity || ""), "Z2");
    const zEnd = zoneFromIntensityCue(String(ch.endIntensity || ch.intensity || ""), "Z4");
    const a = wattsTripleForZoneLabel(zStart, ftpW);
    const b = wattsTripleForZoneLabel(zEnd, ftpW);
    out.push(
      draftStep(
        block,
        "ramp",
        `${block.label} (${ch.startIntensity || "Z1"}→${zEnd})`,
        dur,
        zEnd,
        "ramp",
        { low: Math.min(a.low, b.low), high: Math.max(a.high, b.high), avg: Math.round((a.avg + b.avg) / 2) },
        { firstInBlock: true },
      ),
    );
    return out;
  }

  const z = intensityLabelForContractBlock(block);
  out.push(draftStep(block, "steady", block.label, dur, z, "steady", wattsTripleForZoneLabel(z, ftpW), { firstInBlock: true }));
  return out;
}

/** Step ladder espansi (lavoro/recupero per ripetizione). */
export function expandContractToLadderSteps(contract: Pro2BuilderSessionContract): ExpandedLadderStep[] {
  const flat: ExpandedLadderStep[] = [];
  let order = 1;
  for (const b of contract.blocks ?? []) {
    for (const draft of expandContractBlock(b, contract)) {
      flat.push({ ...draft, order: order++ });
    }
  }
  return flat;
}

export function ladderStepsToChartSegments(steps: ExpandedLadderStep[]): ChartSegment[] {
  return steps.map((s) => ({
    id: s.id,
    order: s.order,
    label: s.label,
    durationSeconds: s.durationSec,
    intensityLabel: s.zoneLabel,
    intensityScore: intensityScore(s.zoneLabel),
    barIntensityScore: s.barIntensityScore,
    pyramidLinearT: s.pyramidLinearT,
  }));
}

export function ladderStepsToStructuredIntervalRows(steps: ExpandedLadderStep[]): StructuredIntervalRow[] {
  return steps.map((s) => ({
    index: s.order,
    durationSec: s.durationSec,
    powerAvgW: s.powerAvgW,
    powerLowW: s.powerLowW,
    powerHighW: s.powerHighW,
    durationType: "time",
    kind: s.kind,
    label: s.label.slice(0, 120),
    zoneLabel: s.zoneLabel,
    coachNote: s.coachNote,
    textEvents: s.textEvents.length ? s.textEvents : undefined,
  }));
}
