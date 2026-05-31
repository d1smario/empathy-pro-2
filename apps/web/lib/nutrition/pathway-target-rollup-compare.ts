import type { ScaledMealItemNutrients } from "@/lib/nutrition/canonical-food-composition";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";

export type PathwayTargetRollupLine = {
  nutrientId: NutrientTargetId;
  labelIt: string;
  dayValue: number;
  unit: string;
  /** Soglia educativa giornaliera (non RDA clinica). */
  floor: number;
  status: "met" | "low";
};

/** Soglie allineate a `buildMealPlanNutrientIntegrationHints` + target pathway tipici. */
const EDUCATIONAL_DAY_FLOORS: Partial<Record<NutrientTargetId, number>> = {
  folate_mcg: 300,
  vitC_mg: 70,
  vitB12_mcg: 2,
  fe_mg: 9,
  mg_mg: 280,
  zn_mg: 8,
  ca_mg: 700,
  vitD_mcg: 8,
  omega3G: 1.2,
  fiberG: 22,
  thiamineB1_mg: 1,
  riboflavinB2_mg: 1,
  niacinB3_mg: 12,
  vitB6_mg: 1,
  se_mcg: 45,
};

const UNITS: Partial<Record<NutrientTargetId, string>> = {
  folate_mcg: "mcg",
  vitC_mg: "mg",
  vitB12_mcg: "mcg",
  fe_mg: "mg",
  mg_mg: "mg",
  zn_mg: "mg",
  ca_mg: "mg",
  vitD_mcg: "mcg",
  omega3G: "g",
  fiberG: "g",
  thiamineB1_mg: "mg",
  riboflavinB2_mg: "mg",
  niacinB3_mg: "mg",
  vitB6_mg: "mg",
  se_mcg: "mcg",
  vitA_mcg_RAE: "mcg",
  vitE_mg: "mg",
  vitK_mcg: "mcg",
  p_mg: "mg",
  k_mg: "mg",
  na_mg: "mg",
};

function dayValueForNutrient(day: ScaledMealItemNutrients, id: NutrientTargetId): number {
  const v = day[id];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Confronto target pathway attivi vs rollup giornaliero del piano (post-USDA/canonical). */
export function buildPathwayTargetRollupComparison(
  targets: ReadonlyArray<{ nutrientId: NutrientTargetId; labelIt: string }>,
  dayTotals: ScaledMealItemNutrients,
): PathwayTargetRollupLine[] {
  const seen = new Set<NutrientTargetId>();
  const lines: PathwayTargetRollupLine[] = [];
  for (const t of targets) {
    if (seen.has(t.nutrientId)) continue;
    seen.add(t.nutrientId);
    const floor = EDUCATIONAL_DAY_FLOORS[t.nutrientId];
    if (floor == null) continue;
    const dayValue = dayValueForNutrient(dayTotals, t.nutrientId);
    const unit = UNITS[t.nutrientId] ?? "";
    lines.push({
      nutrientId: t.nutrientId,
      labelIt: t.labelIt,
      dayValue: Math.round(dayValue * 100) / 100,
      unit,
      floor,
      status: dayValue >= floor ? "met" : "low",
    });
  }
  return lines.slice(0, 12);
}
