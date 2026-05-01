import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
  IntelligentMealPlanSlotOut,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_ORDER } from "@/lib/nutrition/intelligent-meal-plan-types";
import { nutrientsForMealPlanItem } from "@/lib/nutrition/canonical-food-composition";
import type { MediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import { composeMediterraneanMeal, createMediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";

/** Allinea `approxKcal` alla stima canonica da nome + porzione (grammi/ml dove parsabili), non a ripartizioni uguali sulle voci. */
function syncItemsApproxKcalFromCanonical(items: IntelligentMealPlanItemOut[]): IntelligentMealPlanItemOut[] {
  return items.map((it) => {
    const { nutrients } = nutrientsForMealPlanItem({
      name: it.name,
      portionHint: it.portionHint,
      approxKcal: it.approxKcal,
    });
    return { ...it, approxKcal: Math.max(8, Math.round(nutrients.kcal)) };
  });
}

function pickItemsForSlot(slot: IntelligentMealPlanRequestSlot, dayCtx: MediterraneanDayContext): IntelligentMealPlanItemOut[] {
  const slotMacros = {
    kcal: slot.targetKcal,
    carbsG: slot.targetCarbsG,
    proteinG: slot.targetProteinG,
    fatG: slot.targetFatG,
  };
  const composed = composeMediterraneanMeal(slot.slot, slotMacros, dayCtx);
  const groupTitles = slot.functionalFoodGroups.map((g) => g.displayNameIt).join(" · ");
  const bridgePrefix = groupTitles
    ? `Target funzionali (solver): ${groupTitles.slice(0, 180)}${groupTitles.length > 180 ? "…" : ""}. `
    : "";
  const bridged = composed.items.map((it) => ({
    ...it,
    functionalBridge: `${bridgePrefix}Composizione mediterranea semplice: ${it.functionalBridge}`.slice(0, 500),
  }));
  return syncItemsApproxKcalFromCanonical(bridged);
}

/**
 * Piano pasti assemblato solo da dati già nel request, senza OpenAI.
 * Flusso: fabbisogno e macro per slot (solver × profilo × training) → scelta fonti (CHO / PRO / grassi / fibre-vitamine)
 * → porzioni stimati dal composer → kcal voce da banca canonica + quantità (mai ripartizione uguale sul numero di voci).
 */
export function buildDeterministicMealPlanFromRequest(req: IntelligentMealPlanRequest): IntelligentMealPlanAssembledCore {
  const slotByKey = new Map(req.slots.map((s) => [s.slot, s] as const));
  const orderedSlots = MEAL_SLOT_ORDER.map((k) => slotByKey.get(k)).filter(
    (s): s is IntelligentMealPlanRequestSlot => Boolean(s),
  );
  const dayCtx = createMediterraneanDayContext(req.planDate, req.weeklyStapleCounts, req.postWorkoutMealBySlot);

  const slots: IntelligentMealPlanSlotOut[] = orderedSlots.map((slot) => {
    const items = pickItemsForSlot(slot, dayCtx);
    const groupTitles = slot.functionalFoodGroups.map((g) => g.displayNameIt).join(" · ");
    const timing =
      slot.functionalFoodGroups.find((g) => g.timingHalfLifeHint.trim())?.timingHalfLifeHint ??
      req.pathwayTimingLines[0] ??
      `Orario pasto ${slot.scheduledTimeLocal || "—"}; allinea al carico del giorno.`;

    const row: IntelligentMealPlanSlotOut = {
      slot: slot.slot,
      targetKcalEcho: slot.targetKcal,
      items,
      slotCoherence: groupTitles
        ? `Combinazione solver + funzionale: target da meal plan (${slot.targetKcal} kcal, macro come in griglia) con priorità a ${groupTitles.slice(0, 260)}${groupTitles.length > 260 ? "…" : ""}`
        : `Pasto strutturato su target solver: ${slot.targetKcal} kcal e macro CHO/PRO/grassi dello slot; porzioni e kcal per voce da fonti e quantità, non da ripartizione uniforme.`,
      slotTimingRationale: timing.slice(0, 400),
    };
    return row;
  });

  const dayBits = [
    `Σ pasti solver: ${req.mealPlanSolverMeta.dailyMealsKcalTotal} kcal/giorno (cinque slot)`,
    ...req.mealPlanSolverMeta.integrationLeverLines.slice(0, 8),
    ...req.pathwayTimingLines.slice(0, 4),
    ...req.trainingDayLines.slice(0, 3),
    ...req.contextLines.slice(0, 8),
    req.routineDigest,
  ].filter((s): s is string => Boolean(s && String(s).trim()));

  const core: IntelligentMealPlanAssembledCore = {
    layer: "deterministic_meal_assembly_v1",
    disclaimer:
      "Piano da motore deterministico: per ogni pasto si scelgono fonti di carboidrati, proteine, grassi e fibre (verdura/frutta), poi si stimano le quantità e le kcal per voce dalla banca composizione (non ripartizione uguale tra alimenti). Target pasto = output solver; la somma delle voci può discostarsi leggermente se le porzioni sono arrotondate. Non sostituisce parere medico.",
    slots,
    dayInteractionSummary:
      dayBits.join(" · ").slice(0, 800) ||
      "Distribuire i pasti secondo orari e target solver; rispettare intolleranze, allergie ed esclusioni del profilo.",
    mealRotationStaples: Array.from(dayCtx.usedStaples),
  };
  return finalizeIntelligentMealPlanCore(core, req);
}
