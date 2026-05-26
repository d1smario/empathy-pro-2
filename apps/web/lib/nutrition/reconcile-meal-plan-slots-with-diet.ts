/**
 * Generativo meal plan: i target kcal/macro per slot devono seguire Profile → Diet (DB),
 * non un payload client obsoleto (memoria atleta / piano precedente a 4 pasti).
 */

import {
  buildDietMealSlotBudgets,
  type MacroSplitPct,
} from "@/lib/nutrition/diet-meal-slot-budgets";
import type { IntelligentMealPlanRequestSlot, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { mealTimesFromRoutineWeekPlanForDate, type FlatMealTimes } from "@/lib/nutrition/routine-week-plan-meal-times";
import { resolveNutritionDietDay } from "@/lib/nutrition/resolve-nutrition-diet-day";

function routineMealTimesFlat(routine: Record<string, unknown> | null | undefined): FlatMealTimes {
  const rc = routine && typeof routine === "object" && !Array.isArray(routine) ? routine : {};
  const mt =
    rc.meal_times && typeof rc.meal_times === "object" && !Array.isArray(rc.meal_times)
      ? (rc.meal_times as Record<string, unknown>)
      : {};
  return {
    breakfast: String(mt.breakfast ?? "07:30"),
    lunch: String(mt.lunch ?? "13:00"),
    dinner: String(mt.dinner ?? "20:00"),
    snack_am: String(mt.snack_am ?? "10:30"),
    snack_pm: String(mt.snack_pm ?? mt.snacks ?? "16:30"),
    snack_evening: String(mt.snack_evening ?? "22:30"),
  };
}

const DEFAULT_MACRO: MacroSplitPct = { carbs: 50, protein: 25, fat: 25 };

export type ReconcileMealPlanSlotsResult = {
  slots: IntelligentMealPlanRequestSlot[];
  mealCountMode: string;
  dietConfigured: boolean;
  /** True se il numero di slot è cambiato rispetto al client (es. 4 → 6). */
  rebuiltFromDiet: boolean;
};

export function reconcileMealPlanSlotsWithDiet(input: {
  planDate: string;
  nutritionConfig: unknown;
  routineConfig: unknown;
  dailyMealsKcalTotal: number;
  clientSlots: IntelligentMealPlanRequestSlot[];
  preferredMealCount?: number | null;
}): ReconcileMealPlanSlotsResult {
  const clientSlots = input.clientSlots ?? [];
  const dietDay = resolveNutritionDietDay(input.nutritionConfig, input.planDate, {
    preferredMealCount: input.preferredMealCount,
  });

  if (!dietDay.configured || !dietDay.caloricDistribution) {
    return {
      slots: clientSlots,
      mealCountMode: dietDay.mealCountMode || "4",
      dietConfigured: false,
      rebuiltFromDiet: false,
    };
  }

  const flatRoot = routineMealTimesFlat(
    input.routineConfig && typeof input.routineConfig === "object" && !Array.isArray(input.routineConfig)
      ? (input.routineConfig as Record<string, unknown>)
      : null,
  );
  const mealTimes = mealTimesFromRoutineWeekPlanForDate(
    input.routineConfig as Record<string, unknown> | null,
    input.planDate,
    flatRoot,
  );

  const macroSplit = dietDay.dailyMacros ?? DEFAULT_MACRO;
  const dailyKcal = Math.max(0, Math.round(input.dailyMealsKcalTotal));

  const budgets = buildDietMealSlotBudgets({
    mealCountMode: dietDay.mealCountMode,
    caloricDistribution: dietDay.caloricDistribution,
    dailyKcal,
    macroSplit,
    mealTimes,
  });

  const clientBySlot = new Map<MealSlotKey, IntelligentMealPlanRequestSlot>();
  for (const s of clientSlots) {
    if (s?.slot) clientBySlot.set(s.slot, s);
  }

  const rebuiltFromDiet =
    budgets.length !== clientSlots.length ||
    budgets.some((b) => !clientBySlot.has(b.key)) ||
    clientSlots.some((s) => !budgets.find((b) => b.key === s.slot));

  const slots: IntelligentMealPlanRequestSlot[] = budgets.map((b) => {
    const prev = clientBySlot.get(b.key);
    return {
      slot: b.key,
      labelIt: b.label,
      scheduledTimeLocal: b.time,
      targetKcal: b.kcal,
      targetCarbsG: b.carbs,
      targetProteinG: b.protein,
      targetFatG: b.fat,
      functionalTargets: prev?.functionalTargets ?? [],
      functionalFoodGroups: prev?.functionalFoodGroups ?? [],
      foodCandidates: prev?.foodCandidates ?? [],
    };
  });

  return {
    slots,
    mealCountMode: dietDay.mealCountMode,
    dietConfigured: true,
    rebuiltFromDiet,
  };
}
