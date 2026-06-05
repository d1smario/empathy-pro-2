/**
 * Composizione deterministica “piano alimentare” stile mediterraneo:
 * per slot si fissano target kcal/macro (dal solver), poi si compone il pasto con
 * una fonte principale di CHO, una di proteine, grassi (olio / formaggio), fibre (verdura),
 * eventuale pane — porzioni iterate su densità indicative; nessuna ripartizione uniforme
 * delle kcal sul numero di voci (le kcal per riga restano legate alle quantità stimati).
 */

import type { IntelligentMealPlanItemOut, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { composeBreakfastWithArchetypes } from "@/lib/nutrition/breakfast-meal-archetypes";
import {
  ROTATION_MAX_WEEK_USES,
  ROTATION_TARGET_WEEK_USES,
} from "@/lib/nutrition/meal-composition-rules";
import type { RacePostRecoveryContext, RacePreLunchDayContext } from "@/lib/nutrition/race-day-pre-race-lunch";
import { composeRacePostRecoveryMeal, composeRacePreLunchMainMeal } from "@/lib/nutrition/race-day-pre-race-lunch";
import { CANONICAL_FOOD_TABLE, inferCanonicalFoodKeyPreferName, scaleCanonicalNutrientsToGrams } from "@/lib/nutrition/canonical-food-composition";
import { appendProteinShakeLiquidIfNeeded } from "@/lib/nutrition/meal-protein-shake-pair";
import { canUseCanonicalKey } from "@/lib/nutrition/meal-rotation-guard";

/** Allineato a `DryMealSlotMacros` in dry-meal-plan-lines (evita import circolare). */
export type MealMacroTargets = {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

/** Tipologia dieta dichiarata sul profilo: vincolo MANDATORY su famiglie alimentari del composer. */
export type MediterraneanDietType = "omnivore" | "vegetarian" | "pescatarian" | "vegan";

/** Contesto unico per tutti gli slot dello stesso giorno: evita stessi amidi/proteine ripetuti. */
export type MediterraneanDayContext = {
  planDate: string;
  /** Chiavi: carb:pasta | prot:pollo | prot:pesce | … */
  usedStaples: Set<string>;
  /** Conteggi staple negli altri giorni della settimana ISO (cache client). Soft cap ~2. */
  weekStapleCounts?: Record<string, number>;
  /** Orario slot spostato vs routine (fine seduta + propagazione): pranzo/cena CHO più refeed; spuntini più CHO / meno grassi. */
  postWorkoutMealBySlot?: Partial<Record<MealSlotKey, boolean>>;
  /** Tipologia dieta atleta — esclude famiglie proteiche/CHO incompatibili (vegan, vegetarian, pescatarian, omnivore). */
  dietType?: MediterraneanDietType;
  /** Sottostringhe da escludere per allergie/intolleranze/esclusioni (lowercase, già normalizzate dal request builder). */
  denyFragments?: string[];
  /**
   * Slot soppressi perché cadono dentro la finestra di allenamento (es. snack_am 10:30 in long ride 9–13:30):
   * il composer ritorna un placeholder che rimanda al modulo Fueling per gel/idratazione/elettroliti in seduta,
   * preservando la simmetria dei 5 slot per UI e rollup.
   */
  suppressedSlots?: MealSlotKey[];
  /** Giorno gara: protocollo pre-gara canonico (pranzo 3 h prima, pasta/riso 3 g CHO/kg). */
  racePreLunch?: RacePreLunchDayContext;
  /** Giorno gara: snack recovery post-gara (CHO/PRO/MCT g/kg) con quota energetica dedicata. */
  racePostRecovery?: RacePostRecoveryContext;
  /** Canonical keys già usate oggi (zero ripetizioni tra slot dello stesso giorno). */
  dayUsedCanonicalKeys?: Set<string>;
};

export function createMediterraneanDayContext(
  planDate: string,
  weekStapleCounts?: Record<string, number>,
  postWorkoutMealBySlot?: Partial<Record<MealSlotKey, boolean>>,
  dietType?: MediterraneanDietType,
  denyFragments?: string[],
  suppressedSlots?: MealSlotKey[],
  racePreLunch?: RacePreLunchDayContext,
  racePostRecovery?: RacePostRecoveryContext,
): MediterraneanDayContext {
  const w =
    weekStapleCounts && Object.keys(weekStapleCounts).length
      ? { ...weekStapleCounts }
      : undefined;
  const pw =
    postWorkoutMealBySlot && Object.keys(postWorkoutMealBySlot).length
      ? { ...postWorkoutMealBySlot }
      : undefined;
  const deny =
    denyFragments && denyFragments.length > 0
      ? denyFragments.map((s) => s.toLowerCase()).filter((s) => s.length >= 2)
      : undefined;
  const supp =
    suppressedSlots && suppressedSlots.length > 0 ? [...suppressedSlots] : undefined;
  return {
    planDate,
    usedStaples: new Set(),
    weekStapleCounts: w,
    postWorkoutMealBySlot: pw,
    dietType,
    denyFragments: deny,
    suppressedSlots: supp,
    racePreLunch,
    racePostRecovery,
    dayUsedCanonicalKeys: new Set(),
  };
}

function filterWeekRotationPool<T>(base: T[], countFor: (item: T) => number): T[] {
  const targetOk = base.filter((item) => countFor(item) < ROTATION_TARGET_WEEK_USES);
  if (targetOk.length) return targetOk;
  const maxOk = base.filter((item) => countFor(item) < ROTATION_MAX_WEEK_USES);
  return maxOk.length ? maxOk : base;
}

function filterByDayRotation<T extends { canonicalKey: string }>(
  specs: readonly T[],
  ctx?: MediterraneanDayContext,
): T[] {
  if (!ctx?.dayUsedCanonicalKeys?.size) return [...specs];
  return specs.filter((s) => canUseCanonicalKey(ctx, s.canonicalKey));
}

/** Match deterministico (case-insensitive, sostringa) tra una keyword e i fragments di blocco. */
function denyHit(keywords: readonly string[], deny: readonly string[] | undefined): boolean {
  if (!deny || deny.length === 0) return false;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    for (const d of deny) {
      if (!d) continue;
      if (k.includes(d) || d.includes(k)) return true;
    }
  }
  return false;
}

function planDateHash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 10007;
  return h;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function roundToStep(n: number, step = 5): number {
  return Math.round(n / step) * step;
}

function clampStep(n: number, lo: number, hi: number, step = 5): number {
  return Math.max(lo, Math.min(hi, roundToStep(n, step)));
}

function hashSeed(slot: MealSlotKey, kcal: number, planDate?: string): number {
  const s = slot.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  /** planDate include il giorno della settimana nel seed: senza, lo stesso slot+kcal
   *  generava lo stesso indice per tutti i 7 giorni e il composer prendeva lo stesso
   *  carb/protein finche' non raggiungeva il cap MAX_STAPLE_USES_PER_WEEK. */
  const dateBoost = planDate ? planDateHash(planDate) * 13 : 0;
  return Math.abs(Math.round(kcal * 1.73 + s * 41 + dateBoost));
}

export type MediterraneanComposedMeal = {
  lines: string[];
  items: IntelligentMealPlanItemOut[];
  totalApproxKcal: number;
};

function item(
  name: string,
  portionHint: string,
  approxKcal: number,
  macroRole: IntelligentMealPlanItemOut["macroRole"],
  functionalBridge: string,
): IntelligentMealPlanItemOut {
  return {
    name,
    portionHint: portionHint.slice(0, 160),
    approxKcal: Math.max(15, Math.round(approxKcal)),
    macroRole,
    functionalBridge: functionalBridge.slice(0, 500),
  };
}

/**
 * MATEMATICA PORZIONI (regola utente nutrizionista): niente ricette/grammature fisse.
 * Dato il target macro dello slot (CHO/PRO/FAT dal solver fabbisogno), si calcolano i
 * GRAMMI di ciascun alimento SCELTO così che la somma di carboidrati/proteine/grassi
 * cada entro tolleranza dal target.
 *
 * Coerenza header ⇄ voci: le macro vengono lette SEMPRE da `CANONICAL_FOOD_TABLE`
 * (single source of truth, le stesse usate da `finalizeIntelligentMealPlanCore` quando
 * il `portionHint` è mono-ingrediente con grammi espliciti). Ogni `name` deve
 * re-inferire la propria `canonicalKey` (vedi `INFER_RULES`), così i grammi prodotti
 * qui producono gli stessi macro mostrati nelle voci.
 */
type SolveFoodSpec = {
  /** Chiave in CANONICAL_FOOD_TABLE (macro per 100 g). */
  canonicalKey: string;
  /** Nome voce: DEVE re-inferire `canonicalKey`. */
  name: string;
  /** Sostantivo per il `portionHint` ("pasta di semola (peso crudo)"). */
  noun: string;
  /** Leva del solver per quel macro, oppure contributo a porzione fissa. */
  role: "cho" | "protein" | "fat" | "fixed";
  macroRole: IntelligentMealPlanItemOut["macroRole"];
  minG: number;
  maxG: number;
  stepG: number;
  /** Grammatura per `role: "fixed"` (verdura/frutta/pane secondario/formaggio). */
  fixedG?: number;
  bridge: string;
  /** Formattazione `portionHint` alternativa (es. uova: conta + grammi). */
  formatPortion?: (g: number) => string;
};

function canonMacroPerG(key: string): { c: number; p: number; f: number } {
  const r = CANONICAL_FOOD_TABLE[key];
  if (!r) return { c: 0, p: 0, f: 0 };
  return { c: r.carbsG / 100, p: r.proteinG / 100, f: r.fatG / 100 };
}

/**
 * Coordinate descent: ogni macro controllata dal suo alimento "leva", tenendo conto
 * dei contributi incrociati (es. la pasta porta anche proteine, l'olio solo grassi).
 * Gli alimenti `fixed` (verdura/frutta) contribuiscono ma non vengono mossi.
 */
function solvePortionsByMacros(foods: SolveFoodSpec[], target: MealMacroTargets): number[] {
  const grams = foods.map((f) =>
    f.role === "fixed" ? clampStep(f.fixedG ?? f.minG, f.minG, f.maxG, f.stepG) : f.minG,
  );
  const idxOf = (role: SolveFoodSpec["role"]) => foods.findIndex((f) => f.role === role);
  const choIdx = idxOf("cho");
  const proIdx = idxOf("protein");
  const fatIdx = idxOf("fat");
  const sumMacro = (m: "c" | "p" | "f"): number =>
    foods.reduce((a, f, i) => a + grams[i]! * canonMacroPerG(f.canonicalKey)[m], 0);
  const adjust = (idx: number, m: "c" | "p" | "f", t: number): void => {
    if (idx < 0) return;
    const f = foods[idx]!;
    const perG = canonMacroPerG(f.canonicalKey)[m];
    if (perG <= 0) return;
    const others = sumMacro(m) - grams[idx]! * perG;
    grams[idx] = clampStep((t - others) / perG, f.minG, f.maxG, f.stepG);
  };
  for (let it = 0; it < 16; it++) {
    adjust(proIdx, "p", Math.max(0, target.proteinG));
    adjust(choIdx, "c", Math.max(0, target.carbsG));
    adjust(fatIdx, "f", Math.max(0, target.fatG));
  }
  return grams;
}

/** Costruisce voci + righe dal set risolto, leggendo kcal/macro dalla banca canonica (coerenza con finalize). */
function buildMealFromSolved(foods: SolveFoodSpec[], grams: number[]): MediterraneanComposedMeal {
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  let total = 0;
  foods.forEach((f, i) => {
    const g = Math.round(grams[i] ?? 0);
    const minMeaningful = f.role === "fat" ? 4 : 8;
    if (g < minMeaningful) return;
    const r = CANONICAL_FOOD_TABLE[f.canonicalKey];
    if (!r) return;
    const kcal = Math.max(15, Math.round(scaleCanonicalNutrientsToGrams(r, g).kcal));
    const portion = (f.formatPortion ? f.formatPortion(g) : `${g} g ${f.noun}`).slice(0, 160);
    items.push(item(f.name, portion, kcal, f.macroRole, f.bridge));
    lines.push(portion);
    total += kcal;
  });
  return { items, lines, totalApproxKcal: total };
}


/** Sceglie la leva (cho/protein/fat) che può davvero raggiungere il target macro; rotazione per seed tra le fattibili. */
function chooseLeverByCapacity(
  candidates: SolveFoodSpec[],
  macro: "c" | "p" | "f",
  target: number,
  seed: number,
): SolveFoodSpec {
  if (candidates.length === 1) return candidates[0]!;
  const capacity = (c: SolveFoodSpec) => canonMacroPerG(c.canonicalKey)[macro] * c.maxG;
  const feasible = candidates.filter((c) => capacity(c) >= target * 0.9);
  /** Nessuna fonte copre il target: prendi quella a capacità massima (no rotazione, evita undershoot). */
  if (feasible.length === 0) return [...candidates].sort((a, b) => capacity(b) - capacity(a))[0]!;
  return feasible[Math.abs(seed) % feasible.length]!;
}

/**
 * Colazione mediterranea — porzioni calcolate sul target macro (no ricette fisse).
 * Ammessi: cereali integrali (avena), pane, gallette, frutta, yogurt/latte/uova/whey, marmellata,
 * grasso (avocado). ESCLUSI per regola: pasta, riso, patate, verdura, legumi, carne, pesce.
 */
function composeBreakfast(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const deny = ctx.denyFragments;
  const isVegan = ctx.dietType === "vegan";
  const denyDairy = isVegan || denyHit(["latte", "lattosio", "latticino", "yogurt", "milk"], deny);
  const denyEgg = denyHit(["uov", "ovo", "egg", "album"], deny);
  const denyGluten = denyHit(["glutine", "gluten", "frumento", "wheat"], deny);
  const postWO = Boolean(ctx.postWorkoutMealBySlot?.["breakfast"]);

  // CHO principale: avena / pane / gallette (mai pasta/riso/patate/verdura/legumi a colazione).
  const oatAllowed = !denyHit(["avena", "oat", "cereali", "fiocchi"], deny) && !denyGluten;
  const breadAllowed = !denyHit(["pane", "bread"], deny) && !denyGluten;
  const choCandidates: SolveFoodSpec[] = [];
  if (oatAllowed) {
    choCandidates.push({ canonicalKey: "oat_dry", name: "Fiocchi d'avena", noun: "fiocchi d'avena", role: "cho", macroRole: "cho_heavy", minG: 30, maxG: 200, stepG: 5, bridge: "Carboidrati colazione (cereali integrali): grammi calcolati sul target CHO del pasto." });
  }
  if (breadAllowed) {
    choCandidates.push({ canonicalKey: "bread_white", name: "Pane integrale", noun: "pane integrale", role: "cho", macroRole: "cho_heavy", minG: 30, maxG: 220, stepG: 5, bridge: "Carboidrati colazione (pane integrale): grammi sul target CHO." });
  }
  if (!denyHit(["gallette", "cracker", "fette biscot"], deny)) {
    choCandidates.push({ canonicalKey: "crackers_whole", name: "Gallette integrali", noun: "gallette integrali", role: "cho", macroRole: "cho_heavy", minG: 20, maxG: 120, stepG: 5, bridge: "Carboidrati croccanti colazione: grammi sul target CHO." });
  }
  if (choCandidates.length === 0) {
    choCandidates.push({ canonicalKey: "oat_dry", name: "Fiocchi d'avena", noun: "fiocchi d'avena", role: "cho", macroRole: "cho_heavy", minG: 30, maxG: 200, stepG: 5, bridge: "Carboidrati colazione." });
  }
  const choSpec = chooseLeverByCapacity(choCandidates, "c", m.carbsG, seed);
  // Rotazione settimanale: registra UN solo staple breakfast (carb principale).
  ctx.usedStaples?.add(`breakfast:${choSpec.canonicalKey}`);

  // Proteina: yogurt/uova/whey (onnivoro/veg), soia/tofu (vegan). Niente latte come leva (CHO-dominante).
  const proCandidates: SolveFoodSpec[] = [];
  if (isVegan) {
    proCandidates.push({ canonicalKey: "plant_drink_generic", name: "Yogurt di soia", noun: "yogurt di soia non zuccherato", role: "protein", macroRole: "protein", minG: 120, maxG: 350, stepG: 10, bridge: "Proteina vegetale colazione." });
    proCandidates.push({ canonicalKey: "tofu_firm", name: "Tofu", noun: "tofu", role: "protein", macroRole: "protein", minG: 80, maxG: 250, stepG: 10, bridge: "Proteina vegetale colazione (tofu)." });
  } else {
    if (!denyDairy) {
      proCandidates.push({ canonicalKey: "yogurt_plain", name: "Yogurt greco", noun: "yogurt greco", role: "protein", macroRole: "protein", minG: 100, maxG: 350, stepG: 10, bridge: "Proteina colazione (yogurt): grammi sul target proteico." });
    }
    if (!denyEgg) {
      proCandidates.push({ canonicalKey: "egg_whole", name: "Uova", noun: "uova", role: "protein", macroRole: "protein", minG: 50, maxG: 180, stepG: 25, bridge: "Proteina colazione (uova).", formatPortion: (g) => `${Math.max(1, Math.round(g / 50))} uova (≈${g} g)` });
    }
    proCandidates.push({ canonicalKey: "whey_powder", name: "Proteine whey in polvere", noun: "proteine whey in polvere", role: "protein", macroRole: "protein", minG: 15, maxG: 60, stepG: 5, bridge: "Proteina colazione (whey) per completare il target proteico." });
  }
  const proSpec = chooseLeverByCapacity(proCandidates, "p", m.proteinG, seed + 1);

  const foods: SolveFoodSpec[] = [choSpec, proSpec];

  // Seconda fonte CHO complessa solida quando il target CHO è alto (≥ 130 g): regola colazione.
  if (m.carbsG >= 130) {
    const wantOatSecondary = choSpec.canonicalKey !== "oat_dry" && oatAllowed;
    const secFixed = clampStep(40 + (m.carbsG - 130) * 0.35, 40, 110, 5);
    if (wantOatSecondary) {
      foods.push({ canonicalKey: "oat_dry", name: "Fiocchi d'avena (2ª fonte CHO)", noun: "fiocchi d'avena", role: "fixed", macroRole: "cho_heavy", minG: 20, maxG: 120, stepG: 5, fixedG: secFixed, bridge: "Seconda fonte di carboidrati complessi (target CHO ≥ 130 g)." });
    } else if (breadAllowed) {
      foods.push({ canonicalKey: "bread_white", name: "Pane integrale (2ª fonte CHO)", noun: "pane integrale tostato", role: "fixed", macroRole: "cho_heavy", minG: 20, maxG: 120, stepG: 5, fixedG: secFixed, bridge: "Seconda fonte di carboidrati complessi (target CHO ≥ 130 g)." });
    }
  }

  // Frutta fissa (CHO + fibra/micro).
  if (!denyHit(["frutta", "frutti"], deny)) {
    if (postWO && !denyHit(["banana"], deny)) {
      foods.push({ canonicalKey: "banana", name: "Banana", noun: "banana", role: "fixed", macroRole: "cho_heavy", minG: 80, maxG: 180, stepG: 10, fixedG: 120, bridge: "Frutta a colazione (CHO rapidi post-allenamento)." });
    } else {
      foods.push({ canonicalKey: "mixed_fruit", name: "Frutta fresca di stagione", noun: "frutta fresca", role: "fixed", macroRole: "cho_heavy", minG: 80, maxG: 250, stepG: 10, fixedG: 150, bridge: "Frutta a colazione (fibra, vitamine, CHO)." });
    }
  }

  // Marmellata (velo, opzionale) quando il target CHO è alto e non negata.
  if (m.carbsG >= 70 && seed % 3 === 0 && !denyHit(["marmellata", "confettura", "jam"], deny)) {
    foods.push({ canonicalKey: "jam_fruit", name: "Marmellata senza zuccheri aggiunti", noun: "marmellata", role: "fixed", macroRole: "cho_heavy", minG: 15, maxG: 40, stepG: 5, fixedG: 20, bridge: "Velo di marmellata sul pane (CHO)." });
  }

  // Grasso aggiunto solo se il target lipidico resta scoperto dalle altre fonti.
  const grams0 = solvePortionsByMacros(foods, m);
  const fatSoFar = foods.reduce((a, f, i) => a + grams0[i]! * canonMacroPerG(f.canonicalKey).f, 0);
  if (m.fatG - fatSoFar > 8 && !denyHit(["avocado"], deny)) {
    foods.push({ canonicalKey: "avocado", name: "Avocado", noun: "avocado", role: "fat", macroRole: "fat", minG: 20, maxG: 90, stepG: 5, bridge: "Grasso colazione (avocado) per completare il target lipidico." });
  }

  const grams = solvePortionsByMacros(foods, m);
  return buildMealFromSolved(foods, grams);
}

type CarbKey = "pasta" | "riso" | "patate" | "farro" | "quinoa" | "pane";
type ProtKey = "pollo" | "pesce" | "legumi" | "manzo" | "uova" | "tofu" | "tempeh" | "seitan";

/** 5 amidi complessi (pasta/riso/patate/farro/quinoa) + pane (solo cene leggere cho < 100g).
 *  Vincolo nutrizionale: a pranzo/cena con cho > 100g il pane NON e' carb principale,
 *  ma puo' comparire come carb SECONDARIO (paneFinalG) quando cho >= 130g.
 *  5 staple complessi × MAX_STAPLE_USES_PER_WEEK (3) = 15 selezioni/sett (>= 14 lunch+dinner). */
const CARB_ORDER: CarbKey[] = ["pasta", "riso", "patate", "farro", "quinoa", "pane"];
/** Omnivoro: aggiungo tofu/tempeh come variante settimanale (alternanza vegetale anche in dieta carnea). */
const PROT_ORDER: ProtKey[] = ["pollo", "pesce", "legumi", "manzo", "uova", "tofu", "tempeh"];

/** Ordini proteine per dietType: vegan/vegetarian/pescatarian estendono con plant-based, escludono famiglie animali non consentite. */
const PROT_ORDER_VEGAN: ProtKey[] = ["legumi", "tofu", "tempeh", "seitan"];
const PROT_ORDER_VEGETARIAN: ProtKey[] = ["legumi", "uova", "tofu", "tempeh"];
const PROT_ORDER_PESCATARIAN: ProtKey[] = ["pesce", "legumi", "uova", "tofu"];

type FishKind = "merluzzo" | "spigola" | "salmone";

const FISH_KINDS: FishKind[] = ["merluzzo", "spigola", "salmone"];

/** Keyword da matchare contro `denyFragments` per ogni famiglia. */
const CARB_DENY_KEYWORDS: Record<CarbKey, readonly string[]> = {
  pasta: ["pasta", "glutine", "gluten", "frumento", "wheat", "semola"],
  riso: ["riso", "rice"],
  patate: ["patate", "patata", "potato"],
  farro: ["farro", "orzo", "spelt", "barley", "glutine", "gluten"],
  quinoa: ["quinoa"],
  pane: ["pane", "bread", "glutine", "gluten", "frumento", "wheat"],
};

const PROT_DENY_KEYWORDS: Record<ProtKey, readonly string[]> = {
  pollo: ["pollo", "tacchino", "pollame", "carne"],
  pesce: ["pesce", "fish", "merluzz", "spigola", "salmone", "tonno", "ittic"],
  legumi: ["legumi", "ceci", "lenticchie", "fagioli"],
  manzo: ["manzo", "carne", "maiale", "bovino", "vitello"],
  uova: ["uov", "ovo", "egg", "album"],
  tofu: ["tofu", "soia", "soy"],
  tempeh: ["tempeh", "soia", "soy"],
  seitan: ["seitan", "glutine", "gluten"],
};

const FISH_DENY_KEYWORDS: Record<FishKind, readonly string[]> = {
  merluzzo: ["merluzz", "cod"],
  spigola: ["spigola", "branzino", "sea bass"],
  salmone: ["salmone", "salmon"],
};

function baseProtOrderForDiet(dietType: MediterraneanDietType | undefined): ProtKey[] {
  if (dietType === "vegan") return PROT_ORDER_VEGAN;
  if (dietType === "vegetarian") return PROT_ORDER_VEGETARIAN;
  if (dietType === "pescatarian") return PROT_ORDER_PESCATARIAN;
  return PROT_ORDER;
}

function allowedCarbOrder(ctx?: MediterraneanDayContext): CarbKey[] {
  const deny = ctx?.denyFragments;
  const filtered = CARB_ORDER.filter((k) => !denyHit(CARB_DENY_KEYWORDS[k], deny));
  /** Se denyFragments esclude tutto (caso limite), torna alla lista completa: il composer gestisce un pasto coerente comunque. */
  return filtered.length > 0 ? filtered : CARB_ORDER;
}

function allowedProtOrder(ctx?: MediterraneanDayContext): ProtKey[] {
  const base = baseProtOrderForDiet(ctx?.dietType);
  const deny = ctx?.denyFragments;
  const filtered = base.filter((k) => !denyHit(PROT_DENY_KEYWORDS[k], deny));
  /** Garanzia: almeno legumi (sempre vegan-safe + onnivoro) se nulla resta. */
  return filtered.length > 0 ? filtered : (base.includes("legumi") ? ["legumi"] : base);
}

function allowedFishKinds(ctx?: MediterraneanDayContext): FishKind[] {
  const deny = ctx?.denyFragments;
  const filtered = FISH_KINDS.filter((k) => !denyHit(FISH_DENY_KEYWORDS[k], deny));
  return filtered.length > 0 ? filtered : FISH_KINDS;
}

/** Densità indicative: pasta/riso/farro in g a crudo; patate e pesce cotti al consumo. */
const FISH: Record<FishKind, { labelIt: string; kcalPerG: number; protPerG: number; fatPerG: number }> = {
  merluzzo: { labelIt: "merluzzo", kcalPerG: 0.82, protPerG: 0.18, fatPerG: 0.008 },
  spigola: { labelIt: "spigola", kcalPerG: 1.22, protPerG: 0.24, fatPerG: 0.028 },
  salmone: { labelIt: "salmone", kcalPerG: 2.08, protPerG: 0.2, fatPerG: 0.13 },
};

function stapleCarb(k: CarbKey): string {
  return `carb:${k}`;
}

/** Pesce: una famiglia al giorno (no pranzo pesce + cena pesce). */
function stapleProt(protKey: ProtKey): string {
  if (protKey === "pesce") return "prot:pesce";
  return `prot:${protKey}`;
}

function weekCountFor(key: string, week?: Record<string, number>): number {
  return week?.[key] ?? 0;
}

function pickCarbKey(
  seed: number,
  offset: number,
  used: Set<string>,
  weekCounts?: Record<string, number>,
  ctx?: MediterraneanDayContext,
  /** Override del pool (es. lunch/dinner cho > 100g filtra "pane" da fonte principale). */
  carbOrderOverride?: CarbKey[],
): CarbKey {
  const order = carbOrderOverride ?? allowedCarbOrder(ctx);
  const sameDayOk = order.filter((k) => !used.has(stapleCarb(k)));
  const base = sameDayOk.length ? sameDayOk : order;
  const pool = filterWeekRotationPool(base, (k) => weekCountFor(stapleCarb(k), weekCounts));
  /**
   * Alternanza settimanale: preferisci sempre il tier di staple MENO usati nella
   * settimana. Senza questo, il composer prendeva lo stesso indice ogni giorno
   * (idx deterministico su seed) fino al cap MAX_STAPLE_USES_PER_WEEK,
   * producendo monotonia (es. riso 3gg consecutivi poi farro 3gg).
   */
  const minCount = Math.min(...pool.map((k) => weekCountFor(stapleCarb(k), weekCounts)));
  const leastUsed = pool.filter((k) => weekCountFor(stapleCarb(k), weekCounts) === minCount);
  const idx = Math.abs(seed + offset * 7) % leastUsed.length;
  let k = leastUsed[idx]!;
  if (used.has(stapleCarb(k))) {
    const esc = order.find((c) => !used.has(stapleCarb(c)));
    if (esc) k = esc;
  }
  return k;
}

function protAllowedWithCarb(carbKey: CarbKey, protKey: ProtKey): boolean {
  if (carbKey === "patate" && protKey === "legumi") return false;
  return true;
}

function pickProtAndFish(
  seed: number,
  offset: number,
  carbKey: CarbKey,
  used: Set<string>,
  weekCounts?: Record<string, number>,
  ctx?: MediterraneanDayContext,
): { protKey: ProtKey; fishKind: FishKind | null } {
  const order = allowedProtOrder(ctx);
  const sameDayOk = order.filter((pk) => protAllowedWithCarb(carbKey, pk) && !used.has(stapleProt(pk)));
  const base = sameDayOk.length ? sameDayOk : order.filter((pk) => protAllowedWithCarb(carbKey, pk));
  const pool = filterWeekRotationPool(base, (pk) => weekCountFor(stapleProt(pk), weekCounts));
  /** Alternanza settimanale: tier meno usato in settimana, tiebreak su seed (planDate-aware). */
  const minCount = Math.min(...pool.map((pk) => weekCountFor(stapleProt(pk), weekCounts)));
  const leastUsed = pool.filter((pk) => weekCountFor(stapleProt(pk), weekCounts) === minCount);
  const idx = Math.abs(seed * 3 + offset * 5) % leastUsed.length;
  let protKey = leastUsed[idx]!;

  /** Mai ripetere la stessa proteina principale nello stesso giorno: se il pool ha sbagliato, cerca una libera (rispettando dietType+denyFragments). */
  if (used.has(stapleProt(protKey))) {
    const escape = order.find((pk) => protAllowedWithCarb(carbKey, pk) && !used.has(stapleProt(pk)));
    /** Fallback: prima famiglia consentita dall'ordine, mai una bandita. */
    protKey = escape ?? order[0] ?? "legumi";
  }

  if (protKey === "pesce") {
    const fishOrder = allowedFishKinds(ctx);
    const fishKind = fishOrder[(seed + offset * 11 + idx * 3) % fishOrder.length]!;
    return { protKey, fishKind };
  }
  return { protKey, fishKind: null };
}

type MainVegSpec = { canonicalKey: string; name: string; noun: string };

/** Rotazione contorno pranzo/cena: verdure distinte invece del solo proxy `mixed_veg`. */
const MAIN_VEG_POOL: MainVegSpec[] = [
  { canonicalKey: "mixed_veg", name: "Contorno verdure", noun: "verdure miste (crude o cotte)" },
  { canonicalKey: "spinach_raw", name: "Spinaci", noun: "spinaci freschi o saltati" },
  { canonicalKey: "broccoli_raw", name: "Broccoli", noun: "broccoli al vapore o saltati" },
  { canonicalKey: "zucchini_raw", name: "Zucchine", noun: "zucchine grigliate o saltate" },
  { canonicalKey: "bell_pepper_red", name: "Peperoni", noun: "peperoni crudi o grigliati" },
  { canonicalKey: "carrot_raw", name: "Carote", noun: "carote crude o al vapore" },
  { canonicalKey: "tomato_raw", name: "Pomodori", noun: "pomodori freschi" },
  { canonicalKey: "asparagus_raw", name: "Asparagi", noun: "asparagi al vapore" },
  { canonicalKey: "arugula_raw", name: "Rucola", noun: "rucola e insalata verde" },
  { canonicalKey: "lettuce_romaine", name: "Insalata romana", noun: "lattuga romana" },
];

function pickMainVegSpec(seed: number, offset: number, deny?: readonly string[]): MainVegSpec {
  const pool = MAIN_VEG_POOL.filter((v) => {
    if (!deny?.length) return true;
    return !denyHit([v.name.toLowerCase(), v.noun.toLowerCase(), v.canonicalKey.replace(/_/g, " ")], deny);
  });
  const use = pool.length > 0 ? pool : MAIN_VEG_POOL;
  return use[Math.abs(seed + offset * 3) % use.length]!;
}

/** Verdure per pasto principale: max 2, chiavi distinte, mai già usate oggi. */
function pickMainVegSpecsForSlot(
  seed: number,
  offset: number,
  deny?: readonly string[],
  ctx?: MediterraneanDayContext,
): MainVegSpec[] {
  const denyFiltered = MAIN_VEG_POOL.filter((v) => {
    if (!deny?.length) return true;
    return !denyHit([v.name.toLowerCase(), v.noun.toLowerCase(), v.canonicalKey.replace(/_/g, " ")], deny);
  });
  const dayFresh = filterByDayRotation(denyFiltered, ctx);
  const pool = dayFresh.length > 0 ? dayFresh : denyFiltered;
  const start = Math.abs(seed + offset * 3) % pool.length;
  const picks: MainVegSpec[] = [];
  for (let j = 0; j < pool.length && picks.length < 2; j++) {
    const v = pool[(start + j) % pool.length]!;
    if (picks.some((p) => p.canonicalKey === v.canonicalKey)) continue;
    if (ctx?.dayUsedCanonicalKeys?.size && !canUseCanonicalKey(ctx, v.canonicalKey)) continue;
    picks.push(v);
  }
  return picks.length > 0 ? picks : denyFiltered.slice(0, 2);
}

function composeMainMeal(
  slot: MealSlotKey,
  m: MealMacroTargets,
  seed: number,
  ctx?: MediterraneanDayContext,
): MediterraneanComposedMeal {
  const K = Math.max(350, m.kcal);
  const P = Math.max(25, m.proteinG);
  const F = Math.max(10, m.fatG);

  const offset = slot === "dinner" ? 2 : 0;
  const used = ctx?.usedStaples;
  let carbKey: CarbKey;
  let protKey: ProtKey;
  let fishKind: FishKind | null = null;

  const weekCounts = ctx?.weekStapleCounts;

  /**
   * REGOLA COMPOSIZIONE (regola utente nutrizionista):
   * - A pranzo/cena con CHO > 100g il pane NON puo' essere il carboidrato
   *   principale: serve un amido complesso (pasta/riso/farro/quinoa/patate).
   *   Il pane puo' comparire come carb SECONDARIO (paneFinalG) quando il
   *   target supera i 130g di CHO e richiede una seconda fonte.
   * - "Pane" come carb principale resta ammesso per cene molto leggere
   *   (CHO < 100g) o snack: dieta mediterranea pratica.
   */
  let carbOrder = allowedCarbOrder(ctx);
  if ((slot === "lunch" || slot === "dinner") && m.carbsG > 100) {
    carbOrder = carbOrder.filter((k) => k !== "pane");
    /** Se il filtro svuota la lista (caso limite: dieta gluten-free senza riso/quinoa nel pool),
     *  ripristina almeno il carb gluten-free piu' frequente (riso o quinoa). */
    if (carbOrder.length === 0) {
      carbOrder = ["riso", "quinoa"].filter((k) => allowedCarbOrder(ctx).includes(k as CarbKey)) as CarbKey[];
    }
  }
  const protOrder = allowedProtOrder(ctx);
  const fishOrder = allowedFishKinds(ctx);

  if (used && (slot === "lunch" || slot === "dinner")) {
    carbKey = pickCarbKey(seed, offset, used, weekCounts, ctx, carbOrder);
    const picked = pickProtAndFish(seed, offset, carbKey, used, weekCounts, ctx);
    protKey = picked.protKey;
    fishKind = picked.fishKind;
  } else {
    carbKey = carbOrder[(seed + offset) % carbOrder.length] ?? "pasta";
    protKey = protOrder[(seed * 3 + offset) % protOrder.length] ?? (protOrder[0] ?? "legumi");
    /** Patate+legumi sbilancia il pasto su CHO+CHO ad alto volume: in onnivoro risolvi su pollo, in vegan/vegetariano pivota a tofu/uova. */
    if (carbKey === "patate" && protKey === "legumi") {
      const fallback = protOrder.find((p) => p !== "legumi") ?? "legumi";
      protKey = fallback;
    }
    fishKind = protKey === "pesce" ? (fishOrder[(seed + offset * 2) % fishOrder.length] ?? null) : null;
  }

  const postWorkout = Boolean(ctx?.postWorkoutMealBySlot?.[slot]);
  if (postWorkout && (slot === "lunch" || slot === "dinner") && used) {
    if (carbKey === "pasta" || carbKey === "farro") {
      const canRiso =
        carbOrder.includes("riso") &&
        !used.has(stapleCarb("riso")) &&
        weekCountFor(stapleCarb("riso"), weekCounts) < ROTATION_MAX_WEEK_USES;
      const canPatate =
        carbOrder.includes("patate") &&
        !used.has(stapleCarb("patate")) &&
        weekCountFor(stapleCarb("patate"), weekCounts) < ROTATION_MAX_WEEK_USES;
      if (canRiso && (seed % 2 !== 0 || !canPatate)) {
        carbKey = "riso";
      } else if (canPatate) {
        carbKey = "patate";
      } else if (canRiso) {
        carbKey = "riso";
      }
    }
    /** Risoluzioni post-WO che NON violano dietType: si scelgono solo proteine consentite. */
    if (carbKey === "patate" && protKey === "legumi") {
      const swap = protOrder.find((p) => p !== "legumi" && !used.has(stapleProt(p)));
      if (swap) {
        protKey = swap;
        fishKind = swap === "pesce" ? (fishOrder[(seed + offset * 2) % fishOrder.length] ?? null) : null;
      }
    } else if (protKey === "legumi" && protOrder.length > 1) {
      const swap = protOrder.find((p) => p !== "legumi" && !used.has(stapleProt(p)));
      if (swap) {
        protKey = swap;
        fishKind = swap === "pesce" ? (fishOrder[(seed + offset * 2) % fishOrder.length] ?? null) : null;
      }
    }
  }

  // --- Mappa la selezione (famiglia carbo/proteina già scelta sopra) sulla banca canonica ---
  const carbSpecBy: Record<CarbKey, { key: string; name: string; noun: string; min: number; max: number; step: number }> = {
    pasta: { key: "pasta_dry", name: "Pasta di semola", noun: "pasta di semola (peso crudo), condimento a parte", min: 50, max: 170, step: 5 },
    riso: { key: "rice_dry", name: "Riso", noun: "riso (peso crudo)", min: 45, max: 160, step: 5 },
    patate: { key: "potato_cooked", name: "Patate", noun: "patate lesse o al forno", min: 150, max: 550, step: 10 },
    farro: { key: "farro_dry", name: "Farro/orzo", noun: "farro o orzo (peso crudo)", min: 45, max: 150, step: 5 },
    quinoa: { key: "quinoa_dry", name: "Quinoa", noun: "quinoa (peso crudo)", min: 45, max: 140, step: 5 },
    pane: { key: "bread_white", name: "Pane integrale (carb principale)", noun: "pane integrale o pita", min: 60, max: 220, step: 5 },
  };
  const cs = carbSpecBy[carbKey];
  const carbSpec: SolveFoodSpec = {
    canonicalKey: cs.key,
    name: cs.name,
    noun: cs.noun,
    role: "cho",
    macroRole: "cho_heavy",
    minG: cs.min,
    maxG: cs.max,
    stepG: cs.step,
    bridge: "Un solo carboidrato complesso principale; grammi calcolati sul target CHO del pasto.",
  };

  const protSpec: SolveFoodSpec = (() => {
    switch (protKey) {
      case "pollo":
        return { canonicalKey: "chicken_breast", name: "Proteina: pollo/tacchino", noun: "petto di pollo o tacchino", role: "protein", macroRole: "protein", minG: 80, maxG: 300, stepG: 5, bridge: "Proteina magra; grammi sul target proteico del pasto." };
      case "pesce": {
        const fl = fishKind ? FISH[fishKind].labelIt : "pesce";
        const cap = fl.charAt(0).toUpperCase() + fl.slice(1);
        return { canonicalKey: "fish_white", name: `Proteina: ${cap}`, noun: `${fl} (peso netto)`, role: "protein", macroRole: "protein", minG: 90, maxG: 320, stepG: 5, bridge: "Proteina dal pesce; grammi sul target proteico." };
      }
      case "legumi":
        return { canonicalKey: "legumes_cooked", name: "Proteina vegetale: legumi", noun: "legumi cotti (ceci, lenticchie, fagioli)", role: "protein", macroRole: "protein", minG: 120, maxG: 400, stepG: 10, bridge: "Proteina vegetale; grammi sul target proteico." };
      case "manzo":
        return { canonicalKey: "beef_lean", name: "Proteina: carne magra", noun: "carne magra (manzo/maiale magro)", role: "protein", macroRole: "protein", minG: 80, maxG: 280, stepG: 5, bridge: "Proteina; grammi sul target proteico." };
      case "uova":
        return { canonicalKey: "egg_whole", name: "Proteina: uova", noun: "uova", role: "protein", macroRole: "protein", minG: 100, maxG: 200, stepG: 25, bridge: "Proteina dalle uova; grammi sul target proteico.", formatPortion: (g) => `${Math.max(2, Math.round(g / 50))} uova (≈${g} g, frittata/strapazzate)` };
      case "tofu":
        return { canonicalKey: "tofu_firm", name: "Proteina vegetale: tofu", noun: "tofu compatto (saltato o al forno)", role: "protein", macroRole: "protein", minG: 100, maxG: 320, stepG: 10, bridge: "Proteina vegetale; grammi sul target proteico." };
      case "tempeh":
        return { canonicalKey: "tempeh", name: "Proteina vegetale: tempeh", noun: "tempeh (a fette)", role: "protein", macroRole: "protein", minG: 90, maxG: 250, stepG: 10, bridge: "Proteina vegetale; grammi sul target proteico." };
      case "seitan":
        return { canonicalKey: "seitan", name: "Proteina vegetale: seitan", noun: "seitan (a fette)", role: "protein", macroRole: "protein", minG: 80, maxG: 250, stepG: 5, bridge: "Proteina vegetale; grammi sul target proteico." };
      default:
        return { canonicalKey: "chicken_breast", name: "Proteina: pollo/tacchino", noun: "petto di pollo", role: "protein", macroRole: "protein", minG: 80, maxG: 300, stepG: 5, bridge: "Proteina magra." };
    }
  })();

  const foods: SolveFoodSpec[] = [carbSpec, protSpec];

  const mainVegs = pickMainVegSpecsForSlot(seed, offset, ctx?.denyFragments, ctx).slice(0, 2);
  for (const [idx, veg] of mainVegs.entries()) {
    foods.push({
      canonicalKey: veg.canonicalKey,
      name: `Verdura: ${veg.name}`,
      noun: veg.noun,
      role: "fixed",
      macroRole: "veg",
      minG: 100,
      maxG: 280,
      stepG: 10,
      fixedG: clampStep(140 + (seed % 3) * 20 + idx * 15, 120, 220, 10),
      bridge: "Fonte fibre e micronutrienti (max 2 verdure per pasto); condisci con olio EVO.",
    });
  }

  // Pane SECONDARIO (2ª fonte CHO) solo se target CHO alto e carb principale non è pane.
  if (carbKey !== "pane" && m.carbsG >= 130) {
    const paneFixed = m.carbsG >= 180 ? clampStep(80 + (seed % 3) * 12, 70, 110, 5) : clampStep(45 + (seed % 3) * 8, 40, 80, 5);
    foods.push({
      canonicalKey: "bread_white",
      name: "Pane integrale (2ª fonte CHO)",
      noun: "pane integrale",
      role: "fixed",
      macroRole: "cho_heavy",
      minG: 30,
      maxG: 110,
      stepG: 5,
      fixedG: paneFixed,
      bridge: "Seconda fonte di carboidrati richiesta dal target (CHO ≥ 130 g): il carb principale resta quello complesso.",
    });
  }

  // Grana/formaggio: solo se non vegan e non deny lattosio, con rotazione.
  const cheeseAllowed =
    ctx?.dietType !== "vegan" &&
    !denyHit(["latte", "lattosio", "latticino", "formaggio", "grana", "parmigiano"], ctx?.denyFragments);
  if (cheeseAllowed && seed % 5 === 0 && (!ctx?.dayUsedCanonicalKeys?.size || canUseCanonicalKey(ctx, "cheese_hard"))) {
    foods.push({
      canonicalKey: "cheese_hard",
      name: "Grana / formaggio stagionato",
      noun: "grana o formaggio stagionato",
      role: "fixed",
      macroRole: "fat",
      minG: 15,
      maxG: 40,
      stepG: 5,
      fixedG: clampStep(15 + (seed % 3) * 6, 15, 35, 5),
      bridge: "Sapore + proteine/grassi; quota del pasto.",
    });
  }

  // Olio EVO: leva grassi (pranzo/cena, a crudo) — max 1 volta al giorno.
  if (!ctx?.dayUsedCanonicalKeys?.size || canUseCanonicalKey(ctx, "olive_oil")) {
    foods.push({
      canonicalKey: "olive_oil",
      name: "Olio extravergine d'oliva",
      noun: "olio extravergine d'oliva (a crudo)",
      role: "fat",
      macroRole: "fat",
      minG: 5,
      maxG: 35,
      stepG: 1,
      bridge: "Grassi insaturi; grammi sul target lipidico del pasto.",
    });
  } else {
    const altFat = filterByDayRotation(
      [
        { canonicalKey: "avocado", name: "Avocado", noun: "avocado", role: "fat" as const, macroRole: "fat" as const, minG: 20, maxG: 80, stepG: 5, bridge: "Grasso alternativo se olio già usato oggi." },
        { canonicalKey: "almonds_raw", name: "Mandorle", noun: "mandorle", role: "fat" as const, macroRole: "fat" as const, minG: 15, maxG: 40, stepG: 5, bridge: "Grasso alternativo (frutta secca)." },
      ],
      ctx,
    );
    if (altFat.length > 0) foods.push(altFat[0]!);
  }

  const grams = solvePortionsByMacros(foods, { kcal: K, carbsG: m.carbsG, proteinG: P, fatG: F });
  const composed = buildMealFromSolved(foods, grams);

  // Omega-3 opzionale (target grassi alto, sporadico): integrazione, non sostituisce alimenti interi.
  if (m.fatG > 22 && seed % 4 === 1) {
    composed.items.push(
      item(
        "Omega (integrazione)",
        "Se serve: 1 capsula omega 3 (EPA/DHA) lontano dai pasti o come da protocollo",
        15,
        "fat",
        "Complemento lipidi essenziali se il pesce è sporadico; non sostituisce olio e alimenti interi.",
      ),
    );
    composed.lines.push("Opzionale: omega-3 EPA/DHA (integrazione se concordata)");
    composed.totalApproxKcal += 15;
  }

  if (used && (slot === "lunch" || slot === "dinner")) {
    used.add(stapleCarb(carbKey));
    used.add(stapleProt(protKey));
  }

  return composed;
}

function composeSnack(
  m: MealMacroTargets,
  seed: number,
  variant: "snack_am" | "snack_pm",
  ctx?: MediterraneanDayContext,
): MediterraneanComposedMeal {
  const K = Math.max(120, m.kcal);
  /** Spuntino mattutino tendenzialmente più “dolce”; pomeridiano più salato (con piccola rotazione). */
  let sweet = variant === "snack_am";
  if (seed % 7 === 0) sweet = !sweet;
  /** Dopo ricalibrazione orari (es. post-seduta): spuntino più CHO, senza variante salata pesante. */
  const postSlot = Boolean(ctx?.postWorkoutMealBySlot?.[variant]);
  if (postSlot) sweet = true;

  const isVegan = ctx?.dietType === "vegan";
  const isVegetarian = ctx?.dietType === "vegetarian";
  const denyMeat = denyHit(["carne", "pollo", "tacchino", "manzo", "maiale", "bresaola", "prosciutto", "salame", "salsicc"], ctx?.denyFragments);
  /** Affettato fuori se vegan/vegetarian o deny carne: forziamo variante dolce con yogurt vegetale. */
  if (isVegan || isVegetarian || denyMeat) sweet = true;

  const denyDairy = denyHit(["latte", "lattosio", "latticino", "yogurt"], ctx?.denyFragments);
  const skipDairyYogurt = isVegan || denyDairy;

  const deny = ctx?.denyFragments;
  const foods: SolveFoodSpec[] = [];

  if (sweet) {
    const choCandidates = filterByDayRotation(
      [
        { canonicalKey: "oat_dry", name: "Cereali / muesli", noun: "cereali o muesli (sul yogurt)", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 15, maxG: 80, stepG: 5, bridge: postSlot ? "Spuntino post-rientro: più cereali sul target CHO (refeed leggero)." : "Carboidrati spuntino; grammi sul target CHO." },
        { canonicalKey: "crackers_whole", name: "Gallette integrali", noun: "gallette integrali", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 15, maxG: 80, stepG: 5, bridge: "Base croccante spuntino; grammi sul target CHO." },
        { canonicalKey: "banana", name: "Banana", noun: "banana", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 60, maxG: 150, stepG: 10, bridge: "CHO rapidi spuntino." },
        { canonicalKey: "bread_white", name: "Pane tostato", noun: "pane integrale tostato", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 20, maxG: 80, stepG: 5, bridge: "CHO spuntino alternativo." },
      ],
      ctx,
    );
    if (choCandidates.length > 0) {
      foods.push(chooseLeverByCapacity(choCandidates, "c", m.carbsG, seed));
    }

    const proPool: SolveFoodSpec[] = skipDairyYogurt
      ? [
          { canonicalKey: "plant_drink_generic", name: "Yogurt vegetale", noun: "yogurt vegetale (soia/cocco) non zuccherato", role: "protein", macroRole: "protein", minG: 100, maxG: 300, stepG: 10, bridge: "Proteina spuntino (yogurt vegetale); grammi sul target proteico." },
          { canonicalKey: "tofu_firm", name: "Tofu", noun: "tofu", role: "protein", macroRole: "protein", minG: 60, maxG: 180, stepG: 10, bridge: "Proteina vegetale spuntino." },
        ]
      : [
          { canonicalKey: "yogurt_plain", name: "Yogurt", noun: "yogurt", role: "protein", macroRole: "protein", minG: 100, maxG: 300, stepG: 10, bridge: "Proteina spuntino (yogurt); grammi sul target proteico." },
          { canonicalKey: "egg_whole", name: "Uova", noun: "uova", role: "protein", macroRole: "protein", minG: 50, maxG: 120, stepG: 25, bridge: "Proteina spuntino (uova).", formatPortion: (g: number) => `${Math.max(1, Math.round(g / 50))} uova (≈${g} g)` },
          { canonicalKey: "whey_powder", name: "Proteine whey", noun: "proteine whey in polvere", role: "protein", macroRole: "protein", minG: 15, maxG: 45, stepG: 5, bridge: "Proteina spuntino (whey) se altre fonti già usate oggi." },
        ];
    const proCandidates = filterByDayRotation(proPool, ctx);
    if (proCandidates.length > 0) {
      foods.push(chooseLeverByCapacity(proCandidates, "p", m.proteinG, seed + 1));
    }

    if (!denyHit(["frutta", "frutti"], deny)) {
      const fruitCandidates = filterByDayRotation(
        [
          { canonicalKey: "mixed_fruit", name: "Frutta", noun: "frutta fresca o frutti di bosco", role: "fixed" as const, macroRole: "cho_heavy" as const, minG: 60, maxG: 200, stepG: 10, fixedG: postSlot ? 120 : 90, bridge: "CHO e fibre." },
          { canonicalKey: "kiwi_raw", name: "Kiwi", noun: "kiwi", role: "fixed" as const, macroRole: "cho_heavy" as const, minG: 60, maxG: 150, stepG: 10, fixedG: postSlot ? 120 : 90, bridge: "CHO e vitamina C." },
          { canonicalKey: "orange_raw", name: "Arancia", noun: "arancia", role: "fixed" as const, macroRole: "cho_heavy" as const, minG: 80, maxG: 180, stepG: 10, fixedG: postSlot ? 130 : 100, bridge: "CHO e vitamina C." },
          { canonicalKey: "strawberries_raw", name: "Fragole", noun: "fragole", role: "fixed" as const, macroRole: "cho_heavy" as const, minG: 60, maxG: 150, stepG: 10, fixedG: 90, bridge: "CHO e fibre." },
        ],
        ctx,
      );
      if (fruitCandidates.length > 0) foods.push(fruitCandidates[Math.abs(seed) % fruitCandidates.length]!);
    }
  } else {
    const choCandidates = filterByDayRotation(
      [
        { canonicalKey: "crackers_whole", name: "Gallette / pane tostato", noun: "gallette integrali o pane tostato", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 15, maxG: 80, stepG: 5, bridge: "Base croccante; grammi sul target CHO." },
        { canonicalKey: "bread_white", name: "Pane tostato", noun: "pane integrale tostato", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 20, maxG: 80, stepG: 5, bridge: "Base croccante; grammi sul target CHO." },
      ],
      ctx,
    );
    if (choCandidates.length > 0) {
      foods.push(chooseLeverByCapacity(choCandidates, "c", m.carbsG, seed));
    }
    const proCandidates = filterByDayRotation(
      [{ canonicalKey: "deli_lean", name: "Affettato magro", noun: "bresaola o prosciutto cotto magro", role: "protein" as const, macroRole: "protein" as const, minG: 30, maxG: 120, stepG: 5, bridge: postSlot ? "Proteina magra (variante meno grassa dopo spostamento orari); grammi sul target proteico." : "Proteina magra spuntino salato; grammi sul target proteico." }],
      ctx,
    );
    if (proCandidates.length > 0) {
      foods.push(chooseLeverByCapacity(proCandidates, "p", m.proteinG, seed + 1));
    }
    const cheeseAllowed = !denyHit(["latte", "lattosio", "latticino", "formaggio", "grana", "parmigiano"], deny);
    const fatCandidates = filterByDayRotation(
      seed % 2 === 0 || !cheeseAllowed
        ? [{ canonicalKey: "avocado", name: "Grasso spuntino (avocado)", noun: "avocado", role: "fat" as const, macroRole: "fat" as const, minG: 15, maxG: 80, stepG: 5, bridge: "Una sola fonte di grasso aggiunto; grammi sul target lipidico." }]
        : [{ canonicalKey: "cheese_hard", name: "Grasso spuntino (grana)", noun: "grana grattugiato", role: "fat" as const, macroRole: "fat" as const, minG: 10, maxG: 40, stepG: 5, bridge: "Una sola fonte di grasso aggiunto; grammi sul target lipidico." }],
      ctx,
    );
    if (fatCandidates.length > 0) foods.push(fatCandidates[0]!);
  }

  if (foods.length === 0) {
    const emergency = filterByDayRotation(
      [
        { canonicalKey: "crackers_whole", name: "Gallette integrali", noun: "gallette integrali", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 20, maxG: 60, stepG: 5, bridge: "Spuntino minimo (CHO)." },
        { canonicalKey: "mixed_fruit", name: "Frutta", noun: "frutta fresca", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 80, maxG: 150, stepG: 10, bridge: "Spuntino minimo (frutta)." },
        { canonicalKey: "plant_drink_generic", name: "Bevanda vegetale", noun: "bevanda vegetale", role: "cho" as const, macroRole: "cho_heavy" as const, minG: 150, maxG: 250, stepG: 10, bridge: "Spuntino minimo (vegan)." },
      ],
      ctx,
    );
    if (emergency.length > 0) foods.push(emergency[0]!);
  }
  if (!foods.some((f) => f && f.role === "protein")) {
    const proEmergency = filterByDayRotation(
      [
        { canonicalKey: "whey_powder", name: "Proteine whey", noun: "proteine whey in polvere", role: "protein" as const, macroRole: "protein" as const, minG: 15, maxG: 40, stepG: 5, bridge: "Proteina spuntino di riserva." },
        { canonicalKey: "yogurt_plain", name: "Yogurt", noun: "yogurt", role: "protein" as const, macroRole: "protein" as const, minG: 100, maxG: 200, stepG: 10, bridge: "Proteina spuntino di riserva." },
        { canonicalKey: "tofu_firm", name: "Tofu", noun: "tofu", role: "protein" as const, macroRole: "protein" as const, minG: 60, maxG: 150, stepG: 10, bridge: "Proteina vegetale spuntino di riserva." },
      ],
      ctx,
    );
    if (proEmergency.length > 0) foods.push(proEmergency[0]!);
  }

  const safeFoods = foods.filter((f): f is SolveFoodSpec => Boolean(f));
  const grams = solvePortionsByMacros(safeFoods, { kcal: K, carbsG: m.carbsG, proteinG: m.proteinG, fatG: m.fatG });
  const composed = buildMealFromSolved(safeFoods, grams);
  if (ctx) {
    appendProteinShakeLiquidIfNeeded(ctx, seed, composed.items, composed.lines);
    composed.totalApproxKcal = composed.items.reduce((a, i) => a + i.approxKcal, 0);
  }
  return composed;
}

/**
 * Placeholder per slot snack soppresso da long-ride / lungo training: la finestra carburante in seduta
 * è gestita dal modulo `Fueling` (gel, sport drink, elettroliti). Manteniamo lo slot nel piano per non
 * sballare la simmetria UI (5 card), ma con kcal contenute (coperte effettivamente dalla seduta) e
 * `compositionStatus` non risolto (no contributo al rollup nutrienti).
 */
function composeInRideFuelingPlaceholder(
  slot: MealSlotKey,
  macros: MealMacroTargets,
): MediterraneanComposedMeal {
  /** Quota minima visiva (≤ 60 kcal): hint operativo, non un pasto. */
  const placeholderKcal = Math.min(60, Math.max(15, Math.round(macros.kcal * 0.05)));
  const item: IntelligentMealPlanItemOut = {
    name: "In-ride fueling (vedi Fueling)",
    portionHint: "Carburante in seduta: gel/sport drink + idratazione, elettroliti come da modulo Fueling",
    approxKcal: placeholderKcal,
    macroRole: "cho_heavy",
    functionalBridge:
      "Slot soppresso: cade dentro la finestra di allenamento. Il rifornimento avviene in seduta (gel + sport drink + sale) ed è dimensionato in `Fueling` su durata/intensità — non si raddoppia con uno spuntino convenzionale.",
  };
  return {
    items: [item],
    lines: [`Spuntino convenzionale soppresso (${slot}): finestra di allenamento — usa il piano Fueling.`],
    totalApproxKcal: placeholderKcal,
  };
}

/** Piano mediterraneo: porzioni e kcal coerenti con il target dello slot. */
export function composeMediterraneanMeal(
  slot: MealSlotKey,
  macros: MealMacroTargets,
  ctx?: MediterraneanDayContext,
): MediterraneanComposedMeal {
  /** Slot soppressi (snack durante long ride): placeholder che rimanda al modulo Fueling. */
  if (ctx?.suppressedSlots && ctx.suppressedSlots.includes(slot)) {
    return composeInRideFuelingPlaceholder(slot, macros);
  }
  const seed = hashSeed(slot, macros.kcal, ctx?.planDate);
  const breakfastCtx = ctx ?? createMediterraneanDayContext("");
  if (slot === "breakfast") return composeBreakfastWithArchetypes(macros, seed, breakfastCtx);
  if (slot === "snack_am") return composeSnack(macros, seed, "snack_am", ctx);
  if (slot === "snack_pm" || slot === "snack_evening") {
    return composeSnack(macros, seed, "snack_pm", ctx);
  }
  if (ctx?.racePreLunch && slot === ctx.racePreLunch.mealSlot) {
    return composeRacePreLunchMainMeal(slot, macros, seed, ctx.racePreLunch, ctx);
  }
  if (ctx?.racePostRecovery && slot === ctx.racePostRecovery.mealSlot) {
    return composeRacePostRecoveryMeal(slot, seed, ctx.racePostRecovery, ctx);
  }
  return composeMainMeal(slot, macros, seed, ctx);
}

export { applyNutrientBoostSwaps } from "@/lib/nutrition/meal-pathway-advisor";
