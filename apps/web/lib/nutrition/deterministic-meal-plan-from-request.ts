import type {
  IntelligentMealPlanAssembledCore,
  IntelligentMealPlanItemOut,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
  IntelligentMealPlanSlotOut,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";
import { rescaleSlotKcalToTarget } from "@/lib/nutrition/intelligent-meal-plan-types";
import { inferCanonicalFoodKey, nutrientsForMealPlanItem } from "@/lib/nutrition/canonical-food-composition";
import { buildFdcCanonicalSnapshot } from "@/lib/nutrition/fdc-to-canonical-scaler";
import type { MediterraneanDayContext, MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import { applyNutrientBoostSwaps, composeMediterraneanMeal, createMediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import { buildMealPlanFoodDenyFragments } from "@/lib/nutrition/meal-plan-profile-food-filter";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import { rankUsdaCacheForTargets, type UsdaRankedFood } from "@/lib/nutrition/usda-nutrient-density-ranker";
import { racePreLunchContextLine } from "@/lib/nutrition/race-day-pre-race-lunch";
import { disambiguatedShortFoodLabel } from "@/lib/nutrition/usda-food-label";

/** Validi `NutrientTargetId` (subset di chiavi del CanonicalFoodNutrients) — keys statiche per filtro di sicurezza. */
const VALID_NUTRIENT_TARGET_IDS = new Set<NutrientTargetId>([
  "vitA_mcg_RAE",
  "vitC_mg",
  "vitD_mcg",
  "vitE_mg",
  "vitK_mcg",
  "thiamineB1_mg",
  "riboflavinB2_mg",
  "niacinB3_mg",
  "vitB6_mg",
  "folate_mcg",
  "vitB12_mcg",
  "ca_mg",
  "fe_mg",
  "mg_mg",
  "p_mg",
  "k_mg",
  "na_mg",
  "zn_mg",
  "se_mcg",
  "fiberG",
  "omega3G",
]);

/** Filtra/typizza i `nutrientBoostTargets` ricevuti dal request (il typing del request è loose: `string`). */
function selectValidBoostTargets(
  targets: NonNullable<IntelligentMealPlanRequest["nutrientBoostTargets"]>,
): Array<{ nutrientId: NutrientTargetId; labelIt: string }> {
  return targets
    .filter((t) => VALID_NUTRIENT_TARGET_IDS.has(t.nutrientId as NutrientTargetId))
    .map((t) => ({ nutrientId: t.nutrientId as NutrientTargetId, labelIt: t.labelIt }));
}

/** Costruisce 1 riga sintetica per UI: "Vitamina B12 → top 3: Fish, salmon · Cheese, parmesan · Egg, whole" (compatta). */
function formatBoostLineForNutrient(label: string, items: UsdaRankedFood[]): string | null {
  if (items.length === 0) return null;
  /** `disambiguatedShortFoodLabel` evita "Seeds, Seeds, Seeds": mostra "Seeds, sesame", "Seeds, sunflower", … */
  const names = items.slice(0, 3).map((i) => disambiguatedShortFoodLabel(i.description, 44)).join(" · ");
  const lead = items[0]!;
  const headDose = `${lead.amountPer100g.toFixed(lead.amountPer100g >= 10 ? 0 : 1)} ${lead.unit}/100g`;
  return `${label} → ${names} (top1 ~${headDose})`.slice(0, 260);
}

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

function pickItemsForSlot(
  slot: IntelligentMealPlanRequestSlot,
  dayCtx: MediterraneanDayContext,
  boostTargetIds: readonly NutrientTargetId[] = [],
): IntelligentMealPlanItemOut[] {
  const slotMacros = {
    kcal: slot.targetKcal,
    carbsG: slot.targetCarbsG,
    proteinG: slot.targetProteinG,
    fatG: slot.targetFatG,
  };
  const composed = applyNutrientBoostSwaps(
    composeMediterraneanMeal(slot.slot, slotMacros, dayCtx),
    slot.slot,
    boostTargetIds,
    dayCtx,
  );
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
  const orderedSlots = req.slots;
  /** dietType + denyFragments dal request (allergie/intolleranze/esclusioni + dieta) → vincoli MANDATORY sul composer. */
  const dietType = normalizeDietTypeForComposer(req.dietType);
  const denyFragments = buildMealPlanFoodDenyFragments(req);
  const suppressed = req.suppressedSlots ?? [];
  const dayCtx = createMediterraneanDayContext(
    req.planDate,
    req.weeklyStapleCounts,
    req.postWorkoutMealBySlot,
    dietType,
    denyFragments,
    suppressed,
    req.racePreLunch ?? undefined,
  );

  /**
   * STEP C — Bridge "sistema intelligente → generatore" (regola utente):
   *   il pathway-modulation produce `cofactors`/`substrates` (es. "B12, folati, ferro" per eritropoiesi),
   *   il request builder li mappa in `nutrientBoostTargets`, e qui interroghiamo la cache USDA per i
   *   top-3 alimenti più ricchi di ciascun nutriente. Il generatore NON ragiona sul pathway: scrive solo
   *   note testuali nel piano (`slotCoherence` e `dayInteractionSummary`).
   */
  const validBoostTargets = req.nutrientBoostTargets ? selectValidBoostTargets(req.nutrientBoostTargets) : [];
  const boostTargetIds = validBoostTargets.map((t) => t.nutrientId);
  const boostRanking: Partial<Record<NutrientTargetId, UsdaRankedFood[]>> = {};
  if (validBoostTargets.length > 0) {
    try {
      const ids = validBoostTargets.map((t) => t.nutrientId);
      const ranked = await rankUsdaCacheForTargets(ids, 3);
      Object.assign(boostRanking, ranked);
    } catch {
      /** Fail-soft: se la cache USDA non è disponibile (RLS, service role, ecc.) il piano resta valido senza note boost. */
    }
  }
  /** Linee compatte per la UI: "B12 → top 3: salmone, uova, yogurt". Solo nutrienti con almeno 1 alimento ranked. */
  const boostLines: string[] = [];
  for (const t of validBoostTargets) {
    const rows = boostRanking[t.nutrientId];
    if (!rows || rows.length === 0) continue;
    const line = formatBoostLineForNutrient(t.labelIt, rows);
    if (line) boostLines.push(line);
  }

  /** Slot in cui applicare swap pathway (main + spuntini con target timing). */
  const PRIMARY_BOOST_SLOTS = new Set<MealSlotKey>(["lunch", "dinner", "snack_am", "snack_pm"]);

  const slots: IntelligentMealPlanSlotOut[] = orderedSlots.map((slot) => {
    const isSuppressed = suppressed.includes(slot.slot);
    let items = pickItemsForSlot(slot, dayCtx, boostTargetIds);
    if (!isSuppressed && slot.targetKcal > 0) {
      items = rescaleSlotKcalToTarget(
        {
          slot: slot.slot,
          targetKcalEcho: slot.targetKcal,
          items,
          slotCoherence: "",
          slotTimingRationale: "",
        },
        slot.targetKcal,
      ).items;
    }
    const groupTitles = slot.functionalFoodGroups.map((g) => g.displayNameIt).join(" · ");
    const timing = isSuppressed
      ? `Slot ${slot.slot} (${slot.scheduledTimeLocal || "—"}) cade nella finestra di allenamento: rifornimento in seduta gestito dal modulo Fueling (no spuntino convenzionale).`
      : (slot.functionalFoodGroups.find((g) => g.timingHalfLifeHint.trim())?.timingHalfLifeHint ??
          req.pathwayTimingLines[0] ??
          `Orario pasto ${slot.scheduledTimeLocal || "—"}; allinea al carico del giorno.`);

    const baseCoherence = isSuppressed
      ? `Spuntino convenzionale soppresso: lo slot ${slot.slot} (${slot.scheduledTimeLocal || "—"}) ricade nella finestra di allenamento. Le kcal/CHO/elettroliti necessari sono coperti dal piano Fueling (gel + sport drink + idratazione).`
      : slot.slot === "lunch" && req.racePreLunch
        ? racePreLunchContextLine(req.racePreLunch)
        : groupTitles
          ? `Combinazione solver + funzionale: target da meal plan (${slot.targetKcal} kcal, macro come in griglia) con priorità a ${groupTitles.slice(0, 260)}${groupTitles.length > 260 ? "…" : ""}`
          : `Pasto strutturato su target solver: ${slot.targetKcal} kcal e macro CHO/PRO/grassi dello slot; porzioni e kcal per voce da fonti e quantità, non da ripartizione uniforme.`;

    /**
     * Boost note per slot: appare solo nei pasti principali (lunch/dinner). È un SUGGERIMENTO
     * COMPLEMENTARE (non sostituisce la scelta del composer): es. aggiungere 1 cucchiaio di semi
     * di lino al pasto, una porzione di verdura ricca, ecc.
     */
    const slotBoostNote =
      !isSuppressed && PRIMARY_BOOST_SLOTS.has(slot.slot) && boostLines.length > 0
        ? `Suggerimenti complementari (sistema intelligente · cofactors pathway): ${boostLines.slice(0, 4).join(" | ")}`
        : undefined;

    const slotBoostSuffix = slotBoostNote ? ` · ${slotBoostNote}` : "";

    const row: IntelligentMealPlanSlotOut = {
      slot: slot.slot,
      /** Per slot soppressi, l'eco kcal mostra il placeholder ridotto (≤ 60 kcal): la UI evidenzia "in-ride fueling". */
      targetKcalEcho: isSuppressed
        ? Math.max(15, items.reduce((a, i) => a + i.approxKcal, 0))
        : slot.targetKcal,
      items,
      slotCoherence: `${baseCoherence}${slotBoostSuffix}`.slice(0, 480),
      slotTimingRationale: timing.slice(0, 400),
      boostNote: slotBoostNote,
    };
    return row;
  });

  const suppressedNote = suppressed.length > 0
    ? `Spuntini soppressi (cadono dentro la finestra di allenamento): ${suppressed.join(", ")} → vedi modulo Fueling per gel/idratazione/elettroliti in seduta.`
    : null;

  const pathwayTransparency =
    req.pathwayModulationActiveLabels?.trim()
      ? `Pathway modulation attivi oggi: ${req.pathwayModulationActiveLabels.trim().slice(0, 280)} — i suggerimenti micronutrienti (top USDA) dipendono da questi pathway + dai loro cofactors, NON dalla lista alimenti scelta dal composer mediterraneo.`
      : null;

  const boostSummary =
    boostLines.length > 0
      ? [
          pathwayTransparency,
          `Micronutrienti suggeriti (cache USDA, densità per 100 g): ${boostLines.join(" | ")}.`,
          `Son VARIANTI complementari da preferire/aggiungere (porzioni) nei pasti principali — il piano sopra resta sul solver deterministico.`,
          `Integratori / checklist operativa: scheda Nutrition · Integrazione.`,
        ]
          .filter((s): s is string => Boolean(s?.trim()))
          .join(" ")
          .slice(0, 820)
      : pathwayTransparency;

  const dayBits = [
    `Σ pasti solver: ${req.mealPlanSolverMeta.dailyMealsKcalTotal} kcal/giorno (${orderedSlots.length} slot)`,
    suppressedNote,
    typeof boostSummary === "string" && boostSummary.trim() ? boostSummary : null,
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
