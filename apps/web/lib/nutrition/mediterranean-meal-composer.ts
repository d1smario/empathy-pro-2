/**
 * Composizione deterministica “piano alimentare” stile mediterraneo:
 * per slot si fissano target kcal/macro (dal solver), poi si compone il pasto con
 * una fonte principale di CHO, una di proteine, grassi (olio / formaggio), fibre (verdura),
 * eventuale pane — porzioni iterate su densità indicative; nessuna ripartizione uniforme
 * delle kcal sul numero di voci (le kcal per riga restano legate alle quantità stimati).
 */

import type { IntelligentMealPlanItemOut, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { RacePreLunchDayContext } from "@/lib/nutrition/race-day-pre-race-lunch";
import { composeRacePreLunchMainMeal } from "@/lib/nutrition/race-day-pre-race-lunch";
import { composeBreakfastWithArchetypes } from "@/lib/nutrition/breakfast-meal-archetypes";

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
};

/** Max utilizzi/settimana per stesso amido o stessa famiglia proteica principale (latte/olio/ zucchero non sono in questa lista). */
const MAX_STAPLE_USES_PER_WEEK = 3;

export function createMediterraneanDayContext(
  planDate: string,
  weekStapleCounts?: Record<string, number>,
  postWorkoutMealBySlot?: Partial<Record<MealSlotKey, boolean>>,
  dietType?: MediterraneanDietType,
  denyFragments?: string[],
  suppressedSlots?: MealSlotKey[],
  racePreLunch?: RacePreLunchDayContext,
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
  };
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

/** kcal e macro approssimati (ordine di grandezza educativo, non laboratorio). */
const D = {
  milkKcalPerMl: 0.64,
  milkProtPerMl: 0.032,
  milkChoPerMl: 0.048,
  milkFatPerMl: 0.036,
  cerealKcalPerG: 3.65,
  cerealChoPerG: 0.73,
  cerealProtPerG: 0.11,
  berryKcalPerG: 0.52,
  berryChoPerG: 0.12,
  bananaKcal: 95,
  bananaCho: 24,
  bananaProt: 1.2,
  yogurtKcalPerG: 0.72,
  yogurtProtPerG: 0.085,
  yogurtChoPerG: 0.045,
  yogurtFatPerG: 0.038,
  wheyKcalPerG: 4.0,
  wheyProtPerG: 0.8,
  wheyChoPerG: 0.06,
  pastaDryKcalPerG: 3.71,
  pastaDryChoPerG: 0.75,
  pastaDryProtPerG: 0.13,
  riceDryKcalPerG: 3.65,
  riceDryChoPerG: 0.8,
  riceDryProtPerG: 0.071,
  potatoCookedKcalPerG: 0.9,
  potatoCookedChoPerG: 0.2,
  farroDryKcalPerG: 3.38,
  farroDryChoPerG: 0.7,
  farroDryProtPerG: 0.14,
  chickenKcalPerG: 1.65,
  chickenProtPerG: 0.31,
  fishKcalPerG: 1.55,
  fishProtPerG: 0.28,
  meatKcalPerG: 1.85,
  meatProtPerG: 0.26,
  legumeKcalPerG: 1.15,
  legumeProtPerG: 0.09,
  legumeChoPerG: 0.15,
  eggKcalEach: 78,
  eggProtEach: 6.3,
  vegKcalPerG: 0.35,
  vegChoPerG: 0.05,
  oilKcalPerMl: 9.0,
  oilFatPerMl: 1.0,
  breadKcalPerG: 2.7,
  breadChoPerG: 0.52,
  focacciaKcalPerG: 3.0,
  granaKcalPerG: 4.0,
  granaProtPerG: 0.32,
  granaFatPerG: 0.28,
  avocadoKcalPerG: 1.6,
  avocadoFatPerG: 0.15,
  crackerKcalPerG: 4.2,
  crackerChoPerG: 0.68,
};

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


