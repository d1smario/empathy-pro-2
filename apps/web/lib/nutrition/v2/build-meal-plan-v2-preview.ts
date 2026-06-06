import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntelligentMealPlanV2Preview, MealPlanV2DietSlotBudget, MealPlanV2FoodPoolPreview } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildDietMealSlotBudgets, type MacroSplitPct } from "@/lib/nutrition/diet-meal-slot-budgets";
import type { ResolvedNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";
import type { FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";
import {
  buildDailyNutritionRequirementsV2,
  type BuildDailyRequirementsInput,
} from "@/lib/nutrition/v2/daily-nutrition-requirements";
import { composeMealPlanV2, type FdcPoolMap } from "@/lib/nutrition/v2/compose-meal-plan-v2";
import { FDC_BRANCH_POOL_SPECS } from "@/lib/nutrition/v2/fdc-pool-specs";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { buildNutritionDayModelV2 } from "@/lib/nutrition/v2/nutrition-day-model-v2";
import { queryFdcBranchPool, type FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import type { FdcFoodBrowseFilter } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import { CLASSIFIER_VERSION, filterSummaryIt } from "@/lib/nutrition/v2/fdc-food-taxonomy";

const DEFAULT_MEAL_TIMES: FlatMealTimes & { snack_evening?: string } = {
  breakfast: "07:30",
  snack_am: "10:30",
  lunch: "13:00",
  snack_pm: "17:00",
  dinner: "20:30",
  snack_evening: "22:00",
};

const DEFAULT_MACRO_SPLIT: MacroSplitPct = { carbs: 50, protein: 25, fat: 25 };

async function loadFoodPools(
  dietProfile: ReturnType<typeof buildDailyNutritionRequirementsV2>["dietProfileActive"],
  browse: (filter: FdcFoodBrowseFilter) => Promise<FdcFoodBrowseHit[]>,
): Promise<MealPlanV2FoodPoolPreview[]> {
  const excludeAmino = dietProfile === "low_histamine" ? (["histamine_rich"] as const) : undefined;
  const foodPoolsBySlot: MealPlanV2FoodPoolPreview[] = [];

  for (const spec of FDC_BRANCH_POOL_SPECS) {
    const filter = {
      ...spec.filter,
      dietProfile,
      excludeAminoProfile: excludeAmino ? [...excludeAmino] : undefined,
    };
    const candidates = await browse(filter);
    foodPoolsBySlot.push({
      slot: spec.poolKey,
      labelIt: spec.labelIt,
      filterSummary: filterSummaryIt(filter),
      candidates: candidates.map((c) => ({
        fdcId: c.fdcId,
        description: c.description,
        kcalPer100g: c.kcalPer100g,
        proteinPer100g: c.proteinPer100g,
        carbsPer100g: c.carbsPer100g,
        tags: {
          mealCourse: c.tags.mealCourse,
          foodFamily: c.tags.foodFamily,
          macroDominant: c.tags.macroDominant,
          slotFit: c.tags.slotFit,
          dietProfile: c.tags.dietProfile,
          aminoProfile: c.tags.aminoProfile,
          nutrientDensity: c.tags.nutrientDensity,
          classifierVersion: c.tags.classifierVersion,
        },
      })),
    });
  }

  return foodPoolsBySlot;
}

export type BuildMealPlanV2PreviewInput = BuildDailyRequirementsInput & {
  dietDay?: ResolvedNutritionDietDay | null;
  mealTimes?: FlatMealTimes & { snack_evening?: string };
};

function resolveDietMealSlotBudgets(
  requirements: ReturnType<typeof buildDailyNutritionRequirementsV2>,
  request: BuildMealPlanV2PreviewInput["request"],
  dietDay: ResolvedNutritionDietDay | null | undefined,
  mealTimes: FlatMealTimes & { snack_evening?: string },
): MealPlanV2DietSlotBudget[] {
  if (!dietDay?.configured || !dietDay.caloricDistribution) {
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
  const macroSplit = dietDay.dailyMacros ?? DEFAULT_MACRO_SPLIT;
  const budgets = buildDietMealSlotBudgets({
    mealCountMode: dietDay.mealCountMode,
    caloricDistribution: dietDay.caloricDistribution,
    dailyKcal: requirements.energy.mealsKcal,
    macroSplit,
    mealTimes,
  });
  return budgets.map((b) => ({
    key: b.key,
    label: b.label,
    pct: b.pct,
    kcal: b.kcal,
    carbs: b.carbs,
    protein: b.protein,
    fat: b.fat,
  }));
}

export async function buildMealPlanV2Preview(
  input: BuildMealPlanV2PreviewInput,
  admin?: SupabaseClient,
): Promise<IntelligentMealPlanV2Preview> {
  const { requirements } = buildNutritionDayModelV2(input);
  const dietMealSlotBudgets = resolveDietMealSlotBudgets(
    requirements,
    input.request,
    input.dietDay,
    input.mealTimes ?? DEFAULT_MEAL_TIMES,
  );
  const browse =
    admin != null
      ? (filter: FdcFoodBrowseFilter) => queryFdcBranchPool(admin, filter)
      : async (filter: FdcFoodBrowseFilter) => {
          const { browseFdcFoodPool } = await import("@/lib/nutrition/v2/usda-food-index");
          return browseFdcFoodPool(filter);
        };
  const foodPoolsBySlot = await loadFoodPools(requirements.dietProfileActive, browse);
  const poolMap: FdcPoolMap = new Map(
    foodPoolsBySlot.map((p) => [
      p.slot,
      p.candidates.map((c) => ({
        fdcId: c.fdcId,
        description: c.description,
        kcalPer100g: c.kcalPer100g,
        proteinPer100g: c.proteinPer100g,
        carbsPer100g: c.carbsPer100g,
        fatPer100g: 0,
        tags: {
          mealCourse: c.tags.mealCourse ?? [],
          foodFamily: c.tags.foodFamily ?? [],
          macroDominant: c.tags.macroDominant ?? [],
          slotFit: c.tags.slotFit ?? [],
          dietProfile: c.tags.dietProfile ?? [],
          dietExclude: [],
          mealRole: [],
          aminoProfile: c.tags.aminoProfile ?? [],
          nutrientDensity: c.tags.nutrientDensity ?? [],
          classifierVersion: c.tags.classifierVersion ?? CLASSIFIER_VERSION,
        },
        tagSource: "db" as const,
      })),
    ]),
  );
  const composedMealPlan = composeMealPlanV2(requirements, dietMealSlotBudgets, poolMap, {
    denyFragments: buildMealPlanFoodDenyFragments(input.request),
    weeklyStapleCounts: input.request.weeklyStapleCounts,
    suppressedSlots: input.request.suppressedSlots,
  });

  return {
    layer: "nutrition_meal_plan_v2_preview",
    requirements,
    taxonomyVersion: CLASSIFIER_VERSION,
    dietMealSlotBudgets,
    foodPoolsBySlot,
    composedMealPlan,
    disclaimer:
      "Anteprima Nutrition V2: fueling intra da CHO substrati; pasti multi-item da pool USDA; % slot da Profile Diet.",
  };
}

export function isMealPlanV2Enabled(): boolean {
  const v = (process.env.MEAL_PLAN_V2 ?? process.env.NEXT_PUBLIC_MEAL_PLAN_V2 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
