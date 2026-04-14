import type { AthleteMemory } from "@/lib/empathy/schemas";

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
  hasRealityIngestions: boolean;
  hasEvidenceItems: boolean;
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
      hasRealityIngestions: false,
      hasEvidenceItems: false,
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
  const hasRealityIngestions = (memory.reality?.recentIngestions?.length ?? 0) > 0;
  const hasEvidenceItems = (memory.evidenceMemory?.items?.length ?? 0) > 0;

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
    hasRealityIngestions,
    hasEvidenceItems,
    physiologySources,
    spineScore,
  };
}
