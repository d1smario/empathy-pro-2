/**
 * Espansione contratto Builder → segmenti timeline (grafico Calendar / Session).
 * Delega a `expandContractToLadderSteps` (canonico con export ZWO/FIT).
 */
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  expandContractToLadderSteps,
  ladderStepsToChartSegments,
} from "@/lib/training/builder/pro2-structured-interval-ladder";

/** Segmenti espansi per UI: ogni lavoro/recupero è una barra. */
export function pro2BuilderContractToExpandedChartSegments(contract: Pro2BuilderSessionContract): ChartSegment[] {
  return ladderStepsToChartSegments(expandContractToLadderSteps(contract));
}
