import type { FunctionalFoodTargetViewModel, FunctionalMealSelectorSlotViewModel, NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_KEYS } from "@/lib/nutrition/intelligent-meal-plan-types";
import { slotPriorityForFocus } from "@/lib/nutrition/functional-meal-selector";
import { slotPriorityForNutrientTarget } from "@/lib/nutrition/pathway-absorption-hints";

export type PathwayMealSlotKey = MealSlotKey;

const SLOTS: PathwayMealSlotKey[] = [...MEAL_SLOT_KEYS];

/**
 * Distribuisce i target funzionali (vie metaboliche → nutrienti FDC catalog) sui 5 pasti in modo deterministico.
 * Nessun elenco alimentare interno: la UI deve risolvere alimenti via `/api/nutrition/usda-by-nutrient?catalogId=`.
 */
export function assignPathwayTargetsToMealSlots(input: {
  targets: FunctionalFoodTargetViewModel[];
  planDate: string;
  athleteId: string;
  maxPerSlot?: number;
  /** Se presente, assegna target ai pasti in base al focus funzionale invece della rotazione hash. */
  selectorSlots?: FunctionalMealSelectorSlotViewModel[];
  /** Pathway modulation per PK v3 slot prefs per nutriente. */
  pathwayModulation?: NutritionPathwayModulationViewModel | null;
}): Record<PathwayMealSlotKey, FunctionalFoodTargetViewModel[]> {
  const maxPerSlot = Math.max(1, Math.min(5, Math.trunc(input.maxPerSlot ?? 3) || 3));
  const empty: Record<PathwayMealSlotKey, FunctionalFoodTargetViewModel[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack_am: [],
    snack_pm: [],
    snack_evening: [],
  };
  if (!input.targets.length) return empty;

  if (input.selectorSlots?.length) {
    const withUsdaFirst = [...input.targets].sort((a, b) => {
      const aw = a.usdaRichSearch ? 0 : 1;
      const bw = b.usdaRichSearch ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return a.nutrientId.localeCompare(b.nutrientId);
    });
    for (let i = 0; i < withUsdaFirst.length; i++) {
      const target = withUsdaFirst[i]!;
      const selectorSlot = input.selectorSlots[i % input.selectorSlots.length];
      const focusPriority = selectorSlot ? slotPriorityForFocus(selectorSlot.focus) : SLOTS;
      const priorities = slotPriorityForNutrientTarget(
        target.nutrientId,
        input.pathwayModulation,
        focusPriority,
      );
      for (const slot of priorities) {
        if (empty[slot].length < maxPerSlot) {
          empty[slot].push(target);
          break;
        }
      }
    }
    return empty;
  }

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
