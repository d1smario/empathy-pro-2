import type { DailyNutritionRequirementsV2 } from "@empathy/contracts";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
import {
  buildDailyNutritionRequirementsV2,
  type BuildDailyRequirementsInput,
} from "@/lib/nutrition/v2/daily-nutrition-requirements";
import { applyPerformanceIntegrationToSubstrateFueling } from "@/lib/nutrition/v2/apply-performance-integration-fueling";

export type BuildNutritionDayModelV2Input = BuildDailyRequirementsInput & {
  performanceIntegration?: NutritionPerformanceIntegrationDials | null;
};

export type NutritionDayModelV2 = {
  requirements: DailyNutritionRequirementsV2;
};

export function buildNutritionDayModelV2(input: BuildNutritionDayModelV2Input): NutritionDayModelV2 {
  const base = buildDailyNutritionRequirementsV2(input);
  if (!input.performanceIntegration || !base.substrateFueling) {
    return { requirements: base };
  }
  const adjusted = applyPerformanceIntegrationToSubstrateFueling(base, input.performanceIntegration);
  return { requirements: adjusted };
}
