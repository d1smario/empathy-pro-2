/**
 * Registro unico pathway × slot × alimento canonico per il generatore deterministico.
 *
 * Regola prodotto: cofactors attivi (folato, ferro, magnesio, …) entrano QUI;
 * il composer applica solo swap/add consentiti per lo slot (`meal-slot-food-rules`).
 * Se nessun alimento è ammesso nello slot → integrazione (hint), non alimenti da pranzo in colazione.
 */

import type { IntelligentMealPlanItemOut, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { CANONICAL_FOOD_TABLE } from "@/lib/nutrition/canonical-food-composition";
import { isFoodLabelAllowedInMealSlot, supplementHintLinesForUncoveredTargets } from "@/lib/nutrition/meal-slot-food-rules";
import type { MediterraneanDietType } from "@/lib/nutrition/mediterranean-meal-composer";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";

export type NutrientPathwaySwapSpec = {
  nutrientId: NutrientTargetId;
  canonicalKey: string;
  name: string;
  noun: string;
  bridge: string;
  defaultGrams: number;
  macroRole: IntelligentMealPlanItemOut["macroRole"];
  /** replace: sostituisce voce esistente (fromKeys). add: mantiene il pasto e aggiunge. */
  mode: "replace" | "add";
  fromKeys: string[];
};

const MAIN_SLOTS: ReadonlySet<MealSlotKey> = new Set(["lunch", "dinner"]);

function slotCategory(slot: MealSlotKey): "main" | "light" {
  return MAIN_SLOTS.has(slot) ? "main" : "light";
}

/** Pool ordinato per nutriente × categoria slot (main = pranzo/cena, light = colazione/spuntini). */
const NUTRIENT_PATHWAY_SLOT_POOL: Partial<
  Record<NutrientTargetId, { main?: NutrientPathwaySwapSpec[]; light?: NutrientPathwaySwapSpec[] }>
> = {
  folate_mcg: {
    main: [
      { nutrientId: "folate_mcg", canonicalKey: "spinach_raw", name: "Spinaci (folato)", noun: "spinaci freschi", bridge: "Folato denso da verdure a foglia (pathway cofactor).", defaultGrams: 150, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "folate_mcg", canonicalKey: "legumes_cooked", name: "Legumi cotti (folato)", noun: "legumi cotti (lenticchie/ceci)", bridge: "Folato complementare da legumi.", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] },
      { nutrientId: "folate_mcg", canonicalKey: "chickpeas_cooked", name: "Ceci cotti (folato)", noun: "ceci cotti", bridge: "Folato + proteine vegetali (pathway).", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] },
      { nutrientId: "folate_mcg", canonicalKey: "asparagus_raw", name: "Asparagi (folato)", noun: "asparagi", bridge: "Folato complementare (pathway).", defaultGrams: 140, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "folate_mcg", canonicalKey: "kale_raw", name: "Cavolo nero (folato)", noun: "cavolo nero / kale", bridge: "Folato da verdure a foglia.", defaultGrams: 120, macroRole: "veg", mode: "add", fromKeys: [] },
    ],
    light: [],
  },
  vitC_mg: {
    main: [
      { nutrientId: "vitC_mg", canonicalKey: "bell_pepper_red", name: "Peperone rosso (vit C)", noun: "peperone rosso crudo", bridge: "Vitamina C densa (pathway redox).", defaultGrams: 120, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "vitC_mg", canonicalKey: "kiwi_raw", name: "Kiwi (vit C)", noun: "kiwi", bridge: "Vitamina C e antiossidanti.", defaultGrams: 120, macroRole: "cho_heavy", mode: "add", fromKeys: [] },
      { nutrientId: "vitC_mg", canonicalKey: "orange_raw", name: "Arancia (vit C)", noun: "arancia", bridge: "Vitamina C al pasto.", defaultGrams: 150, macroRole: "cho_heavy", mode: "add", fromKeys: [] },
      { nutrientId: "vitC_mg", canonicalKey: "strawberries_raw", name: "Fragole (vit C)", noun: "fragole", bridge: "Vitamina C e polifenoli.", defaultGrams: 100, macroRole: "cho_heavy", mode: "add", fromKeys: [] },
      { nutrientId: "vitC_mg", canonicalKey: "mixed_fruit", name: "Frutta fresca (vit C)", noun: "frutta fresca mista", bridge: "Vitamina C (pathway redox).", defaultGrams: 150, macroRole: "cho_heavy", mode: "add", fromKeys: [] },
    ],
    light: [
      { nutrientId: "vitC_mg", canonicalKey: "kiwi_raw", name: "Kiwi (vit C)", noun: "kiwi", bridge: "Vitamina C colazione/spuntino.", defaultGrams: 100, macroRole: "cho_heavy", mode: "replace", fromKeys: ["oat_dry", "crackers_whole", "bread_white"] },
      { nutrientId: "vitC_mg", canonicalKey: "orange_raw", name: "Arancia (vit C)", noun: "arancia", bridge: "Vitamina C colazione/spuntino.", defaultGrams: 130, macroRole: "cho_heavy", mode: "replace", fromKeys: ["oat_dry", "crackers_whole", "bread_white"] },
      { nutrientId: "vitC_mg", canonicalKey: "strawberries_raw", name: "Fragole (vit C)", noun: "fragole", bridge: "Vitamina C spuntino.", defaultGrams: 90, macroRole: "cho_heavy", mode: "replace", fromKeys: ["oat_dry", "crackers_whole", "bread_white"] },
      { nutrientId: "vitC_mg", canonicalKey: "mixed_fruit", name: "Frutta fresca (vit C)", noun: "frutta fresca mista", bridge: "Vitamina C colazione/spuntino (pathway redox).", defaultGrams: 120, macroRole: "cho_heavy", mode: "replace", fromKeys: ["oat_dry", "crackers_whole", "bread_white"] },
    ],
  },
  fe_mg: {
    main: [
      { nutrientId: "fe_mg", canonicalKey: "spinach_raw", name: "Spinaci (ferro)", noun: "spinaci freschi", bridge: "Ferro non eme (pathway eritropoiesi).", defaultGrams: 150, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "fe_mg", canonicalKey: "chickpeas_cooked", name: "Ceci cotti (ferro)", noun: "ceci cotti", bridge: "Ferro vegetale complementare.", defaultGrams: 130, macroRole: "protein", mode: "add", fromKeys: [] },
      { nutrientId: "fe_mg", canonicalKey: "legumes_cooked", name: "Legumi cotti (ferro)", noun: "legumi cotti", bridge: "Ferro vegetale (pathway).", defaultGrams: 130, macroRole: "protein", mode: "add", fromKeys: [] },
    ],
    light: [],
  },
  mg_mg: {
    main: [
      { nutrientId: "mg_mg", canonicalKey: "pumpkin_seeds_raw", name: "Semi di zucca (magnesio)", noun: "semi di zucca", bridge: "Magnesio denso (cofactor chinasi).", defaultGrams: 25, macroRole: "fat", mode: "add", fromKeys: [] },
      { nutrientId: "mg_mg", canonicalKey: "spinach_raw", name: "Spinaci (magnesio)", noun: "spinaci freschi", bridge: "Magnesio da verdure.", defaultGrams: 150, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "mg_mg", canonicalKey: "legumes_cooked", name: "Legumi cotti (magnesio)", noun: "legumi cotti", bridge: "Magnesio complementare da legumi.", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] },
    ],
    light: [
      { nutrientId: "mg_mg", canonicalKey: "almonds_raw", name: "Mandorle (magnesio)", noun: "mandorle", bridge: "Magnesio in colazione/spuntino.", defaultGrams: 25, macroRole: "fat", mode: "add", fromKeys: [] },
      { nutrientId: "mg_mg", canonicalKey: "mixed_fruit", name: "Frutta (magnesio)", noun: "frutta fresca (banana/agrumi)", bridge: "Magnesio leggero in colazione/spuntino.", defaultGrams: 120, macroRole: "cho_heavy", mode: "replace", fromKeys: ["oat_dry", "crackers_whole"] },
    ],
  },
  zn_mg: {
    main: [
      { nutrientId: "zn_mg", canonicalKey: "pumpkin_seeds_raw", name: "Semi di zucca (zinco)", noun: "semi di zucca", bridge: "Zinco denso.", defaultGrams: 25, macroRole: "fat", mode: "add", fromKeys: [] },
      { nutrientId: "zn_mg", canonicalKey: "chickpeas_cooked", name: "Ceci cotti (zinco)", noun: "ceci cotti", bridge: "Zinco complementare.", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] },
      { nutrientId: "zn_mg", canonicalKey: "legumes_cooked", name: "Legumi cotti (zinco)", noun: "legumi cotti", bridge: "Zinco complementare da legumi.", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] },
    ],
    light: [],
  },
  vitB12_mcg: {
    main: [
      {
        nutrientId: "vitB12_mcg",
        canonicalKey: "egg_whole",
        name: "Uova (B12)",
        noun: "uova",
        bridge: "Vitamina B12 (pathway eritropoiesi).",
        defaultGrams: 100,
        macroRole: "protein",
        mode: "replace",
        fromKeys: ["yogurt_plain", "plant_drink_generic"],
      },
    ],
    light: [
      {
        nutrientId: "vitB12_mcg",
        canonicalKey: "egg_whole",
        name: "Uova (B12)",
        noun: "uova",
        bridge: "Vitamina B12 colazione/spuntino.",
        defaultGrams: 100,
        macroRole: "protein",
        mode: "replace",
        fromKeys: ["yogurt_plain", "plant_drink_generic", "whey_powder"],
      },
    ],
  },
  omega3G: {
    main: [
      {
        nutrientId: "omega3G",
        canonicalKey: "fish_white",
        name: "Pesce (omega-3)",
        noun: "pesce bianco o azzurro",
        bridge: "Omega-3 EPA/DHA da pesce (pathway lipidico).",
        defaultGrams: 120,
        macroRole: "protein",
        mode: "replace",
        fromKeys: ["chicken_breast", "beef_lean", "egg_whole"],
      },
    ],
    light: [
      {
        nutrientId: "omega3G",
        canonicalKey: "fish_white",
        name: "Pesce affumicato (omega-3)",
        noun: "salmone affumicato o azzurro",
        bridge: "Omega-3 EPA/DHA colazione/spuntino salato.",
        defaultGrams: 70,
        macroRole: "protein",
        mode: "replace",
        fromKeys: ["yogurt_plain", "deli_lean", "whey_powder"],
      },
    ],
  },
};