function composeBreakfast(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  return composeBreakfastWithArchetypes(m, seed, ctx);
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
  const weekOk = base.filter((k) => weekCountFor(stapleCarb(k), weekCounts) < MAX_STAPLE_USES_PER_WEEK);
  const pool = weekOk.length ? weekOk : base;
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
  const weekOk = base.filter((pk) => weekCountFor(stapleProt(pk), weekCounts) < MAX_STAPLE_USES_PER_WEEK);
  const pool = weekOk.length ? weekOk : base;
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

function carbLine(key: CarbKey, g: number): { line: string; kcal: number; cho: number; prot: number; fat: number } {
  switch (key) {
    case "pasta": {
      const gc = clampStep(g, 45, 140);
      return {
        line: `${gc} g pasta secca (peso a crudo), condimento a parte`,
        kcal: gc * D.pastaDryKcalPerG,
        cho: gc * D.pastaDryChoPerG,
        prot: gc * D.pastaDryProtPerG,
        fat: gc * 0.015,
      };
    }
    case "riso": {
      const gc = clampStep(g, 40, 120);
      return {
        line: `${gc} g riso (peso a crudo)`,
        kcal: gc * D.riceDryKcalPerG,
        cho: gc * D.riceDryChoPerG,
        prot: gc * D.riceDryProtPerG,
        fat: gc * 0.006,
      };
    }
    case "patate": {
      const gc = clampStep(g, 80, 320);
      return {
        line: `${gc} g patate (cotte al forno/bollite)`,
        kcal: gc * D.potatoCookedKcalPerG,
        cho: gc * D.potatoCookedChoPerG,
        prot: gc * 0.02,
        fat: gc * 0.01,
      };
    }
    case "farro": {
      const gc = clampStep(g, 45, 130);
      return {
        line: `${gc} g farro o orzo (peso a crudo/secco)`,
        kcal: gc * D.farroDryKcalPerG,
        cho: gc * D.farroDryChoPerG,
        prot: gc * D.farroDryProtPerG,
        fat: gc * 0.022,
      };
    }
    case "quinoa": {
      /** Quinoa (USDA-like ~368 kcal/100g a crudo, alto valore biologico). */
      const gc = clampStep(g, 50, 120);
      return {
        line: `${gc} g quinoa (peso a crudo)`,
        kcal: gc * 3.68,
        cho: gc * 0.64,
        prot: gc * 0.14,
        fat: gc * 0.06,
      };
    }
    case "pane": {
      /** Pane come amido principale (sandwich/bruschetta/pita): porzione ~140-220 g. */
      const gc = clampStep(g, 120, 240);
      return {
        line: `${gc} g pane integrale o pita (porzione principale del pasto)`,
        kcal: gc * D.breadKcalPerG,
        cho: gc * D.breadChoPerG,
        /** Pane integrale ~8.5 g prot/100 g (D non espone breadProtPerG, valore inline). */
        prot: gc * 0.085,
        fat: gc * 0.025,
      };
    }
    default:
      return carbLine("pasta", g);
  }
}

function protLine(
  key: ProtKey,
  g: number,
  eggs: number,
  fishKind: FishKind | null,
): { line: string; kcal: number; cho: number; prot: number; fat: number } {
  switch (key) {
    case "pollo": {
      const gc = clampStep(g, 100, 240);
      return {
        line: `${gc} g petto di pollo o tacchino`,
        kcal: gc * D.chickenKcalPerG,
        cho: gc * 0.01,
        prot: gc * D.chickenProtPerG,
        fat: gc * 0.04,
      };
    }
    case "pesce": {
      const fk = fishKind ?? "merluzzo";
      const spec = FISH[fk];
      const gc = clampStep(g, 85, 280);
      return {
        line: `${gc} g ${spec.labelIt} (peso netto cotto)`,
        kcal: gc * spec.kcalPerG,
        cho: 0,
        prot: gc * spec.protPerG,
        fat: gc * spec.fatPerG,
      };
    }
    case "legumi": {
      const gc = clampStep(g, 120, 220);
      return {
        line: `${gc} g legumi cotti (ceci, lenticchie, fagioli)`,
        kcal: gc * D.legumeKcalPerG,
        cho: gc * D.legumeChoPerG,
        prot: gc * D.legumeProtPerG,
        fat: gc * 0.02,
      };
    }
    case "manzo": {
      const gc = clampStep(g, 100, 220);
      return {
        line: `${gc} g carne magra (manzo/maiale magro)`,
        kcal: gc * D.meatKcalPerG,
        cho: 0,
        prot: gc * D.meatProtPerG,
        fat: gc * 0.08,
      };
    }
    case "uova": {
      const n = clamp(eggs, 2, 4);
      return {
        line: `${n} uova (frittata / strapazzate)`,
        kcal: n * D.eggKcalEach,
        cho: n * 0.6,
        prot: n * D.eggProtEach,
        fat: n * 5.3,
      };
    }
    case "tofu": {
      /** Tofu compatto: ~144 kcal/100 g, ~17 g prot, ~9 g fat (USDA SR Legacy ord. di grandezza). */
      const gc = clampStep(g, 130, 220);
      return {
        line: `${gc} g tofu compatto (saltato in padella o al forno)`,
        kcal: gc * 1.44,
        cho: gc * 0.019,
        prot: gc * 0.17,
        fat: gc * 0.09,
      };
    }
    case "tempeh": {
      /** Tempeh: ~190 kcal/100 g, ~19 g prot, ~11 g fat. */
      const gc = clampStep(g, 110, 180);
      return {
        line: `${gc} g tempeh (a fette, saltato o al forno)`,
        kcal: gc * 1.93,
        cho: gc * 0.075,
        prot: gc * 0.20,
        fat: gc * 0.11,
      };
    }
    case "seitan": {
      /** Seitan (glutine di frumento): ~120 kcal/100 g, ~25 g prot, pochissimi grassi. */
      const gc = clampStep(g, 80, 150);
      return {
        line: `${gc} g seitan (a fette, saltato)`,
        kcal: gc * 1.20,
        cho: gc * 0.04,
        prot: gc * 0.25,
        fat: gc * 0.02,
      };
    }
    default:
      return protLine("pollo", g, eggs, null);
  }
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
        weekCountFor(stapleCarb("riso"), weekCounts) < MAX_STAPLE_USES_PER_WEEK;
      const canPatate =
        carbOrder.includes("patate") &&
        !used.has(stapleCarb("patate")) &&
        weekCountFor(stapleCarb("patate"), weekCounts) < MAX_STAPLE_USES_PER_WEEK;
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

  const eggs = protKey === "uova" ? clamp(Math.round(P / 17), 2, 4) : 3;

  const fishProtDen =
    protKey === "pesce" && fishKind ? FISH[fishKind].protPerG : protKey === "pesce" ? FISH.merluzzo.protPerG : 0.29;

  let carbG =
    carbKey === "patate"
      ? clamp(K * 0.32 / D.potatoCookedKcalPerG, 140, 320)
      : carbKey === "riso"
        ? clamp(K * 0.38 / D.riceDryKcalPerG, 45, 120)
        : carbKey === "farro"
          ? clamp(K * 0.38 / D.farroDryKcalPerG, 50, 130)
          : carbKey === "quinoa"
            ? clamp(K * 0.38 / 3.68, 50, 120)
            : carbKey === "pane"
              ? clamp(K * 0.38 / D.breadKcalPerG, 120, 240)
              : clamp(K * 0.38 / D.pastaDryKcalPerG, 50, 140);
  let protG: number;
  if (protKey === "uova") {
    protG = 0;
  } else if (protKey === "legumi") {
    protG = clamp(P * 0.72 / D.legumeProtPerG, 130, 210);
  } else if (protKey === "tofu") {
    /** Densità proteica tofu ~0.17 g/g → grammatura attesa 130–220 g per centrare ~50–60 g prot al pasto principale. */
    protG = clamp(P * 0.72 / 0.17, 130, 220);
  } else if (protKey === "tempeh") {
    protG = clamp(P * 0.72 / 0.20, 110, 180);
  } else if (protKey === "seitan") {
    protG = clamp(P * 0.72 / 0.25, 80, 150);
  } else {
    protG = clamp(P * 0.72 / fishProtDen, 90, 280);
  }

  let vegG = clamp(160 + (seed % 3) * 25, 150, 250);
  let oilMl = clamp(F * 0.55 / D.oilFatPerMl, 8, 22);
  /**
   * Pane SECONDARIO al piatto (regola utente nutrizionista):
   * - Se il carb principale e' gia' "pane": 0 (no pane+pane).
   * - Pasto leggero CHO < 100g: 0 (no pane di contorno superfluo).
   * - Target intermedio 100-130g: porzione piccola 20-35g (~13-22g CHO).
   * - Target alto >= 130g: porzione 40-80g (~26-52g CHO) = vera 2a fonte CHO.
   * - Target molto alto >= 180g: 70-110g (~45-72g CHO).
   */
  let paneG: number;
  if (carbKey === "pane") {
    paneG = 0;
  } else if (m.carbsG < 100) {
    paneG = 0;
  } else if (m.carbsG < 130) {
    paneG = clamp(20 + (seed % 3) * 5, 20, 35);
  } else if (m.carbsG < 180) {
    paneG = clamp(45 + (seed % 3) * 8, 40, 80);
  } else {
    paneG = clamp(75 + (seed % 3) * 12, 70, 110);
  }
  /** Grana/formaggio: aggiungi solo se onnivoro/pescatariano e non in deny lattosio. Vegan/vegetarian-strict no. */
  const cheeseAllowed =
    ctx?.dietType !== "vegan" &&
    !denyHit(["latte", "lattosio", "latticino", "formaggio", "grana", "parmigiano"], ctx?.denyFragments);
  const granaG = cheeseAllowed && seed % 5 === 0 ? clamp(15 + (seed % 3) * 6, 15, 35) : 0;

  const totalKcal = () => {
    const c = carbLine(carbKey, carbG);
    const p = protLine(protKey, protG, eggs, fishKind);
    return (
      c.kcal +
      p.kcal +
      vegG * D.vegKcalPerG +
      oilMl * D.oilKcalPerMl +
      paneG * D.breadKcalPerG +
      granaG * D.granaKcalPerG
    );
  };

  const carbGClamp = (): { lo: number; hi: number } => {
    if (carbKey === "patate") return { lo: 90, hi: 340 };
    if (carbKey === "riso") return { lo: 38, hi: 125 };
    if (carbKey === "farro") return { lo: 40, hi: 135 };
    if (carbKey === "quinoa") return { lo: 45, hi: 125 };
    if (carbKey === "pane") return { lo: 120, hi: 240 };
    return { lo: 42, hi: 145 };
  };

  /** Bracket grammatura prot per famiglia (plant prot hanno volumi diversi: tofu/seitan compatti, tempeh denso). */
  const protGBracket = (): { lo: number; hi: number } => {
    if (protKey === "legumi") return { lo: 110, hi: 230 };
    if (protKey === "tofu") return { lo: 110, hi: 240 };
    if (protKey === "tempeh") return { lo: 90, hi: 200 };
    if (protKey === "seitan") return { lo: 70, hi: 170 };
    return { lo: 95, hi: 260 };
  };

  for (let i = 0; i < 12; i++) {
    const t = totalKcal();
    const f = K / Math.max(180, t);
    if (Math.abs(f - 1) < 0.04) break;
    const { lo, hi } = carbGClamp();
    carbG = clamp(carbG * Math.pow(f, 0.55), lo, hi);
    if (protKey !== "uova") {
      const pb = protGBracket();
      protG = clamp(protG * Math.pow(f, 0.45), pb.lo, pb.hi);
    }
    vegG = clamp(vegG * Math.pow(f, 0.15), 130, 280);
    oilMl = clamp(oilMl * Math.pow(f, 0.2), 6, 26);
  }

  const carbFinal = carbLine(carbKey, carbG);
  const protFinal = protLine(protKey, protG, eggs, fishKind);
  const vegFinalG = clampStep(vegG, 130, 280);
  const oilFinalMl = clamp(oilMl, 8, 22);
  /** Permette la 2a fonte CHO (pane) fino a 110g quando il target richiede vera quantita'. */
  const paneFinalG = paneG > 0 ? clampStep(paneG, 20, 110) : 0;
  const granaFinalG = granaG > 0 ? clampStep(granaG, 15, 35) : 0;
  const vegK = vegFinalG * D.vegKcalPerG;
  const oilK = oilFinalMl * D.oilKcalPerMl;
  const paneK = paneFinalG * D.breadKcalPerG;
  const granaK = granaFinalG * D.granaKcalPerG;

  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];

  const carbName =
    carbKey === "pasta"
      ? "Pasta (carb principale complesso)"
      : carbKey === "riso"
        ? "Riso (carb principale complesso)"
        : carbKey === "patate"
          ? "Patate (carb principale complesso)"
          : carbKey === "quinoa"
            ? "Quinoa (carb principale complesso)"
            : carbKey === "pane"
              ? "Pane integrale (carb principale — pasto leggero)"
              : "Farro/orzo (carb principale complesso)";

  items.push(
    item(carbName, carbFinal.line, carbFinal.kcal, "cho_heavy", "Un solo carboidrato complesso da pasto principale (no pasta + riso insieme)."),
  );
  lines.push(carbFinal.line);

  const protName = (() => {
    switch (protKey) {
      case "pollo":
        return "Proteina: pollo/tacchino";
      case "pesce":
        return fishKind ? `Proteina: ${FISH[fishKind].labelIt}` : "Proteina: pesce";
      case "legumi":
        return "Proteina vegetale: legumi";
      case "manzo":
        return "Proteina: carne magra";
      case "uova":
        return "Proteina: uova";
      case "tofu":
        return "Proteina vegetale: tofu";
      case "tempeh":
        return "Proteina vegetale: tempeh";
      case "seitan":
        return "Proteina vegetale: seitan";
      default:
        return "Proteina";
    }
  })();

  items.push(
    item(protName, protFinal.line, protFinal.kcal, "protein", "Una sola famiglia proteica principale (no pollo + pesce + uova nello stesso pasto)."),
  );
  lines.push(protFinal.line);

  items.push(
    item("Contorno verdure", `${vegFinalG} g verdure miste (crude o cotte)`, vegK, "veg", "Fibre, minerali, volume; condisci con parte degli grassi del pasto."),
  );
  lines.push(`${vegFinalG} g verdure miste a piacere`);

  items.push(
    item("Condimento olio EVO", `${oilFinalMl} ml olio d’oliva (a crudo)`, oilK, "fat", "Grassi insaturi; solo pranzo/cena, non in colazione."),
  );
  lines.push(`${oilFinalMl} ml olio d’oliva a crudo`);

  if (paneFinalG > 0) {
    const isFocaccia = seed % 7 === 0;
    /** Etichetta + grammatura riflettono il ruolo del pane (vera 2a fonte CHO quando target >= 130g). */
    const isSecondCarbSource = m.carbsG >= 130;
    const breadName = isFocaccia
      ? `${paneFinalG} g focaccia${isSecondCarbSource ? "" : " (porzione piccola)"}`
      : `${paneFinalG} g pane integrale${isSecondCarbSource ? "" : " (porzione piccola)"}`;
    const role = isSecondCarbSource ? "Pane / focaccia (2ª fonte CHO)" : "Pane / focaccia (accompagnamento)";
    const note = isSecondCarbSource
      ? "Seconda fonte di carboidrati richiesta dal target del pasto (CHO ≥ 130 g): il carb principale resta quello complesso scelto sopra."
      : "Accompagnamento in piccola quantità; il carboidrato principale resta quello scelto sopra.";
    items.push(item(role, breadName, paneK, "cho_heavy", note));
    lines.push(breadName);
  }

  if (granaFinalG > 0) {
    items.push(
      item("Grana / formaggio", `${granaFinalG} g grana o formaggio stagionato`, granaK, "fat", "Sapore e proteine; quota grassi del pasto."),
    );
    lines.push(`${granaFinalG} g grana o formaggio stagionato`);
  }

  if (m.fatG > 22 && seed % 4 === 1) {
    items.push(
      item(
        "Omega (integrazione)",
        "Se serve: 1 capsula omega 3 (EPA/DHA) lontano dai pasti o come da protocollo",
        15,
        "fat",
        "Complemento lipidi essenziali se il pesce è sporadico; non sostituisce olio e alimenti interi.",
      ),
    );
    lines.push("Opzionale: omega-3 EPA/DHA (integrazione se concordata)");
  }

  const total = items.reduce((a, i) => a + i.approxKcal, 0);

  if (used && (slot === "lunch" || slot === "dinner")) {
    used.add(stapleCarb(carbKey));
    used.add(stapleProt(protKey));
  }

  return { lines, items, totalApproxKcal: total };
}

