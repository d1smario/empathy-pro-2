import type {
  FunctionalFoodTargetViewModel,
  NutritionPathwayModulationViewModel,
  UsdaRichFoodItemViewModel,
} from "@/api/nutrition/contracts";
import { buildFunctionalFoodOptionGroupsForSlot } from "@/lib/nutrition/functional-food-option-groups";
import type { IntelligentMealPlanRequest, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_ORDER } from "@/lib/nutrition/intelligent-meal-plan-types";
import { filterIntelligentMealPlanRequestFoods } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { applyMealSlotRulesToIntelligentMealPlanRequest } from "@/lib/nutrition/meal-slot-food-rules";
import { buildPathwayTimingLinesForMealPlan } from "@/lib/nutrition/meal-plan-pathway-timing-lines";
import { shortFoodLabelFromUsda } from "@/lib/nutrition/usda-food-label";

export type PathwaySlotBundleInput = {
  pathwayTargets?: FunctionalFoodTargetViewModel[];
  foods?: UsdaRichFoodItemViewModel[];
};

const ORDER: MealSlotKey[] = [...MEAL_SLOT_ORDER];

export function buildIntelligentMealPlanRequest(input: {
  athleteId: string;
  planDate: string;
  profile: {
    diet_type: string | null;
    intolerances: string[] | null;
    allergies: string[] | null;
    food_exclusions: string[] | null;
    food_preferences: string[] | null;
    supplements: string[] | null;
    routine_config: Record<string, unknown> | null;
  } | null;
  mealRows: Array<{
    key: string;
    label: string;
    kcal: number;
    carbs: number;
    protein: number;
    fat: number;
    timeLocal: string;
  }>;
  mealPathwayBySlot: Partial<Record<string, PathwaySlotBundleInput>>;
  contextLines: string[];
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  trainingDayLines: string[];
  /** Leve integrazione operativa (solver × training), stesse della UI. */
  integrationLeverLines?: string[];
}): IntelligentMealPlanRequest {
  const { mealRows, mealPathwayBySlot } = input;
  const dailyMealsKcalTotal = Math.round(mealRows.reduce((s, r) => s + (Number.isFinite(r.kcal) ? r.kcal : 0), 0));
  const pathwayPathways = input.pathwayModulation?.pathways ?? [];
  const pathwayTimingLines = buildPathwayTimingLinesForMealPlan(input.pathwayModulation);
  const routineDigest = summarizeRoutine(input.profile?.routine_config);

  const slots = ORDER.map((slot) => {
    const row = mealRows.find((r) => r.key === slot);
    const bundle = mealPathwayBySlot[slot];
    const targets = bundle?.pathwayTargets ?? [];
    const foods = bundle?.foods ?? [];
    const candidates = new Set<string>();
    for (const t of targets) {
      for (const ex of t.curatedExamples ?? []) {
        candidates.add(ex.name);
      }
    }
    for (const f of foods.slice(0, 8)) {
      candidates.add(shortFoodLabelFromUsda(f.description, 48));
    }
    for (const t of targets) {
      for (const q of t.searchQueries ?? []) {
        if (q.trim()) candidates.add(q.trim());
      }
    }

    const functionalFoodGroups = buildFunctionalFoodOptionGroupsForSlot({
      pathwayTargets: targets,
      usdaFoods: foods,
      pathwaySupportPathways: pathwayPathways,
      minPerGroup: 3,
      maxPerGroup: 5,
    }).filter((g) => g.options.length > 0);

    return {
      slot,
      labelIt: row?.label ?? slot,
      scheduledTimeLocal: row?.timeLocal ?? "",
      targetKcal: Math.max(50, Math.round(row?.kcal ?? 400)),
      targetCarbsG: Math.max(0, Math.round(row?.carbs ?? 0)),
      targetProteinG: Math.max(0, Math.round(row?.protein ?? 0)),
      targetFatG: Math.max(0, Math.round(row?.fat ?? 0)),
      functionalTargets: targets.map((t: FunctionalFoodTargetViewModel) => ({
        nutrientId: t.nutrientId,
        displayNameIt: t.displayNameIt,
        pathwayLabel: t.pathwayLabel,
        rationaleShort: t.rationaleIt.length > 220 ? `${t.rationaleIt.slice(0, 217)}…` : t.rationaleIt,
      })),
      functionalFoodGroups,
      foodCandidates: Array.from(candidates).slice(0, 24),
    };
  });

  return applyMealSlotRulesToIntelligentMealPlanRequest(
    filterIntelligentMealPlanRequestFoods({
      athleteId: input.athleteId,
      planDate: input.planDate,
      mealPlanSolverMeta: {
        dailyMealsKcalTotal,
        integrationLeverLines: (input.integrationLeverLines ?? []).slice(0, 16),
      },
      dietType: input.profile?.diet_type ?? null,
      intolerances: input.profile?.intolerances ?? null,
      allergies: input.profile?.allergies ?? null,
      foodExclusions: input.profile?.food_exclusions ?? null,
      foodPreferences: input.profile?.food_preferences ?? null,
      supplements: input.profile?.supplements ?? null,
      aggregateInhibitors: input.pathwayModulation?.aggregateInhibitors ?? null,
      pathwayTimingLines,
      trainingDayLines: input.trainingDayLines.slice(0, 12),
      routineDigest,
      contextLines: input.contextLines.slice(0, 12),
      slots,
    }),
  );
}

function summarizeRoutine(routine: Record<string, unknown> | null | undefined): string | null {
  if (!routine || typeof routine !== "object") return null;
  const wake = typeof routine.wake_time === "string" ? routine.wake_time : null;
  const sleep = typeof routine.sleep_time === "string" ? routine.sleep_time : null;
  const trainPref = typeof routine.preferred_training_window === "string" ? routine.preferred_training_window : null;
  const bits = [wake && `sveglia ~${wake}`, sleep && `sonno ~${sleep}`, trainPref && `allenamento: ${trainPref}`].filter(
    Boolean,
  ) as string[];
  return bits.length ? bits.join(" · ") : null;
}
