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

function mealTimesFromRequest(
  request: IntelligentMealPlanRequest,
  fallback: FlatMealTimes & { snack_evening?: string },
): FlatMealTimes & { snack_evening?: string } {
  const out = { ...fallback };
  for (const s of request.slots) {
    const t = s.scheduledTimeLocal?.trim();
    if (!t) continue;
    const key = s.slot as keyof typeof out;
    if (key in out) out[key] = t;
  }
  if (request.racePreLunch?.lunchTimeLocal) {
    const slot = request.racePreLunch.mealSlot;
    if (slot in out) out[slot as keyof typeof out] = request.racePreLunch.lunchTimeLocal;
  }
  return out;
}

function resolveDietSlots(
  requirements: DailyNutritionRequirementsV2,
  request: IntelligentMealPlanRequest,
  dietDay: ResolvedNutritionDietDay | null | undefined,
  mealTimes: FlatMealTimes & { snack_evening?: string },
): MealPlanV2DietSlotBudget[] {
  let budgets: MealPlanV2DietSlotBudget[];

  if (dietDay?.configured && dietDay.caloricDistribution) {
    const macroSplit = dietDay.dailyMacros ?? DEFAULT_MACRO_SPLIT;
    budgets = buildDietMealSlotBudgets({
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
  } else {
    budgets = request.slots.map((s) => ({
      key: s.slot,
      label: s.labelIt,
      pct: 0,
      kcal: s.targetKcal,
      carbs: s.targetCarbsG,
      protein: s.targetProteinG,
      fat: s.targetFatG,
    }));
  }

  if (request.racePostRecovery && request.slots.length > 0) {
    const bySlot = new Map(request.slots.map((s) => [s.slot, s]));
    budgets = budgets.map((b) => {
      const r = bySlot.get(b.key as (typeof request.slots)[number]["slot"]);
      if (!r) return b;
      return {
        ...b,
        kcal: r.targetKcal,
        carbs: r.targetCarbsG,
        protein: r.targetProteinG,
        fat: r.targetFatG,
      };
    });
  }

  return budgets;
}

export async function buildMealPlanV2Production(
  input: BuildMealPlanV2ProductionInput,
  admin: SupabaseClient,
): Promise<MealPlanV2Production> {
  const { requirements } = buildNutritionDayModelV2({
    ...input,
    performanceIntegration: input.performanceIntegration,
  });

  const mealTimes = mealTimesFromRequest(input.request, input.mealTimes ?? DEFAULT_MEAL_TIMES);
  const dietMealSlotBudgets = resolveDietSlots(requirements, input.request, input.dietDay, mealTimes);
  const pools = await loadFdcPools(admin, requirements.dietProfileActive);
  const denyFragments = buildMealPlanFoodDenyFragments(input.request);

  const composedMealPlan = composeMealPlanV2(requirements, dietMealSlotBudgets, pools, {
    denyFragments,
    weeklyStapleCounts: input.request.weeklyStapleCounts,
    suppressedSlots: input.request.suppressedSlots,
    request: input.request,
  });

  const sessions = requirements.substrateFueling?.sessions ?? [];
  const fuelingProtocolMeta =
    sessions.length > 0 && requirements.substrateFueling
      ? bridgeSubstrateFuelingToProtocolMeta({
          substrateFueling: requirements.substrateFueling,
          durationMin: Math.round(sessions.reduce((m, s) => Math.max(m, s.durationH * 60), 0)),
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
