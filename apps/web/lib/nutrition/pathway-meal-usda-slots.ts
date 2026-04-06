import type { FunctionalFoodTargetViewModel } from "@/api/nutrition/contracts";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_ORDER } from "@/lib/nutrition/intelligent-meal-plan-types";

export type PathwayMealSlotKey = MealSlotKey;

const SLOTS: PathwayMealSlotKey[] = [...MEAL_SLOT_ORDER];

/**
 * Distribuisce i target funzionali (vie metaboliche → nutrienti FDC catalog) sui 5 pasti in modo deterministico.
 * Nessun elenco alimentare interno: la UI deve risolvere alimenti via `/api/nutrition/usda-by-nutrient?catalogId=`.
 */
export function assignPathwayTargetsToMealSlots(input: {
  targets: FunctionalFoodTargetViewModel[];
  planDate: string;
  athleteId: string;
  maxPerSlot?: number;
}): Record<PathwayMealSlotKey, FunctionalFoodTargetViewModel[]> {
  const maxPerSlot = Math.max(1, Math.min(5, Math.trunc(input.maxPerSlot ?? 3) || 3));
  const empty: Record<PathwayMealSlotKey, FunctionalFoodTargetViewModel[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack_am: [],
    snack_pm: [],
  };
  if (!input.targets.length) return empty;

  let h = 0;
  for (const c of `${input.planDate}:${input.athleteId}`) {
    h = (h * 31 + c.charCodeAt(0)) % 1009;
  }

  const withUsdaFirst = [...input.targets].sort((a, b) => {
    const aw = a.usdaRichSearch ? 0 : 1;
    const bw = b.usdaRichSearch ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return a.nutrientId.localeCompare(b.nutrientId);
  });

  const rotated = [...withUsdaFirst.slice(h % withUsdaFirst.length), ...withUsdaFirst.slice(0, h % withUsdaFirst.length)];

  rotated.forEach((t, i) => {
    const slot = SLOTS[i % SLOTS.length];
    if (empty[slot].length < maxPerSlot) empty[slot].push(t);
  });

  return empty;
}

export function catalogIdsForSlot(targets: FunctionalFoodTargetViewModel[]): string[] {
  return Array.from(
    new Set(
      targets.filter((t) => t.usdaRichSearch).map((t) => t.nutrientId),
    ),
  ).slice(0, 3);
}

export function collectSearchQueriesForSlot(targets: FunctionalFoodTargetViewModel[], limit = 8): string[] {
  const out: string[] = [];
  for (const t of targets) {
    for (const q of t.searchQueries ?? []) {
      const s = String(q).trim();
      if (s && !out.includes(s)) out.push(s);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
