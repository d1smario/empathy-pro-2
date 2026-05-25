import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { Pro2BlockChart } from "@/lib/training/builder/pro2-session-contract";

function clampScale(scale: number, opts?: { clampMin?: number; clampMax?: number }): number {
  const min = opts?.clampMin ?? 0.35;
  const max = opts?.clampMax ?? 1.05;
  return Math.max(min, Math.min(max, scale));
}

function scaleRounded(value: number, scale: number, minimum = 1): number {
  if (!Number.isFinite(value) || value <= 0) return minimum;
  return Math.max(minimum, Math.round(value * scale));
}

function scaleChart(chart: Pro2BlockChart, scale: number): Pro2BlockChart {
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

/**
 * Scala contratto library per load operativo (blocchi + summary).
 * Deterministico — stesso loadScale del builder operational scaling.
 */
export function scaleLibraryContract(
  contract: Pro2BuilderSessionContract,
  loadScaleRaw: number,
  opts?: { clampMin?: number; clampMax?: number },
): Pro2BuilderSessionContract {
  const loadScale = clampScale(loadScaleRaw, opts);
  if (loadScale >= 0.999 && loadScale <= 1.001) {
    return contract;
  }

  const blocks = (contract.blocks ?? []).map((block) => {
    const chart = block.chart ? scaleChart(block.chart, loadScale) : block.chart;
    return {
      ...block,
      durationMinutes: scaleRounded(Number(block.durationMinutes ?? 0) || 10, loadScale, 1),
      chart,
    };
  });

  const summary = contract.summary
    ? {
        ...contract.summary,
        durationSec: scaleRounded(contract.summary.durationSec ?? 3600, loadScale, 60),
        tss: scaleRounded(contract.summary.tss ?? 0, loadScale, 0),
        kcal:
          contract.summary.kcal != null && contract.summary.kcal > 0
            ? scaleRounded(contract.summary.kcal, loadScale, 0)
            : contract.summary.kcal,
        kj:
          contract.summary.kj != null && contract.summary.kj > 0
            ? scaleRounded(contract.summary.kj, loadScale, 0)
            : contract.summary.kj,
      }
    : contract.summary;

  const plannedSessionDurationMinutes =
    contract.plannedSessionDurationMinutes != null && contract.plannedSessionDurationMinutes > 0
      ? scaleRounded(contract.plannedSessionDurationMinutes, loadScale, 1)
      : summary?.durationSec != null
        ? Math.max(1, Math.round(summary.durationSec / 60))
        : contract.plannedSessionDurationMinutes;

  return {
    ...contract,
    blocks,
    summary,
    plannedSessionDurationMinutes,
  };
}