/** kcal stimate da grammatura nell’etichetta affettato (educativo, allineato a ordini di grandezza comuni). */
function kcalFromDeliLine(line: string): number {
  const m = line.match(/(\d+(?:[.,]\d+)?)\s*g/i);
  const g = m ? parseFloat(m[1]!.replace(",", ".")) : 50;
  if (!Number.isFinite(g) || g <= 0) return 85;
  if (/bresaola/i.test(line)) return Math.round(g * 1.28);
  if (/cotto/i.test(line)) return Math.round(g * 1.22);
  if (/crudo/i.test(line)) return Math.round(g * 2.65);
  return Math.round(g * 1.5);
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
  /** Affettato fuori se vegan/vegetarian o deny carne: forziamo variante dolce con yogurt vegetale o gallette+hummus. */
  if (isVegan || isVegetarian || denyMeat) sweet = true;

  const denyDairy = denyHit(["latte", "lattosio", "latticino", "yogurt"], ctx?.denyFragments);
  const skipDairyYogurt = isVegan || denyDairy;

  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];

  if (sweet) {
    const yg = clamp(120 + K * 0.08, 125, 220);
    const yk = yg * D.yogurtKcalPerG;
    if (skipDairyYogurt) {
      const ygLabel = `${clamp(yg, 125, 220)} g yogurt vegetale (soia o cocco) non zuccherato`;
      items.push(item("Yogurt vegetale", ygLabel, yk, "protein", "Spuntino dolce: yogurt vegetale + frutta + cereali."));
      lines.push(ygLabel);
    } else {
      items.push(item("Yogurt", `${clamp(yg, 125, 220)} g yogurt`, yk, "protein", "Spuntino dolce: latticino + frutta."));
      lines.push(`${clamp(yg, 125, 220)} g yogurt`);
    }

    const fruit = seed % 3 === 0 ? "1 frutto medio" : `${clamp(40 + (seed % 5) * 12, 40, 100)} g frutta fresca o frutti di bosco`;
    const fk = seed % 3 === 0 ? 80 : 55;
    items.push(item("Frutta", fruit, fk, "cho_heavy", "CHO e fibre."));
    lines.push(fruit);

    const cgLo = postSlot ? 18 : 12;
    const cgHi = postSlot ? 48 : 35;
    const cg = clamp((postSlot ? 18 : 12) + K * (postSlot ? 0.045 : 0.03), cgLo, cgHi);
    const ck = cg * D.cerealKcalPerG;
    items.push(
      item(
        "Cereali",
        `${clamp(cg, cgLo, cgHi)} g cereali / muesli (sul yogurt)`,
        ck,
        "cho_heavy",
        postSlot
          ? "Spuntino post-rientro orari: più cereali sul target CHO (refeed leggero)."
          : "Completa lo spuntino senza seconda fonte proteica animale.",
      ),
    );
    lines.push(`${clamp(cg, cgLo, cgHi)} g cereali o muesli`);
  } else {
    const crG = postSlot ? clamp(36 + (seed % 4) * 8, 32, 58) : clamp(28 + (seed % 4) * 6, 24, 48);
    const crK = crG * D.crackerKcalPerG;
    items.push(item("Gallette / pane", `${crG} g gallette integrali o pane tostato`, crK, "cho_heavy", "Base croccante; una fonte proteica sotto."));
    lines.push(`${crG} g gallette o pane tostato`);

    const cold = postSlot
      ? seed % 2 === 0
        ? "55 g prosciutto cotto magro"
        : "50 g bresaola"
      : seed % 3 === 0
        ? "60 g prosciutto cotto magro"
        : seed % 3 === 1
          ? "50 g bresaola"
          : "45 g prosciutto crudo";
    const pk = kcalFromDeliLine(cold);
    items.push(item("Affettato", cold, pk, "protein", postSlot ? "Proteina magra; variante meno grassa dopo spostamento orari." : "Proteina magra in spuntino salato."));
    lines.push(cold);

    /** Grasso aggiunto: avocado per tutti, grana solo se cheeseAllowed. */
    const cheeseAllowed = !denyHit(["latte", "lattosio", "latticino", "formaggio", "grana", "parmigiano"], ctx?.denyFragments);
    const fatPick =
      seed % 2 === 0 || !cheeseAllowed
        ? { line: "15 g avocado", kcal: 15 * D.avocadoKcalPerG, role: "fat" as const }
        : { line: "20 g grana grattugiato", kcal: 20 * D.granaKcalPerG, role: "fat" as const };
    items.push(item("Grasso spuntino", fatPick.line, fatPick.kcal, fatPick.role, "Una sola fonte di grasso aggiunto oltre all’affettato."));
    lines.push(fatPick.line);
  }

  const s = items.reduce((a, i) => a + i.approxKcal, 0);
  return { lines, items, totalApproxKcal: s };
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
  if (slot === "breakfast") return composeBreakfast(macros, seed, breakfastCtx);
  if (slot === "snack_am") return composeSnack(macros, seed, "snack_am", ctx);
  if (slot === "snack_pm" || slot === "snack_evening") {
    return composeSnack(macros, seed, "snack_pm", ctx);
  }
  if (slot === "lunch" && ctx?.racePreLunch) {
    return composeRacePreLunchMainMeal(slot, macros, seed, ctx.racePreLunch, ctx);
  }
  return composeMainMeal(slot, macros, seed, ctx);
}

