import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanRequest,
  IntelligentMealPlanResponseBody,
  IntelligentMealPlanSolverBasis,
} from "@/lib/nutrition/intelligent-meal-plan-types";

function profileConstraintLines(req: IntelligentMealPlanRequest): string[] {
  const lines: string[] = [];
  if (req.dietType?.trim()) lines.push(`Dieta dichiarata: ${req.dietType.trim()}`);
  if (req.allergies?.length) lines.push(`Allergie: ${req.allergies.join(", ")}`);
  if (req.intolerances?.length) lines.push(`Intolleranze: ${req.intolerances.join(", ")}`);
  if (req.foodExclusions?.length) lines.push(`Esclusioni alimentari: ${req.foodExclusions.join(", ")}`);
  if (req.foodPreferences?.length) lines.push(`Preferenze: ${req.foodPreferences.join(", ")}`);
  if (req.supplements?.length) lines.push(`Integratori (nota): ${req.supplements.join(", ")}`);
  return lines;
}

/** Eco strutturata del solver pasti × training + profilo — stessi input del request. */
export function buildSolverBasisFromRequest(req: IntelligentMealPlanRequest): IntelligentMealPlanSolverBasis {
  return {
    source: "nutrition_meal_plan_solver",
    planDate: req.planDate,
    dailyMealsKcalTotal: req.mealPlanSolverMeta.dailyMealsKcalTotal,
    dietType: req.dietType,
    profileConstraintLines: profileConstraintLines(req),
    trainingDayLines: [...req.trainingDayLines],
    routineDigest: req.routineDigest,
    integrationLeverLines: [...req.mealPlanSolverMeta.integrationLeverLines],
    pathwayTimingLines: [...req.pathwayTimingLines],
    aggregateInhibitors: req.aggregateInhibitors ? [...req.aggregateInhibitors] : null,
    slots: req.slots.map((s) => ({
      slot: s.slot,
      labelIt: s.labelIt,
      scheduledTimeLocal: s.scheduledTimeLocal,
      targetKcal: s.targetKcal,
      targetCarbsG: s.targetCarbsG,
      targetProteinG: s.targetProteinG,
      targetFatG: s.targetFatG,
    })),
  };
}

export function attachSolverBasisToAssembled(
  core: IntelligentMealPlanAssembledCore,
  req: IntelligentMealPlanRequest,
): IntelligentMealPlanResponseBody {
  return {
    ...core,
    solverBasis: buildSolverBasisFromRequest(req),
  };
}
