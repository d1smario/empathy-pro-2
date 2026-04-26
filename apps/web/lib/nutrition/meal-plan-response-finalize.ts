import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanRequest,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { nutrientsForMealPlanItem, sumScaledNutrients, type ScaledMealItemNutrients } from "@/lib/nutrition/canonical-food-composition";
import { buildHydrationRoutineFromMealPlanRequest } from "@/lib/nutrition/meal-plan-hydration-routine";
import { buildMealPlanNutrientIntegrationHints } from "@/lib/nutrition/meal-plan-nutrient-integration-hints";
import { dedupeLunchDinnerMainProteins } from "@/lib/nutrition/meal-plan-protein-dedupe";

function enrichSlot(slot: IntelligentMealPlanSlotOut): IntelligentMealPlanSlotOut {
  const items = slot.items.map((it) => {
    const { compositionKey, compositionStatus, nutrients } = nutrientsForMealPlanItem(it);
    return { ...it, compositionKey, compositionStatus, nutrients };
  });
  return { ...slot, items };
}

/**
 * Aggiunge stime nutrizionali dettagliate (macro/micro/aminoacidi/frazioni lipidiche) e routine idratazione
 * coerente con gli orari inviati nel request.
 */
export function finalizeIntelligentMealPlanCore(
  core: IntelligentMealPlanAssembledCore,
  req: IntelligentMealPlanRequest,
): IntelligentMealPlanAssembledCore {
  const slotsDeduped = dedupeLunchDinnerMainProteins(core.slots);
  const slots = slotsDeduped.map(enrichSlot);
  const byReq = new Map(req.slots.map((s) => [s.slot, s]));

  const perSlot: Array<{
    slot: MealSlotKey;
    labelIt: string;
    scheduledTimeLocal: string;
    totals: ScaledMealItemNutrients;
  }> = slots.map((s) => {
    const meta = byReq.get(s.slot);
    const totals = sumScaledNutrients(s.items.map((i) => i.nutrients!));
    return {
      slot: s.slot,
      labelIt: meta?.labelIt ?? s.slot,
      scheduledTimeLocal: meta?.scheduledTimeLocal ?? "",
      totals,
    };
  });

  const dayTotals = sumScaledNutrients(perSlot.map((p) => p.totals));

  const integrationHints = buildMealPlanNutrientIntegrationHints(dayTotals);
  let dayInteractionSummary = core.dayInteractionSummary;
  if (integrationHints.length) {
    dayInteractionSummary = `${dayInteractionSummary} · ${integrationHints.join(" · ")}`.slice(0, 900);
  }

  return {
    ...core,
    slots,
    dayInteractionSummary,
    nutrientRollup: {
      disclaimerIt:
        "Composizione da cache USDA FDC quando disponibile; gli item non risolti non contribuiscono nutrienti inventati. Durante la migrazione restano stime canoniche solo per alimenti mappati.",
      dayTotals,
      perSlot,
    },
    hydrationRoutine: buildHydrationRoutineFromMealPlanRequest(req),
  };
}
