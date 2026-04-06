import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
  IntelligentMealPlanSlotOut,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_ORDER, rescaleSlotKcalToTarget } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import { composeMediterraneanMeal, createMediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";

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
  return composed.items.map((it) => ({
    ...it,
    functionalBridge: `${bridgePrefix}Composizione mediterranea semplice: ${it.functionalBridge}`.slice(0, 500),
  }));
}

/**
 * Piano pasti assemblato solo da dati già nel request (gruppi funzionali + candidati), senza OpenAI.
 */
export function buildDeterministicMealPlanFromRequest(req: IntelligentMealPlanRequest): IntelligentMealPlanAssembledCore {
  const slotByKey = new Map(req.slots.map((s) => [s.slot, s] as const));
  const orderedSlots = MEAL_SLOT_ORDER.map((k) => slotByKey.get(k)).filter(
    (s): s is IntelligentMealPlanRequestSlot => Boolean(s),
  );
  const dayCtx = createMediterraneanDayContext(req.planDate, req.weeklyStapleCounts);

  const slots: IntelligentMealPlanSlotOut[] = orderedSlots.map((slot) => {
    const items = pickItemsForSlot(slot, dayCtx);
    const groupTitles = slot.functionalFoodGroups.map((g) => g.displayNameIt).join(" · ");
    const timing =
      slot.functionalFoodGroups.find((g) => g.timingHalfLifeHint.trim())?.timingHalfLifeHint ??
      req.pathwayTimingLines[0] ??
      `Orario pasto ${slot.scheduledTimeLocal || "—"}; allinea al carico del giorno.`;

    let row: IntelligentMealPlanSlotOut = {
      slot: slot.slot,
      targetKcalEcho: slot.targetKcal,
      items,
      slotCoherence: groupTitles
        ? `Combinazione solver + funzionale: target da meal plan (${slot.targetKcal} kcal, macro come in griglia) con priorità a ${groupTitles.slice(0, 260)}${groupTitles.length > 260 ? "…" : ""}`
        : `Pasto da candidati con target solver: ${slot.targetKcal} kcal e macro CHO/PRO/grassi dello slot.`,
      slotTimingRationale: timing.slice(0, 400),
    };
    row = rescaleSlotKcalToTarget(row, slot.targetKcal);
    return row;
  });

  const dayBits = [
    `Σ pasti solver: ${req.mealPlanSolverMeta.dailyMealsKcalTotal} kcal/giorno (cinque slot)`,
    ...req.mealPlanSolverMeta.integrationLeverLines.slice(0, 8),
    ...req.pathwayTimingLines.slice(0, 4),
    ...req.trainingDayLines.slice(0, 3),
    req.routineDigest,
  ].filter((s): s is string => Boolean(s && String(s).trim()));

  const core: IntelligentMealPlanAssembledCore = {
    layer: "deterministic_meal_assembly_v1",
    disclaimer:
      "Piano mediterraneo semplice: porzioni scalate sui target kcal/macro dello slot (solver); pasti principali con un solo amido e una sola fonte proteica. I gruppi funzionali/USDA restano per contesto metabolico, non per elenchi casuali. Non sostituisce parere medico.",
    slots,
    dayInteractionSummary:
      dayBits.join(" · ").slice(0, 800) ||
      "Distribuire i pasti secondo orari e target solver; rispettare intolleranze, allergie ed esclusioni del profilo.",
    mealRotationStaples: Array.from(dayCtx.usedStaples),
  };
  return finalizeIntelligentMealPlanCore(core, req);
}
