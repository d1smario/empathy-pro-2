import { useEffect } from "react";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type {
  CrossDomainInterpretationRoadmap,
  NutritionMetabolicEfficiencyGenerativeViewModel,
  NutrientInterrogationViewModel,
} from "@/api/nutrition/contracts";
import type { EmpathyApplicationPlaybook } from "@empathy/contracts";
import { fetchNutritionModuleContext } from "@/modules/nutrition/services/nutrition-module-api";

type WindowRef = { from: string; to: string } | null;

/** Lazy fetch sezioni pesanti del modulo nutrition (`includeHeavy=1`) dopo first paint. */
export function useNutritionHeavyModuleEnrichment(input: {
  athleteId: string | null;
  loading: boolean;
  selectedPlanDate: string;
  nutritionModuleWindow: WindowRef;
  nutritionContextVersion: number;
  enabled?: boolean;
  onResearchTraces: (rows: KnowledgeResearchTraceSummary[]) => void;
  onMetabolicModel: (model: NutritionMetabolicEfficiencyGenerativeViewModel | null) => void;
  onCrossDomainRoadmap?: (roadmap: CrossDomainInterpretationRoadmap | null) => void;
  onNutrientInterrogation?: (vm: NutrientInterrogationViewModel | null) => void;
  onApplicationPlaybook?: (playbook: EmpathyApplicationPlaybook | null) => void;
  onPathwayRefresh?: (payload: {
    pathwayModulation: Awaited<ReturnType<typeof fetchNutritionModuleContext>>["pathwayModulation"];
    functionalMealSelector: Awaited<ReturnType<typeof fetchNutritionModuleContext>>["functionalMealSelector"];
    functionalFoodRecommendations: Awaited<ReturnType<typeof fetchNutritionModuleContext>>["functionalFoodRecommendations"];
  }) => void;
}) {
  useEffect(() => {
    if (input.enabled === false) return;
    if (!input.athleteId || input.loading) return;
    const w = input.nutritionModuleWindow;
    if (!w) return;
    let cancelled = false;
    void (async () => {
      try {
        const snap = await fetchNutritionModuleContext({
          athleteId: input.athleteId!,
          from: w.from,
          to: w.to,
          pathwayDate: input.selectedPlanDate,
          includeHeavy: true,
        });
        if (cancelled || snap.error) return;
        input.onResearchTraces(snap.researchTraceSummaries ?? []);
        input.onMetabolicModel(snap.metabolicEfficiencyGenerativeModel ?? null);
        input.onCrossDomainRoadmap?.(snap.crossDomainInterpretationRoadmap ?? null);
        input.onNutrientInterrogation?.(snap.nutrientInterrogation ?? null);
        input.onApplicationPlaybook?.(snap.applicationPlaybook ?? null);
        input.onPathwayRefresh?.({
          pathwayModulation: snap.pathwayModulation ?? null,
          functionalMealSelector: snap.functionalMealSelector ?? null,
          functionalFoodRecommendations: snap.functionalFoodRecommendations ?? null,
        });
      } catch {
        /* fail-soft */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    input.athleteId,
    input.loading,
    input.selectedPlanDate,
    input.nutritionModuleWindow,
    input.nutritionContextVersion,
    input.onResearchTraces,
    input.onMetabolicModel,
    input.onCrossDomainRoadmap,
    input.onNutrientInterrogation,
    input.onApplicationPlaybook,
    input.onPathwayRefresh,
  ]);
}
