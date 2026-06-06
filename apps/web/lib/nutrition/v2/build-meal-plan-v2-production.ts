import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
} from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildDietMealSlotBudgets, type MacroSplitPct } from "@/lib/nutrition/diet-meal-slot-budgets";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
import type { ResolvedNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";
import type { FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";
import { buildNutritionDayModelV2 } from "@/lib/nutrition/v2/nutrition-day-model-v2";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { FDC_BRANCH_POOL_SPECS } from "@/lib/nutrition/v2/fdc-pool-specs";
import { queryFdcBranchPool } from "@/lib/nutrition/v2/fdc-branch-query";
import type { FdcFoodBrowseFilter } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import { CLASSIFIER_VERSION } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import type { BuildDailyRequirementsInput } from "@/lib/nutrition/v2/daily-nutrition-requirements";
import { bridgeSubstrateFuelingToProtocolMeta } from "@/lib/nutrition/v2/bridge-substrate-fueling-to-protocol";

const DEFAULT_MEAL_TIMES: FlatMealTimes & { snack_evening?: string } = {
  breakfast: "07:30",
  snack_am: "10:30",
  lunch: "13:00",
  snack_pm: "17:00",
  dinner: "20:30",
  snack_evening: "22:00",
};

const DEFAULT_MACRO_SPLIT: MacroSplitPct = { carbs: 50, protein: 25, fat: 25 };

export type MealPlanV2Production = {
  engine: "nutrition_v2";
  algorithmVersion: "nutrition_meal_plan_v2_production";
  taxonomyVersion: string;
  requirements: DailyNutritionRequirementsV2;
  dietMealSlotBudgets: MealPlanV2DietSlotBudget[];
  composedMealPlan: MealPlanV2ComposedSlot[];
  fuelingProtocolMeta?: ReturnType<typeof bridgeSubstrateFuelingToProtocolMeta>;
};

export type BuildMealPlanV2ProductionInput = BuildDailyRequirementsInput & {
  request: IntelligentMealPlanRequest;
  dietDay?: ResolvedNutritionDietDay | null;
  mealTimes?: FlatMealTimes & { snack_evening?: string };
  performanceIntegration?: NutritionPerformanceIntegrationDials | null;
  preferredFuelingBrands?: string[];
};

async function loadFdcPools(
  admin: SupabaseClient,
  dietProfile: DailyNutritionRequirementsV2["dietProfileActive"],
): Promise<FdcPoolMap> {
  const excludeAmino = dietProfile === "low_histamine" ? (["histamine_rich"] as const) : undefined;
  const map: FdcPoolMap = new Map();

  for (const spec of FDC_BRANCH_POOL_SPECS) {
    const filter: FdcFoodBrowseFilter = {
      ...spec.filter,
      dietProfile,
      excludeAminoProfile: excludeAmino ? [...excludeAmino] : undefined,
    };
    const hits = await queryFdcBranchPool(admin, filter);
    map.set(spec.poolKey, hits);
  }
  return map;
}

function resolveDietSlots(
  requirements: DailyNutritionRequirementsV2,
  request: IntelligentMealPlanRequest,
  dietDay: ResolvedNutritionDietDay | null | undefined,
  mealTimes: FlatMealTimes & { snack_evening?: string },
): MealPlanV2DietSlotBudget[] {
  if (dietDay?.configured && dietDay.caloricDistribution) {
    const macroSplit = dietDay.dailyMacros ?? DEFAULT_MACRO_SPLIT;
    return buildDietMealSlotBudgets({
      mealCountMode: dietDay.mealCountMode,
      caloricDistribution: dietDay.caloricDistribution,
      dailyKcal: requirements.energy.mealsKcal,
      macroSplit,
      mealTimes,
    }).map((b) => ({
      key: b.key,
      label: b.label,
      pct: b.pct,
      kcal: b.kcal,
      carbs: b.carbs,
      protein: b.protein,
      fat: b.fat,
    }));
  }
  return request.slots.map((s) => ({
    key: s.slot,
    label: s.labelIt,
    pct: 0,
    kcal: s.targetKcal,
    carbs: s.targetCarbsG,
    protein: s.targetProteinG,
    fat: s.targetFatG,
  }));
}

export async function buildMealPlanV2Production(
  input: BuildMealPlanV2ProductionInput,
  admin: SupabaseClient,
): Promise<MealPlanV2Production> {
  const { requirements } = buildNutritionDayModelV2({
    ...input,
    performanceIntegration: input.performanceIntegration,
  });

  const mealTimes = input.mealTimes ?? DEFAULT_MEAL_TIMES;
  const dietMealSlotBudgets = resolveDietSlots(requirements, input.request, input.dietDay, mealTimes);
  const pools = await loadFdcPools(admin, requirements.dietProfileActive);
  const denyFragments = buildMealPlanFoodDenyFragments(input.request);

  const composedMealPlan = composeMealPlanV2(requirements, dietMealSlotBudgets, pools, {
    denyFragments,
    weeklyStapleCounts: input.request.weeklyStapleCounts,
    suppressedSlots: input.request.suppressedSlots,
  });

  const session = requirements.substrateFueling?.sessions[0];
  const fuelingProtocolMeta =
    session && requirements.substrateFueling
      ? bridgeSubstrateFuelingToProtocolMeta({
          substrateFueling: requirements.substrateFueling,
          durationMin: Math.round(session.durationH * 60),
          preferredBrands: input.preferredFuelingBrands ?? [],
        })
      : undefined;

  return {
    engine: "nutrition_v2",
    algorithmVersion: "nutrition_meal_plan_v2_production",
    taxonomyVersion: CLASSIFIER_VERSION,
    requirements,
    dietMealSlotBudgets,
    composedMealPlan,
    fuelingProtocolMeta,
  };
}
