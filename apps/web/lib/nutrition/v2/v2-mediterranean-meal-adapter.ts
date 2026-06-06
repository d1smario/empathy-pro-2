import type { MealPlanV2ComposedItem } from "@empathy/contracts";
import { inferCanonicalFoodKeyPreferName } from "@/lib/nutrition/canonical-food-composition";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import type { MediterraneanComposedMeal } from "@/lib/nutrition/mediterranean-meal-composer";
import { labelItForStaple, servingBasisForCanonical } from "@/lib/nutrition/v2/fdc-staple-registry";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Adapter V1 MediterraneanComposedMeal → V2 composed items (gara, pathway adds). */
export function mediterraneanMealToV2Items(meal: MediterraneanComposedMeal): MealPlanV2ComposedItem[] {
  return meal.items.map((it) => {
    const canonicalKey = inferCanonicalFoodKeyPreferName(it.name, it.portionHint);
    const fdcId = fdcIdForCanonicalKey(canonicalKey) ?? 0;
    const servingBasis = servingBasisForCanonical(canonicalKey);
    const kcal = Math.max(1, Math.round(it.approxKcal));
    const role = it.macroRole ?? "mixed";
    const split =
      role === "cho_heavy"
        ? { c: 0.72, p: 0.14, f: 0.14 }
        : role === "protein"
          ? { c: 0.25, p: 0.45, f: 0.3 }
          : role === "fat"
            ? { c: 0.18, p: 0.18, f: 0.64 }
            : role === "veg"
              ? { c: 0.45, p: 0.2, f: 0.35 }
              : { c: 0.5, p: 0.2, f: 0.3 };
    return {
      fdcId,
      description: it.name,
      grams: 0,
      kcal,
      choG: round1((kcal * split.c) / 4),
      proG: round1((kcal * split.p) / 4),
      fatG: round1((kcal * split.f) / 9),
      canonicalKey,
      servingBasis,
    };
  });
}

export function v2ComposedSlotToMediterraneanMeal(items: MealPlanV2ComposedItem[]): MediterraneanComposedMeal {
  const out = items.map((it) => ({
    name: it.description,
    portionHint: `${Math.round(it.grams)} g ${it.description}`,
    functionalBridge: "Composizione V2 staple",
    approxKcal: Math.round(it.kcal),
    macroRole:
      it.choG * 4 >= it.proG * 4 && it.choG * 4 >= it.fatG * 9
        ? ("cho_heavy" as const)
        : it.proG * 4 >= it.fatG * 9
          ? ("protein" as const)
          : it.fatG * 9 > it.choG * 4
            ? ("fat" as const)
            : ("mixed" as const),
  }));
  const totalApproxKcal = out.reduce((s, i) => s + i.approxKcal, 0);
  return {
    items: out,
    lines: out.map((i) => i.portionHint),
    totalApproxKcal,
  };
}
