import { inferCanonicalFoodKeyPreferName } from "@/lib/nutrition/canonical-food-composition";
import {
  ROTATION_MAX_WEEK_USES,
  ROTATION_TARGET_WEEK_USES,
} from "@/lib/nutrition/meal-composition-rules";
import type { MediterraneanComposedMeal, MediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";

export function weekCountFor(stapleKey: string, week?: Record<string, number>): number {
  return week?.[stapleKey] ?? 0;
}

export function isCanonicalKeyUsedToday(ctx: MediterraneanDayContext, canonicalKey: string): boolean {
  return ctx.dayUsedCanonicalKeys?.has(canonicalKey) ?? false;
}

export function canUseCanonicalKeyWeek(
  ctx: MediterraneanDayContext,
  canonicalKey: string,
  options?: { allowExceptionCap?: boolean },
): boolean {
  const count = weekCountFor(canonicalKey, ctx.weekStapleCounts);
  if (count >= ROTATION_TARGET_WEEK_USES) {
    if (options?.allowExceptionCap && count < ROTATION_MAX_WEEK_USES) return true;
    return false;
  }
  return true;
}

export function canUseCanonicalKey(
  ctx: MediterraneanDayContext,
  canonicalKey: string,
  options?: { allowWeekException?: boolean },
): boolean {
  if (!canonicalKey) return false;
  if (isCanonicalKeyUsedToday(ctx, canonicalKey)) return false;
  return canUseCanonicalKeyWeek(ctx, canonicalKey, { allowExceptionCap: options?.allowWeekException });
}

export function registerMealCanonicalKeys(ctx: MediterraneanDayContext, meal: MediterraneanComposedMeal): void {
  if (!ctx.dayUsedCanonicalKeys) ctx.dayUsedCanonicalKeys = new Set();
  for (const it of meal.items) {
    const key = inferCanonicalFoodKeyPreferName(it.name, it.portionHint);
    if (key) ctx.dayUsedCanonicalKeys.add(key);
  }
}
