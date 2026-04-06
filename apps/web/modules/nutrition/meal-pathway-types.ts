import type { FunctionalFoodTargetViewModel, UsdaRichFoodItemViewModel } from "@/api/nutrition/contracts";

export type MealPathwaySlotBundle = {
  loading: boolean;
  error: string | null;
  foods: UsdaRichFoodItemViewModel[];
  pathwayTargets: FunctionalFoodTargetViewModel[];
  usdaConfigured: boolean;
  lookupQueries: string[];
};
