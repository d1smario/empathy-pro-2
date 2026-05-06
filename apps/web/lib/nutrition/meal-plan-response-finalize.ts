import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanRequest,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  inferCanonicalFoodKey,
  sumScaledNutrients,
  type ScaledMealItemNutrients,
} from "@/lib/nutrition/canonical-food-composition";
import {
  buildFdcCanonicalSnapshot,
  nutrientsForMealPlanItemFromCache,
  type FdcCanonicalSnapshot,
} from "@/lib/nutrition/fdc-to-canonical-scaler";
import { buildHydrationRoutineFromMealPlanRequest } from "@/lib/nutrition/meal-plan-hydration-routine";
import { buildMealPlanNutrientIntegrationHints } from "@/lib/nutrition/meal-plan-nutrient-integration-hints";
import { dedupeLunchDinnerMainProteins } from "@/lib/nutrition/meal-plan-protein-dedupe";

function enrichSlot(slot: IntelligentMealPlanSlotOut, snapshot: FdcCanonicalSnapshot): IntelligentMealPlanSlotOut {
  const items = slot.items.map((it) => {
    const { compositionKey, compositionStatus, nutrients } = nutrientsForMealPlanItemFromCache(it, snapshot);
    return { ...it, compositionKey, compositionStatus, nutrients };
  });
  return { ...slot, items };
}

/**
 * Aggiunge stime nutrizionali dettagliate (macro/micro/aminoacidi/frazioni lipidiche/GI/II/GL) e routine idratazione
 * coerente con gli orari inviati nel request.
 *
 * Composizione preferita: cache USDA `nutrition_fdc_foods` (via `getOrImportFdcFood` → `nutrientsForMealPlanItemFromCache`).
 * Fallback automatico al `CANONICAL_FOOD_TABLE` TS quando una key non è ancora mappata o l'import USDA fallisce.
 *
 * Il `snapshot` può essere passato dall'esterno (chi ha già pre-caricato la cache, es. il builder
 * `buildDeterministicMealPlanFromRequest`) o lasciato omesso: in quel caso viene calcolato qui.
 */
export async function finalizeIntelligentMealPlanCore(
  core: IntelligentMealPlanAssembledCore,
  req: IntelligentMealPlanRequest,
  snapshot?: FdcCanonicalSnapshot,
): Promise<IntelligentMealPlanAssembledCore> {
  const slotsDeduped = dedupeLunchDinnerMainProteins(core.slots);
  const fdcSnapshot =
    snapshot ??
    (await buildFdcCanonicalSnapshot(
      slotsDeduped.flatMap((s) => s.items.map((it) => inferCanonicalFoodKey(`${it.name} ${it.portionHint}`))),
    ));
  const slots = slotsDeduped.map((s) => enrichSlot(s, fdcSnapshot));
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
        "Composizione da cache USDA FDC (nutrition_fdc_foods) quando disponibile; fallback alla banca canonica interna per voci non ancora mappate. GI/II derivati da macro USDA (Wolever-style estimate, salvati in DB).",
      dayTotals,
      perSlot,
    },
    hydrationRoutine: buildHydrationRoutineFromMealPlanRequest(req),
  };
}
