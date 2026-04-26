/**
 * Piano pasto da motore deterministico: input = solver pasti + pathway (reality > interpretazione).
 * Nessun LLM genera la struttura del piano; le kcal per voce seguono porzioni e banca composizione canonica.
 */

import type { ScaledMealItemNutrients } from "@/lib/nutrition/canonical-food-composition";

/** Ordine canonico pasti: due spuntini distinti (mattina / pomeriggio-sera). */
export type MealSlotKey = "breakfast" | "lunch" | "dinner" | "snack_am" | "snack_pm";

export const MEAL_SLOT_ORDER: readonly MealSlotKey[] = ["breakfast", "lunch", "dinner", "snack_am", "snack_pm"];

export type MealPlanHydrationWindow = {
  labelIt: string;
  scheduledTimeLocal: string;
  volumeMl: number;
  notesIt: string;
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
};

export type MealPlanHydrationRoutine = {
  baselineDailyMl: number;
  trainingExtraMl: number;
  totalTargetMl: number;
  windows: MealPlanHydrationWindow[];
};

export type MealPlanNutrientRollup = {
  disclaimerIt: string;
  dayTotals: ScaledMealItemNutrients;
  perSlot: Array<{
    slot: MealSlotKey;
    labelIt: string;
    scheduledTimeLocal: string;
    totals: ScaledMealItemNutrients;
  }>;
};

/** Opzione alimentare per un target funzionale (curato o USDA FDC). */
export type IntelligentMealPlanFoodOptionRef = {
  source: "curated" | "usda_fdc";
  label: string;
  rationale: string;
  fdcId: number | null;
};

/** Gruppo 3–5 opzioni per una stessa funzione metabolica / nutriente. */
export type IntelligentMealPlanFunctionalFoodGroup = {
  nutrientId: string;
  displayNameIt: string;
  pathwayLabel: string;
  rationaleShort: string;
  /** Da pathway deterministici: finestre qualitative, non PK molecolare. */
  timingHalfLifeHint: string;
  options: IntelligentMealPlanFoodOptionRef[];
};

export type IntelligentMealPlanRequestSlot = {
  slot: MealSlotKey;
  labelIt: string;
  /** Orario pasto lato utente (HH:mm) per idratazione e copy operativo. */
  scheduledTimeLocal: string;
  targetKcal: number;
  targetCarbsG: number;
  targetProteinG: number;
  targetFatG: number;
  /** Sintesi target funzionali per questo pasto (da pathway bundle). */
  functionalTargets: Array<{
    nutrientId: string;
    displayNameIt: string;
    pathwayLabel: string;
    rationaleShort: string;
  }>;
  /** Opzioni strutturate per nutriente (USDA + curati) — contesto per gruppi funzionali e filtri slot. */
  functionalFoodGroups: IntelligentMealPlanFunctionalFoodGroup[];
  /** Lista piatta ridondante per compatibilità / ricerca rapida nel prompt. */
  foodCandidates: string[];
};

/** Metadati del meal plan da solver giornaliero (training + recovery + integrazione operativa). */
export type IntelligentMealPlanSolverMeta = {
  /** Σ kcal dei cinque slot — stesso fabbisogno pasti della griglia Nutrition. */
  dailyMealsKcalTotal: number;
  /** Leve da `nutritionDayModel.performanceIntegration` (testo per assemblatore deterministico). */
  integrationLeverLines: string[];
};

export type IntelligentMealPlanRequest = {
  athleteId: string;
  planDate: string;
  dietType: string | null;
  intolerances: string[] | null;
  allergies: string[] | null;
  foodExclusions: string[] | null;
  foodPreferences: string[] | null;
  supplements: string[] | null;
  /** Da pathway modulation deterministica. */
  aggregateInhibitors: string[] | null;
  pathwayTimingLines: string[];
  trainingDayLines: string[];
  routineDigest: string | null;
  /** Contesto operativo breve (recovery, leve integrazione). */
  contextLines: string[];
  /** Collegamento esplicito al solver pasti × training programmato. */
  mealPlanSolverMeta: IntelligentMealPlanSolverMeta;
  slots: IntelligentMealPlanRequestSlot[];
  /**
   * Opzionale: conteggi staple (es. carb:pasta) da cache settimanale locale per rotazione pasti.
   * Inviato dal client con `meal-rotation-week-cache`.
   */
  weeklyStapleCounts?: Record<string, number>;
  /**
   * Slot il cui orario risolto (fine seduta + propagazione) è dopo la routine base: il composer favorisce CHO più rapidi
   * a pranzo/cena, spuntino più “refeed” (dolce / più cereali o salato più magro e croccante).
   */
  postWorkoutMealBySlot?: Partial<Record<MealSlotKey, boolean>>;
};

