/** Pathways, fueling, evidence-backed recommendations — engines + interpretation split. */
import type { Meal, NutritionConstraints, NutritionDailyEnergyModel, NutritionPlan } from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-nutrition" as const;
export const DOMAIN_TITLE = "Nutrition";
export const DOMAIN_SUMMARY =
  "Vincoli, piano pasti e modello energetico giornaliero — tipi canonici da @empathy/contracts (USDA / diario in pipeline V1).";

export type { Meal, NutritionConstraints, NutritionDailyEnergyModel, NutritionPlan };

/** Riga `nutrition_constraints`. */
export type NutritionConstraintsDbRow = {
  athlete_id: string;
  diet_type?: string | null;
  intolerances?: string[] | null;
  allergies?: string[] | null;
  excluded_foods?: string[] | null;
  excluded_supplements?: string[] | null;
  preferred_foods?: string[] | null;
  preferred_meal_count?: number | string | null;
  timing_constraints?: string[] | null;
  updated_at?: string | null;
};

export function nutritionConstraintsFromDbRow(row: NutritionConstraintsDbRow): NutritionConstraints {
  return {
    athleteId: row.athlete_id,
    dietType: row.diet_type ?? undefined,
    intolerances: row.intolerances ?? undefined,
    allergies: row.allergies ?? undefined,
    excludedFoods: row.excluded_foods ?? undefined,
    excludedSupplements: row.excluded_supplements ?? undefined,
    preferredFoods: row.preferred_foods ?? undefined,
    preferredMealCount:
      row.preferred_meal_count != null && row.preferred_meal_count !== ""
        ? Number(row.preferred_meal_count)
        : undefined,
    timingConstraints: row.timing_constraints ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

export type NutritionPlanDbRow = {
  id: string;
  athlete_id: string;
  from_date: string;
  to_date?: string | null;
  goal?: string | null;
  constraints_snapshot?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

function snapshotAsConstraints(raw: unknown): NutritionConstraints | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const aid = o.athleteId ?? o.athlete_id;
  if (typeof aid !== "string") return undefined;
  return {
    athleteId: aid,
    dietType: typeof o.dietType === "string" ? o.dietType : typeof o.diet_type === "string" ? o.diet_type : undefined,
  };
}

export function nutritionPlanFromDbRow(row: NutritionPlanDbRow): NutritionPlan {
  const fd = typeof row.from_date === "string" ? row.from_date : String(row.from_date);
  const td = row.to_date ? (typeof row.to_date === "string" ? row.to_date : String(row.to_date)) : undefined;
  return {
    id: row.id,
    athleteId: row.athlete_id,
    fromDate: fd.slice(0, 10) as NutritionPlan["fromDate"],
    toDate: td ? (td.slice(0, 10) as NutritionPlan["toDate"]) : undefined,
    meals: [],
    goal: row.goal ?? undefined,
    constraintsSnapshot: snapshotAsConstraints(row.constraints_snapshot),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

/** Una riga testuale per card UI. */
export function formatNutritionConstraintsLine(c: NutritionConstraints): string {
  const bits: string[] = [];
  if (c.dietType) bits.push(c.dietType);
  const nAll = c.allergies?.filter(Boolean).length ?? 0;
  const nInt = c.intolerances?.filter(Boolean).length ?? 0;
  if (nAll + nInt > 0) bits.push(`${nAll + nInt} restrizioni alimentari`);
  if (c.preferredMealCount != null) bits.push(`~${c.preferredMealCount} pasti/g`);
  return bits.join(" · ") || "Vincoli registrati (dettaglio in profilo).";
}

export function formatNutritionPlanLine(p: NutritionPlan): string {
  const range = p.toDate ? `${p.fromDate} → ${p.toDate}` : `da ${p.fromDate}`;
  return [range, p.goal].filter(Boolean).join(" · ") || range;
}

/** Stima kcal da macro se `kcal` non è valorizzato (4/4/9). */
export function estimateMealKcalFromMacros(meal: Meal): number | null {
  if (meal.kcal != null) return meal.kcal;
  const c = meal.carbsG ?? 0;
  const p = meal.proteinG ?? 0;
  const f = meal.fatG ?? 0;
  if (c === 0 && p === 0 && f === 0) return null;
  return 4 * c + 4 * p + 9 * f;
}
