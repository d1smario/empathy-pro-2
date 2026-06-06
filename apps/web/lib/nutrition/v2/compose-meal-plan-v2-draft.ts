import type {
  DailyNutritionRequirementsV2,
  MealPlanV2ComposedItem,
  MealPlanV2ComposedSlot,
  MealPlanV2DietSlotBudget,
  MealPlanV2FoodPoolPreview,
} from "@empathy/contracts";

type PoolCandidate = MealPlanV2FoodPoolPreview["candidates"][number];

/** Fallback solo se Profile Diet non configurato per il giorno. */
const SLOT_KCAL_SHARE: Record<string, number> = {
  breakfast: 0.22,
  breakfast_pro: 0.1,
  lunch: 0.28,
  lunch_pro: 0.22,
  lunch_veg: 0.08,
  snack: 0.1,
  dinner: 0.25,
  dinner_pro: 0.2,
};

const DIET_SLOT_TO_POOL: Record<string, string> = {
  breakfast: "breakfast",
  snack_am: "snack",
  lunch: "lunch",
  snack_pm: "snack",
  dinner: "dinner",
  snack_evening: "snack",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function macrosFromGrams(c: PoolCandidate, grams: number): Omit<MealPlanV2ComposedItem, "fdcId" | "description" | "grams"> {
  const f = grams / 100;
  return {
    kcal: round1(c.kcalPer100g * f),
    choG: round1(c.carbsPer100g * f),
    proG: round1(c.proteinPer100g * f),
    fatG: round1((c.kcalPer100g - c.carbsPer100g * 4 - c.proteinPer100g * 4) / 9 * f) || 0,
  };
}

function pickCandidate(candidates: PoolCandidate[], slot: string): PoolCandidate | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates];
  if (slot.includes("pro")) {
    sorted.sort((a, b) => b.proteinPer100g - a.proteinPer100g || b.kcalPer100g - a.kcalPer100g);
  } else if (slot.includes("veg")) {
    sorted.sort((a, b) => a.kcalPer100g - b.kcalPer100g || b.carbsPer100g - a.carbsPer100g);
  } else if (slot === "snack") {
    sorted.sort((a, b) => a.kcalPer100g - b.kcalPer100g);
  } else {
    sorted.sort((a, b) => b.carbsPer100g - a.carbsPer100g || b.kcalPer100g - a.kcalPer100g);
  }
  return sorted[0] ?? null;
}

/**
 * @deprecated Usa `compose-meal-plan-v2.ts` (multi-item produzione).
 * Composer draft V2: 1 alimento per branch, grammi da target kcal slot.
 */
function poolForDietSlot(
  dietSlot: MealPlanV2DietSlotBudget,
  pools: MealPlanV2FoodPoolPreview[],
): MealPlanV2FoodPoolPreview | undefined {
  const key = DIET_SLOT_TO_POOL[dietSlot.key] ?? dietSlot.key;
  return pools.find((p) => p.slot === key);
}

export function composeMealPlanV2Draft(
  requirements: DailyNutritionRequirementsV2,
  pools: MealPlanV2FoodPoolPreview[],
  dietSlots?: MealPlanV2DietSlotBudget[],
): MealPlanV2ComposedSlot[] {
  const mealsKcal = Math.max(1200, requirements.energy.mealsKcal || requirements.energy.dailyKcal * 0.85);
  const out: MealPlanV2ComposedSlot[] = [];

  if (dietSlots?.length) {
    for (const slot of dietSlots) {
      const pool = poolForDietSlot(slot, pools);
      const targetKcal = slot.kcal;
      const pick = pool ? pickCandidate(pool.candidates, pool.slot) : null;
      if (!pick || pick.kcalPer100g <= 0) {
        out.push({
          slot: slot.key,
          labelIt: slot.label,
          targetKcal,
          items: [],
          totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
        });
        continue;
      }
      const grams = Math.max(30, Math.min(450, Math.round((targetKcal / pick.kcalPer100g) * 100)));
      const macros = macrosFromGrams(pick, grams);
      const item: MealPlanV2ComposedItem = { fdcId: pick.fdcId, description: pick.description, grams, ...macros };
      out.push({
        slot: slot.key,
        labelIt: slot.label,
        targetKcal,
        items: [item],
        totals: { kcal: item.kcal, choG: item.choG, proG: item.proG, fatG: item.fatG },
      });
    }
    return out;
  }

  for (const pool of pools) {
    const share = SLOT_KCAL_SHARE[pool.slot] ?? 0.1;
    const targetKcal = Math.round(mealsKcal * share);
    const pick = pickCandidate(pool.candidates, pool.slot);
    if (!pick || pick.kcalPer100g <= 0) {
      out.push({
        slot: pool.slot,
        labelIt: pool.labelIt,
        targetKcal,
        items: [],
        totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 },
      });
      continue;
    }

    const grams = Math.max(30, Math.min(450, Math.round((targetKcal / pick.kcalPer100g) * 100)));
    const macros = macrosFromGrams(pick, grams);
    const item: MealPlanV2ComposedItem = {
      fdcId: pick.fdcId,
      description: pick.description,
      grams,
      ...macros,
    };
    out.push({
      slot: pool.slot,
      labelIt: pool.labelIt,
      targetKcal,
      items: [item],
      totals: {
        kcal: item.kcal,
        choG: item.choG,
        proG: item.proG,
        fatG: item.fatG,
      },
    });
  }

  return out;
}