/** Eco del solver nella risposta: stesso “scheletro” usato per generare il piano combinato. */
export type IntelligentMealPlanSolverBasis = {
  source: "nutrition_meal_plan_solver";
  planDate: string;
  dailyMealsKcalTotal: number;
  dietType: string | null;
  profileConstraintLines: string[];
  trainingDayLines: string[];
  routineDigest: string | null;
  integrationLeverLines: string[];
  pathwayTimingLines: string[];
  aggregateInhibitors: string[] | null;
  /** Eco dei flag orario-spostato / post-seduta passati al composer (se presenti). */
  postWorkoutMealBySlot?: Partial<Record<MealSlotKey, boolean>>;
  slots: Array<{
    slot: MealSlotKey;
    labelIt: string;
    scheduledTimeLocal: string;
    targetKcal: number;
    targetCarbsG: number;
    targetProteinG: number;
    targetFatG: number;
  }>;
};

export type IntelligentMealPlanItemOut = {
  name: string;
  portionHint: string;
  functionalBridge: string;
  approxKcal: number;
  macroRole: "cho_heavy" | "protein" | "fat" | "mixed" | "veg";
  /** Chiave banca dati canonica (post-finalize). */
  compositionKey?: string;
  /** Provenienza composizione: `unresolved` non contribuisce nutrienti inventati. */
  compositionStatus?: "canonical_estimate" | "unresolved";
  /** Stime nutrizionali scalate sulle kcal dell’item (post-finalize). */
  nutrients?: ScaledMealItemNutrients;
};

export type IntelligentMealPlanSlotOut = {
  slot: MealSlotKey;
  targetKcalEcho: number;
  items: IntelligentMealPlanItemOut[];
  slotCoherence: string;
  /** Perché questo pasto in questo orario rispetto a vie/emivita qualitative e allenamento. */
  slotTimingRationale: string;
};

/** Unico layer attivo: piano pasti sempre da motore deterministico (nessun orchestratore LLM). */
export type IntelligentMealPlanResponseLayer = "deterministic_meal_assembly_v1";

/** Corpo assemblato (deterministico), prima dell’eco solver aggiunta in API. */
export type IntelligentMealPlanAssembledCore = {
  layer: IntelligentMealPlanResponseLayer;
  disclaimer: string;
  slots: IntelligentMealPlanSlotOut[];
  dayInteractionSummary: string;
  /** Staple usati nel giorno (deterministico) — da salvare in cache settimanale client. */
  mealRotationStaples?: string[];
  /** Presente dopo `finalizeIntelligentMealPlanCore` (API). */
  nutrientRollup?: MealPlanNutrientRollup;
  hydrationRoutine?: MealPlanHydrationRoutine;
};

export type IntelligentMealPlanResponseBody = IntelligentMealPlanAssembledCore & {
  /** Base deterministica (solver pasti × training + profilo + routine) combinata con le voci alimentari. */
  solverBasis: IntelligentMealPlanSolverBasis;
};

const SLOTS: MealSlotKey[] = [...MEAL_SLOT_ORDER];

function isMealSlotKey(s: string): s is MealSlotKey {
  return SLOTS.includes(s as MealSlotKey);
}

function isMacroRole(s: string): s is IntelligentMealPlanItemOut["macroRole"] {
  return s === "cho_heavy" || s === "protein" || s === "fat" || s === "mixed" || s === "veg";
}

