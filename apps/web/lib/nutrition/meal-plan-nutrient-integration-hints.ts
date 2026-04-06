import type { ScaledMealItemNutrients } from "@/lib/nutrition/canonical-food-composition";

/**
 * Hint brevi su possibili lacune rispetto a soglie educative (non RDA clinico).
 * Da appendere al dayInteractionSummary post-rollup.
 */
export function buildMealPlanNutrientIntegrationHints(day: ScaledMealItemNutrients): string[] {
  const lines: string[] = [];
  if (day.fiberG < 22) {
    lines.push(
      "Fibre sotto target: più verdura/legumi/integrali; in alternativa integrazione fibre solo se concordata.",
    );
  }
  if (day.omega3G < 1.2) {
    lines.push("Omega-3 bassi: pesce azzurro o integrazione EPA/DHA se prescritta.");
  }
  if (day.vitD_mcg < 8) {
    lines.push("Vitamina D: sole sicuro, alimenti fortificati o integrazione solo su parere clinico.");
  }
  if (day.ca_mg < 700) {
    lines.push("Calcio sotto soglia: latticini/bevande fortificate o integrazione se concordata.");
  }
  if (day.fe_mg < 9 && day.proteinG < 90) {
    lines.push("Ferro: privilegia fonti eme e vitamina C a pasto; integrazione solo se indicata.");
  }
  return lines.slice(0, 5);
}
