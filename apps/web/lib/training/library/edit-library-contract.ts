import type { Pro2BlockChart, Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { estimatedTssFromPro2Contract } from "@/lib/training/builder/pro2-session-notes";
import { normalizeSessionDurationMinutes, PLANNED_SESSION_DURATION_MAX_MIN } from "@/lib/training/builder/session-duration-choices";
import { scaleLibraryContract } from "@/lib/training/library/scale-library-contract";

function scaleRounded(value: number, scale: number, minimum = 1): number {
  if (!Number.isFinite(value) || value <= 0) return minimum;
  return Math.max(minimum, Math.round(value * scale));
}

function scaleChartTiming(chart: Pro2BlockChart, scale: number): Pro2BlockChart {
  return {
    ...chart,
    minutes: chart.minutes > 0 ? scaleRounded(chart.minutes, scale, 0) : 0,
    seconds: chart.seconds > 0 ? scaleRounded(chart.seconds, scale, 0) : 0,
    workSeconds: chart.workSeconds > 0 ? scaleRounded(chart.workSeconds, scale, 1) : 0,
    recoverSeconds: chart.recoverSeconds > 0 ? scaleRounded(chart.recoverSeconds, scale, 1) : 0,
    step1Seconds: chart.step1Seconds > 0 ? scaleRounded(chart.step1Seconds, scale, 1) : 0,
    step2Seconds: chart.step2Seconds > 0 ? scaleRounded(chart.step2Seconds, scale, 1) : 0,
    step3Seconds: chart.step3Seconds > 0 ? scaleRounded(chart.step3Seconds, scale, 1) : 0,
    pyramidStepSeconds: chart.pyramidStepSeconds > 0 ? scaleRounded(chart.pyramidStepSeconds, scale, 1) : 0,
  };
}

export function estimateBlockDurationMinutes(block: Pro2BuilderBlockContract): number {
  const ch = block.chart;
  if (!ch) return Math.max(1, Math.round(Number(block.durationMinutes) || 10));
  const baseSec = Math.max(0, (ch.minutes || 0) * 60 + (ch.seconds || 0));
  const reps = Math.max(1, Math.round(Number(ch.repeats) || 1));
  const work = Math.max(0, Math.round(Number(ch.workSeconds) || 0));
  const rec = Math.max(0, Math.round(Number(ch.recoverSeconds) || 0));
  const intervalSec = work > 0 || rec > 0 ? reps * (work + rec) : 0;
  const pyramidSec =
    (ch.pyramidSteps ?? 0) > 0 && (ch.pyramidStepSeconds ?? 0) > 0
      ? Math.max(0, ch.pyramidSteps) * Math.max(0, ch.pyramidStepSeconds)
      : 0;
  const totalSec = Math.max(baseSec, intervalSec, pyramidSec, baseSec + intervalSec);
  if (totalSec > 0) return Math.max(1, Math.ceil(totalSec / 60));
  return Math.max(1, Math.round(Number(block.durationMinutes) || 10));
}

function blockWithDuration(block: Pro2BuilderBlockContract): Pro2BuilderBlockContract {
  return { ...block, durationMinutes: estimateBlockDurationMinutes(block) };
}

export function refreshLibraryContractMetrics(contract: Pro2BuilderSessionContract): Pro2BuilderSessionContract {
  const blocks = (contract.blocks ?? []).map(blockWithDuration);
  const structureSec = blocks.reduce((s, b) => s + (Number(b.durationMinutes) || 0) * 60, 0);
  const plannedMin =
    contract.plannedSessionDurationMinutes != null && contract.plannedSessionDurationMinutes > 0
      ? normalizeSessionDurationMinutes(contract.plannedSessionDurationMinutes)
      : null;
  const durationSec = Math.max(structureSec, (plannedMin ?? 0) * 60, 60);
  const tss = estimatedTssFromPro2Contract({ ...contract, blocks });
  const prev = contract.summary;
  return {
    ...contract,
    blocks,
    plannedSessionDurationMinutes: plannedMin ?? undefined,
    summary: {
      durationSec,
      tss: tss > 0 ? tss : Math.max(0, Math.round(prev?.tss ?? 0)),
      kcal: prev?.kcal ?? 0,
      kj: prev?.kj ?? 0,
      avgPowerW: prev?.avgPowerW ?? 0,
    },
  };
}

/** Scala tempi (intervalli, minuti blocco) senza clamp da load twin — per editing manuale in libreria. */
export function scaleLibraryContractTiming(
  contract: Pro2BuilderSessionContract,
  factor: number,
): Pro2BuilderSessionContract {
  const scale = Math.max(0.25, Math.min(3, Number(factor) || 1));
  if (scale >= 0.999 && scale <= 1.001) return refreshLibraryContractMetrics(contract);
  const blocks = (contract.blocks ?? []).map((block) => {
    const chart = block.chart ? scaleChartTiming(block.chart, scale) : block.chart;
    const next = {
      ...block,
      durationMinutes: scaleRounded(Number(block.durationMinutes ?? 0) || 10, scale, 1),
      chart,
    };
    return blockWithDuration(next);
  });
  const planned =
    contract.plannedSessionDurationMinutes != null && contract.plannedSessionDurationMinutes > 0
      ? normalizeSessionDurationMinutes(scaleRounded(contract.plannedSessionDurationMinutes, scale, 1))
      : contract.plannedSessionDurationMinutes;
  return refreshLibraryContractMetrics({
    ...contract,
    blocks,
    plannedSessionDurationMinutes: planned,
  });
}

export type LibraryBlockPatch = {
  durationMinutes?: number;
  repeats?: number;
  workSeconds?: number;
  recoverSeconds?: number;
  gymSets?: number;
};

export function patchLibraryContractBlock(
  contract: Pro2BuilderSessionContract,
  blockId: string,
  patch: LibraryBlockPatch,
): Pro2BuilderSessionContract {
  const blocks = (contract.blocks ?? []).map((block) => {
    if (block.id !== blockId) return block;
    let next: Pro2BuilderBlockContract = { ...block };
    if (patch.durationMinutes != null) {
      const dm = Math.max(1, Math.min(PLANNED_SESSION_DURATION_MAX_MIN, Math.round(patch.durationMinutes)));
      next = { ...next, durationMinutes: dm };
      if (next.chart) {
        next = {
          ...next,
          chart: { ...next.chart, minutes: dm, seconds: 0 },
        };
      }
    }
    if (next.chart) {
      const ch = { ...next.chart };
      if (patch.repeats != null) ch.repeats = Math.max(1, Math.min(99, Math.round(patch.repeats)));
      if (patch.workSeconds != null) ch.workSeconds = Math.max(0, Math.min(7200, Math.round(patch.workSeconds)));
      if (patch.recoverSeconds != null) ch.recoverSeconds = Math.max(0, Math.min(7200, Math.round(patch.recoverSeconds)));
      next = { ...next, chart: ch };
    }
    if (patch.gymSets != null && next.gymRx) {
      next = {
        ...next,
        gymRx: { ...next.gymRx, sets: Math.max(1, Math.min(20, Math.round(patch.gymSets))) },
      };
    }
    return blockWithDuration(next);
  });
  return refreshLibraryContractMetrics({ ...contract, blocks });
}

export function setLibraryContractPlannedDuration(
  contract: Pro2BuilderSessionContract,
  minutes: number,
): Pro2BuilderSessionContract {
  const plannedSessionDurationMinutes = normalizeSessionDurationMinutes(minutes);
  return refreshLibraryContractMetrics({ ...contract, plannedSessionDurationMinutes });
}

/** Applica load twin scaling (stesso path dell'apply con checkbox). */
export function applyLibraryContractLoadScale(
  contract: Pro2BuilderSessionContract,
  loadScale: number,
): Pro2BuilderSessionContract {
  return refreshLibraryContractMetrics(scaleLibraryContract(contract, loadScale));
}
