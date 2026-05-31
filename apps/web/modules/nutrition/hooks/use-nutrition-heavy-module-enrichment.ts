import { useEffect } from "react";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { NutritionMetabolicEfficiencyGenerativeViewModel } from "@/api/nutrition/contracts";
import { fetchNutritionModuleContext } from "@/modules/nutrition/services/nutrition-module-api";

type WindowRef = { from: string; to: string } | null;

/** Lazy fetch sezioni pesanti del modulo nutrition (`includeHeavy=1`) dopo first paint. */
export function useNutritionHeavyModuleEnrichment(input: {
  athleteId: string | null;
  loading: boolean;
  selectedPlanDate: string;
  nutritionModuleWindow: WindowRef;
  nutritionContextVersion: number;
  onResearchTraces: (rows: KnowledgeResearchTraceSummary[]) => void;
  onMetabolicModel: (model: NutritionMetabolicEfficiencyGenerativeViewModel | null) => void;
}) {
  useEffect(() => {
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
  ]);
}
