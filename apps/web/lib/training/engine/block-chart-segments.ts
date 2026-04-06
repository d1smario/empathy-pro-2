import { zoneFromIntensityCue, intensityScore } from "@/lib/training/builder/pro2-intensity";
import {
  manualPlanBlocksToChartSegments,
  type ManualPlanBlock,
  type PlanChartSegment,
  type PlanExpandOpts,
} from "@/lib/training/builder/manual-plan-block";
import type { SessionBlock } from "@/lib/training/engine/types";

/** Segmento timeline (durata in secondi, etichetta intensità Pro2). */
export type ChartSegment = PlanChartSegment;

export type { ManualPlanBlock, PlanExpandOpts };

export function sessionBlocksToChartSegments(blocks: SessionBlock[]): ChartSegment[] {
  return blocks.map((b) => {
    const fallback = b.method === "flow_recovery" ? "Z1" : "Z2";
    const label = zoneFromIntensityCue(b.intensityCue, fallback);
    const sec = Math.max(60, Math.round((Number(b.durationMinutes) || 1) * 60));
    return {
      id: `block-${b.order}`,
      order: b.order,
      label: b.label,
      durationSeconds: sec,
      intensityLabel: label,
      intensityScore: intensityScore(label),
    };
  });
}

export function manualBlocksToChartSegments(blocks: ManualPlanBlock[], opts: PlanExpandOpts): ChartSegment[] {
  return manualPlanBlocksToChartSegments(blocks, opts);
}