const VEGAN_BLOCKED_KEYS = new Set(["egg_whole", "fish_white", "yogurt_plain", "deli_lean", "cheese_hard"]);
const VEGETARIAN_BLOCKED_KEYS = new Set(["fish_white"]);

function isCanonicalKeyBlocked(canonicalKey: string, dietType?: MediterraneanDietType): boolean {
  if (dietType === "vegan" && VEGAN_BLOCKED_KEYS.has(canonicalKey)) return true;
  if (dietType === "vegetarian" && VEGETARIAN_BLOCKED_KEYS.has(canonicalKey)) return true;
  return false;
}

/** Tutti gli swap/add ammessi per nutriente × slot (ordinati per priorità). */
export function listNutrientPathwaySwapsForSlot(
  nutrientId: NutrientTargetId,
  slot: MealSlotKey,
  dietType?: MediterraneanDietType,
): NutrientPathwaySwapSpec[] {
  const cat = slotCategory(slot);
  const pool = NUTRIENT_PATHWAY_SLOT_POOL[nutrientId]?.[cat];
  if (!pool?.length) return [];

  return pool.filter((spec) => {
    if (!CANONICAL_FOOD_TABLE[spec.canonicalKey]) return false;
    if (isCanonicalKeyBlocked(spec.canonicalKey, dietType)) return false;
    if (!isFoodLabelAllowedInMealSlot(spec.name, slot)) return false;
    return true;
  });
}

