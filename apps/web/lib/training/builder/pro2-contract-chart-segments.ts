/**
 * Espansione contratto Builder → segmenti timeline (grafico Calendar / Session).
 * Allineato a `pro2BuilderContractToStructuredIntervalRows` (ZWO/FIT) e `expandPlanBlockSegments` (Builder manuale).
 */
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import { intensityScore, zoneForTargetValue, zoneFromIntensityCue } from "@/lib/training/builder/pro2-intensity";
import type { Pro2BlockChart, Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
function intensityLabelForChartBlock(b: Pro2BuilderBlockContract): string {
  const lbl = (b.label ?? "").toLowerCase();
  if (/\bwarm-up\b|riscaldamento|\bwarm\b/i.test(lbl) && !/cool/.test(lbl)) return "Z1";
  if (/\bcool-down\b|defaticamento|\bcool\b/i.test(lbl)) return "Z2";
  const ch0 = (b.chart?.intensity ?? "").trim();
  if (ch0) {
    const canon = ch0.match(/\b(Z[1-7]|LT1|LT2|FatMax)\b/i);
    if (canon) return /^fatmax$/i.test(canon[1]!) ? "FatMax" : canon[1]!.toUpperCase();
  }
  const cue = (b.intensityCue ?? "").trim();
  const m = cue.match(/\b(Z[1-7]|LT1|LT2|FatMax)\b/i);
  if (m) return /^fatmax$/i.test(m[1]!) ? "FatMax" : m[1]!.toUpperCase();
  return "Z3";
}

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

function segment(
  id: string,
  order: number,
  label: string,
  durationSeconds: number,
  intensityLabel: string,
  extras?: Partial<ChartSegment>,
): ChartSegment {
  return {
    id,
    order,
    label,
    durationSeconds: Math.max(1, Math.round(durationSeconds)),
    intensityLabel,
    intensityScore: intensityScore(intensityLabel),
    ...extras,
  };
}

function expandContractBlock(
  block: Pro2BuilderBlockContract,
  contract: Pro2BuilderSessionContract,
  orderStart: number,
): ChartSegment[] {
  const kind = (block.kind ?? "steady").toLowerCase();
  const ch = chartOrDefaults(block);
  const ftpW = Math.max(1, contract.renderProfile?.ftpW ?? 250);
  const hrMax = Math.max(1, contract.renderProfile?.hrMax ?? 185);
  const unit = contract.renderProfile?.intensityUnit ?? "watt";
  const lengthMode = contract.renderProfile?.lengthMode ?? "time";
  const speedRef = contract.renderProfile?.speedRefKmh ?? 35;
  const dur = blockDurationSeconds(block, lengthMode, speedRef);
  let order = orderStart;
  const out: ChartSegment[] = [];

  const push = (label: string, seconds: number, zoneLabel: string, suffix: string, extras?: Partial<ChartSegment>) => {
    out.push(segment(`${block.id}-${suffix}`, order++, label, seconds, zoneLabel, extras));
  };

  if (kind === "interval2") {
    const reps = Math.max(1, Math.round(ch.repeats || 1));
    const work = Math.max(10, Math.round(ch.workSeconds || 180));
    const rec = Math.max(10, Math.round(ch.recoverSeconds || 90));
    const zOn = zoneFromIntensityCue(String(ch.intensity || block.intensityCue || ""), "Z4");
    const zOff = zoneFromIntensityCue(String(ch.intensity2 || ""), "Z1");
    for (let i = 0; i < reps; i += 1) {
      push(`${block.label} · lavoro`, work, zOn, `w-${i}`);
      push(`${block.label} · recupero`, rec, zOff, `r-${i}`);
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
      push(`${block.label} · A`, a, z1, `a-${i}`);
      push(`${block.label} · B`, b, z2, `b-${i}`);
      push(`${block.label} · C`, c, z3, `c-${i}`);
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
      push(
        `${block.label} ${i}/${steps} (~${targetValue} ${unitLabel})`,
        stepSec,
        z,
        `py-${i}`,
        { barIntensityScore, pyramidLinearT },
      );
    }
    return out;
  }

  if (kind === "ramp") {
    const zEnd = zoneFromIntensityCue(String(ch.endIntensity || ch.intensity || ""), "Z3");
    push(`${block.label} (${ch.startIntensity || "Z1"}→${zEnd})`, dur, zEnd, "ramp");
    return out;
  }

  const z = intensityLabelForChartBlock(block);
  push(block.label, dur, z, "steady");
  return out;
}

/** Segmenti espansi per UI (Calendar, Session): ogni lavoro/recupero è una barra, non un solo rettangolo per blocco logico. */
export function pro2BuilderContractToExpandedChartSegments(contract: Pro2BuilderSessionContract): ChartSegment[] {
  const blocks = contract.blocks ?? [];
  const flat: ChartSegment[] = [];
  let order = 1;
  for (const b of blocks) {
    for (const seg of expandContractBlock(b, contract, order)) {
      flat.push({ ...seg, order: order++ });
    }
  }
  return flat;
}