export function parseIntelligentMealPlanJson(raw: unknown): IntelligentMealPlanAssembledCore | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.layer !== "deterministic_meal_assembly_v1") return null;
  const disclaimer = typeof o.disclaimer === "string" ? o.disclaimer : "";
  const dayInteractionSummary = typeof o.dayInteractionSummary === "string" ? o.dayInteractionSummary : "";
  const slotsIn = o.slots;
  if (!Array.isArray(slotsIn) || slotsIn.length !== 5) return null;

  const slots: IntelligentMealPlanSlotOut[] = [];
  for (const row of slotsIn) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const slot = typeof r.slot === "string" && isMealSlotKey(r.slot) ? r.slot : null;
    if (!slot) return null;
    const targetKcalEcho = typeof r.targetKcalEcho === "number" && Number.isFinite(r.targetKcalEcho) ? r.targetKcalEcho : NaN;
    if (!Number.isFinite(targetKcalEcho) || targetKcalEcho <= 0) return null;
    const slotCoherence = typeof r.slotCoherence === "string" ? r.slotCoherence.slice(0, 400) : "";
    const slotTimingRationale =
      typeof r.slotTimingRationale === "string" ? r.slotTimingRationale.trim().slice(0, 420) : "";
    const itemsIn = r.items;
    if (!Array.isArray(itemsIn) || itemsIn.length < 2 || itemsIn.length > 8) return null;
    const items: IntelligentMealPlanItemOut[] = [];
    for (const it of itemsIn) {
      if (!it || typeof it !== "object") return null;
      const i = it as Record<string, unknown>;
      const name = typeof i.name === "string" ? i.name.trim().slice(0, 160) : "";
      if (!name) return null;
      const portionHint = typeof i.portionHint === "string" ? i.portionHint.trim().slice(0, 180) : "";
      const functionalBridge = typeof i.functionalBridge === "string" ? i.functionalBridge.trim().slice(0, 500) : "";
      const approxKcal = typeof i.approxKcal === "number" && Number.isFinite(i.approxKcal) ? i.approxKcal : NaN;
      if (!Number.isFinite(approxKcal) || approxKcal < 0 || approxKcal > 2500) return null;
      const macroRole = typeof i.macroRole === "string" && isMacroRole(i.macroRole) ? i.macroRole : null;
      if (!macroRole) return null;
      items.push({ name, portionHint, functionalBridge, approxKcal, macroRole });
    }
    slots.push({ slot, targetKcalEcho, items, slotCoherence, slotTimingRationale });
  }

  const seen = new Set<MealSlotKey>();
  for (const s of slots) {
    if (seen.has(s.slot)) return null;
    seen.add(s.slot);
  }
  if (seen.size !== 5) return null;
  for (const key of MEAL_SLOT_ORDER) {
    if (!seen.has(key)) return null;
  }

  const assembled: IntelligentMealPlanAssembledCore = {
    layer: "deterministic_meal_assembly_v1",
    disclaimer: disclaimer.slice(0, 500),
    slots,
    dayInteractionSummary: dayInteractionSummary.slice(0, 800),
  };
  return assembled;
}

/** Ricalibra kcal item per avvicinare la somma al target pasto (senza cambiare nomi). */
export function rescaleSlotKcalToTarget(slot: IntelligentMealPlanSlotOut, targetKcal: number): IntelligentMealPlanSlotOut {
  const sum = slot.items.reduce((a, i) => a + i.approxKcal, 0);
  if (sum <= 0 || targetKcal <= 0) return slot;
  const f = targetKcal / sum;
  const items = slot.items.map((i) => ({
    ...i,
    approxKcal: Math.max(15, Math.round(i.approxKcal * f)),
  }));
  let newSum = items.reduce((a, i) => a + i.approxKcal, 0);
  const drift = Math.round(targetKcal - newSum);
  if (items.length && drift !== 0) {
    const last = items.length - 1;
    items[last] = {
      ...items[last]!,
      approxKcal: Math.max(15, items[last]!.approxKcal + drift),
    };
  }
  return { ...slot, items };
}

/**
 * Valida che la somma kcal dello slot sia entro tolleranza dal target richiesto.
 * Se fuori range dopo rescale, restituisce false.
 */
export function slotKcalWithinTolerance(
  slot: IntelligentMealPlanSlotOut,
  targetKcal: number,
  tolerance = 0.14,
): boolean {
  const sum = slot.items.reduce((a, i) => a + i.approxKcal, 0);
  const lo = targetKcal * (1 - tolerance);
  const hi = targetKcal * (1 + tolerance);
  return sum >= lo && sum <= hi;
}
