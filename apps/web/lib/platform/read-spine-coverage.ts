import type { AthleteMemory } from "@/lib/empathy/schemas";
import { COACH_APPLICATION_EVIDENCE_SOURCE } from "@/lib/memory/coach-application-traces";

/**
 * Operational read-spine coverage from a resolved AthleteMemory payload.
 * Used to drive dashboard/dev tooling and to verify "effective" cross-module state
 * without implying clinical completeness.
 *
 * Le API che espongono questo riepilogo devono essere dietro lo stesso gate atleta di
 * `@/lib/auth/athlete-read-context` (`requireAthleteReadContext`), così la copertura riflette
 * dati letti con policy unica.
 */
export type ReadSpineCoverageSummary = {
  hasProfile: boolean;
  hasPhysiology: boolean;
  hasTwin: boolean;
  hasNutritionConstraints: boolean;
  hasNutritionDiary: boolean;
  hasHealthPanels: boolean;
  /** L8: snapshot tabellari separati da `biomarker_panels`. */
  hasSystemicModulationSnapshots: boolean;
  hasRealityIngestions: boolean;
  hasEvidenceItems: boolean;
  /** Voci da `athlete_coach_application_traces` mappate in evidenceMemory (source coach_manual_action). */
  hasCoachApplicationMemory: boolean;
  physiologySources: PhysiologySourceFlags | null;
  /** 0–100 rough score: equal weights on core blocks */
  spineScore: number;
};

export type PhysiologySourceFlags = {
  physiologicalProfile: boolean;
  metabolicRun: boolean;
  lactateRun: boolean;
  performanceRun: boolean;
  biomarkerPanel: boolean;
};

export function summarizeReadSpineCoverage(memory: AthleteMemory | null): ReadSpineCoverageSummary {
  if (!memory) {
    return {
      hasProfile: false,
      hasPhysiology: false,
      hasTwin: false,
      hasNutritionConstraints: false,
      hasNutritionDiary: false,
      hasHealthPanels: false,
      hasSystemicModulationSnapshots: false,
      hasRealityIngestions: false,
      hasEvidenceItems: false,
      hasCoachApplicationMemory: false,
      physiologySources: null,
      spineScore: 0,
    };
  }

  const hasProfile = memory.profile != null;
  const hasPhysiology = memory.physiology != null;
  const hasTwin = memory.twin != null;
  const hasNutritionConstraints = memory.nutrition?.constraints != null;
  const hasNutritionDiary = (memory.nutrition?.diary?.length ?? 0) > 0;
  const hasHealthPanels = (memory.health?.panels?.length ?? 0) > 0;
  const hasSystemicModulationSnapshots = (memory.health?.systemicModulationSnapshots?.length ?? 0) > 0;
  const hasRealityIngestions = (memory.reality?.recentIngestions?.length ?? 0) > 0;
  const items = memory.evidenceMemory?.items ?? [];
  const hasEvidenceItems = items.length > 0;
  const hasCoachApplicationMemory = items.some((it) => it.source === COACH_APPLICATION_EVIDENCE_SOURCE);

  const physiologySources: PhysiologySourceFlags | null = memory.physiology
    ? { ...memory.physiology.sources }
    : null;

  const weights = [
    hasProfile,
    hasPhysiology,
    hasTwin,
    hasNutritionConstraints || hasNutritionDiary,
    hasHealthPanels,
    hasRealityIngestions,
  ];
  const trueCount = weights.filter(Boolean).length;
  const spineScore = Math.round((trueCount / weights.length) * 100);

  return {
    hasProfile,
    hasPhysiology,
    hasTwin,
    hasNutritionConstraints,
    hasNutritionDiary,
    hasHealthPanels,
    hasSystemicModulationSnapshots,
    hasRealityIngestions,
    hasEvidenceItems,
    hasCoachApplicationMemory,
    physiologySources,
    spineScore,
  };
}
