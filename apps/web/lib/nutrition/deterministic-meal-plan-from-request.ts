import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
  IntelligentMealPlanSlotOut,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { MEAL_SLOT_ORDER } from "@/lib/nutrition/intelligent-meal-plan-types";
import { inferCanonicalFoodKey, nutrientsForMealPlanItem } from "@/lib/nutrition/canonical-food-composition";
import { buildFdcCanonicalSnapshot } from "@/lib/nutrition/fdc-to-canonical-scaler";
import type { MediterraneanDayContext, MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import { composeMediterraneanMeal, createMediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";

/** Mappa la stringa libera `req.dietType` (profilo Supabase) sull'enum forte del composer. */
function normalizeDietTypeForComposer(raw: string | null | undefined): MediterraneanDietType | undefined {
  const d = (raw ?? "").trim().toLowerCase();
  if (!d || d === "omnivore" || d === "onnivor" || d === "other") return "omnivore";
  if (d === "vegan" || d.includes("vegan")) return "vegan";
  if (d === "vegetarian" || d.includes("veget")) return "vegetarian";
  if (d === "pescatarian" || d.includes("pesc")) return "pescatarian";
  return "omnivore";
}

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
 *
 * Composizione finale dei nutrienti (vit/min/EAA/grassi/GI/II) preferenzialmente da cache USDA
 * `nutrition_fdc_foods` (single source of truth lato server). Fallback automatico al TS table per
 * canonicalKey non ancora mappati o quando la cache non risponde (RLS, USDA giù, ecc.).
 */
export async function buildDeterministicMealPlanFromRequest(
  req: IntelligentMealPlanRequest,
): Promise<IntelligentMealPlanAssembledCore> {
  const slotByKey = new Map(req.slots.map((s) => [s.slot, s] as const));
  const orderedSlots = MEAL_SLOT_ORDER.map((k) => slotByKey.get(k)).filter(
    (s): s is IntelligentMealPlanRequestSlot => Boolean(s),
  );
  /** dietType + denyFragments dal request (allergie/intolleranze/esclusioni + dieta) → vincoli MANDATORY sul composer. */
  const dietType = normalizeDietTypeForComposer(req.dietType);
  const denyFragments = buildMealPlanFoodDenyFragments(req);
  const dayCtx = createMediterraneanDayContext(
    req.planDate,
    req.weeklyStapleCounts,
    req.postWorkoutMealBySlot,
    dietType,
    denyFragments,
  );

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
      "Piano da motore deterministico: per ogni pasto si scelgono fonti di carboidrati, proteine, grassi e fibre (verdura/frutta), poi si stimano le quantità e le kcal per voce dalla banca composizione (USDA FDC quando mappata, fallback canonica TS). Target pasto = output solver; la somma delle voci può discostarsi leggermente se le porzioni sono arrotondate. Non sostituisce parere medico.",
    slots,
    dayInteractionSummary:
      dayBits.join(" · ").slice(0, 800) ||
      "Distribuire i pasti secondo orari e target solver; rispettare intolleranze, allergie ed esclusioni del profilo.",
    mealRotationStaples: Array.from(dayCtx.usedStaples),
  };

  /**
   * Pre-load USDA snapshot per tutti gli item del giorno: un solo round-trip Supabase invece di N.
   * Fail-soft: se il batch fallisce (no service role, USDA giù, ecc.) lo snapshot resta vuoto e il
   * finalizer cade automaticamente sul TS table item per item — comportamento identico al pre-Step3.
   */
  const allKeys = slots.flatMap((s) => s.items.map((it) => inferCanonicalFoodKey(`${it.name} ${it.portionHint}`)));
  const fdcSnapshot = await buildFdcCanonicalSnapshot(allKeys);
  return await finalizeIntelligentMealPlanCore(core, req, fdcSnapshot);
}
