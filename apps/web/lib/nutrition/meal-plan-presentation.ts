import type {
  FunctionalFoodTargetViewModel,
  NutritionPathwaySupportItem,
  UsdaRichFoodItemViewModel,
} from "@/api/nutrition/contracts";
import { buildFunctionalFoodOptionGroupsForSlot } from "@/lib/nutrition/functional-food-option-groups";
import { shortFoodLabelFromUsda } from "@/lib/nutrition/usda-food-label";

export { shortFoodLabelFromUsda };

export type MealPlanDishVm = {
  id: string;
  label: string;
  whyLine: string;
  sourceKind: "curated" | "fdc";
  fdcId?: number;
};

/**
 * Piano pasto funzionale: gruppi per funzione metabolica (3–5 opzioni), flatten per elenchi compatti.
 */
export function buildMealPlanDishesForSlot(input: {
  pathwayTargets: FunctionalFoodTargetViewModel[];
  usdaFoods: UsdaRichFoodItemViewModel[];
  maxItems?: number;
  pathwaySupportPathways?: NutritionPathwaySupportItem[] | null;
}): MealPlanDishVm[] {
  const max = Math.max(3, Math.min(20, input.maxItems ?? 12));
  const groups = buildFunctionalFoodOptionGroupsForSlot({
    pathwayTargets: input.pathwayTargets,
    usdaFoods: input.usdaFoods,
    pathwaySupportPathways: input.pathwaySupportPathways,
    minPerGroup: 1,
    maxPerGroup: 5,
  });
  const out: MealPlanDishVm[] = [];
  const seen = new Set<string>();

  for (const g of groups) {
    for (const o of g.options) {
      if (out.length >= max) return out;
      const key = `${o.source}:${(o.fdcId ?? o.label).toString().toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const tag = `Target: ${g.displayNameIt}`;
      out.push({
        id: `${g.nutrientId}-${key}`,
        label: o.label,
        whyLine: o.rationale.includes(g.displayNameIt) ? o.rationale : `${o.rationale} (${tag}).`,
        sourceKind: o.source === "curated" ? "curated" : "fdc",
        fdcId: o.fdcId ?? undefined,
      });
    }
  }

  return out;
}