/** Primo swap/add ammesso per nutriente × slot; null → solo integrazione. */
export function resolveNutrientPathwaySwap(
  nutrientId: NutrientTargetId,
  slot: MealSlotKey,
  dietType?: MediterraneanDietType,
): NutrientPathwaySwapSpec | null {
  return listNutrientPathwaySwapsForSlot(nutrientId, slot, dietType)[0] ?? null;
}

/** Nutrienti attivi non copribili con alimenti ammessi nello slot → hint integrazione. */
export function uncoveredNutrientTargetsForSlot(
  targetIds: readonly NutrientTargetId[],
  slot: MealSlotKey,
  dietType?: MediterraneanDietType,
): Array<{ nutrientId: NutrientTargetId; displayNameIt: string }> {
  const uncovered: Array<{ nutrientId: NutrientTargetId; displayNameIt: string }> = [];
  for (const id of targetIds) {
    if (listNutrientPathwaySwapsForSlot(id, slot, dietType).length === 0) {
      uncovered.push({ nutrientId: id, displayNameIt: nutrientDisplayLabel(id) });
    }
  }
  return uncovered;
}

function nutrientDisplayLabel(id: NutrientTargetId): string {
  const labels: Partial<Record<NutrientTargetId, string>> = {
    folate_mcg: "Folati (B9)",
    vitC_mg: "Vitamina C",
    fe_mg: "Ferro",
    mg_mg: "Magnesio",
    zn_mg: "Zinco",
    vitB12_mcg: "Vitamina B12",
    omega3G: "Omega-3 EPA/DHA",
  };
  return labels[id] ?? id;
}

/** Voce integrazione nel piano quando il nutriente non ha alimenti ammessi nello slot. */
export function buildIntegrationHintItemsForSlot(
  slot: MealSlotKey,
  uncovered: Array<{ nutrientId: string; displayNameIt: string }>,
  maxLines = 2,
): IntelligentMealPlanItemOut[] {
  const lines = supplementHintLinesForUncoveredTargets(slot, uncovered, maxLines);
  return lines.map((line) => ({
    name: "Integrazione (se concordata)",
    portionHint: line.slice(0, 160),
    approxKcal: 0,
    macroRole: "mixed" as const,
    functionalBridge: line.slice(0, 500),
  }));
}
