import "server-only";

import {
  CANONICAL_FOOD_TABLE,
  inferCanonicalFoodKey,
  scaleCanonicalNutrientsToGrams,
  scaleCanonicalNutrientsToKcal,
  type CanonicalFoodNutrients,
  type ScaledMealItemNutrients,
} from "@/lib/nutrition/canonical-food-composition";
import {
  CANONICAL_FOOD_TO_FDC_ID,
  fdcIdForCanonicalKey,
} from "@/lib/nutrition/canonical-food-fdc-aliases";
import { getOrImportFdcFood, type FdcCachedFood } from "@/lib/nutrition/fdc-food-cache";

/**
 * Mappa nutrient_id USDA FDC → campo `CanonicalFoodNutrients`.
 * Riferimenti: https://fdc.nal.usda.gov/api-spec/fdc_api.html
 */
const FDC_NUTRIENT_TO_CANONICAL: Record<number, keyof CanonicalFoodNutrients> = {
  1008: "kcalPer100g", // Energy (kcal)
  1003: "proteinG",
  1005: "carbsG", // Carbohydrate, by difference
  1004: "fatG", // Total lipid
  1079: "fiberG",
  1258: "saturatedFatG", // Fatty acids, total saturated
  1292: "monoFatG", // Fatty acids, total monounsaturated
  1293: "polyFatG", // Fatty acids, total polyunsaturated
  1106: "vitA_mcg_RAE",
  1162: "vitC_mg",
  1114: "vitD_mcg", // Vitamin D (D2 + D3)
  1109: "vitE_mg", // alpha-tocopherol
  1185: "vitK_mcg", // phylloquinone
  1165: "thiamineB1_mg",
  1166: "riboflavinB2_mg",
  1167: "niacinB3_mg",
  1175: "vitB6_mg",
  1177: "folate_mcg", // Folate, total
  1178: "vitB12_mcg",
  1087: "ca_mg",
  1089: "fe_mg",
  1090: "mg_mg",
  1091: "p_mg",
  1092: "k_mg",
  1093: "na_mg",
  1095: "zn_mg",
  1103: "se_mcg",
  1210: "eaa_trp", // Tryptophan
  1211: "eaa_thr", // Threonine
  1212: "eaa_ile", // Isoleucine
  1213: "eaa_leu", // Leucine
  1214: "eaa_lys", // Lysine
  1215: "eaa_met", // Methionine
  1217: "eaa_phe", // Phenylalanine
  1219: "eaa_val", // Valine
  1221: "eaa_his", // Histidine
};

/** Nutrient IDs USDA per le frazioni n-3 (sommate per ottenere Omega-3 totale per 100 g). */
const FDC_OMEGA3_IDS = [1404, 1278, 1279, 1280, 1405, 1406];

const ZERO_CANONICAL: CanonicalFoodNutrients = {
  kcalPer100g: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  saturatedFatG: 0,
  monoFatG: 0,
  polyFatG: 0,
  omega3G: 0,
  vitA_mcg_RAE: 0,
  vitC_mg: 0,
  vitD_mcg: 0,
  vitE_mg: 0,
  vitK_mcg: 0,
  thiamineB1_mg: 0,
  riboflavinB2_mg: 0,
  niacinB3_mg: 0,
  vitB6_mg: 0,
  folate_mcg: 0,
  vitB12_mcg: 0,
  ca_mg: 0,
  fe_mg: 0,
  mg_mg: 0,
  p_mg: 0,
  k_mg: 0,
  na_mg: 0,
  zn_mg: 0,
  se_mcg: 0,
  eaa_leu: 0,
  eaa_lys: 0,
  eaa_met: 0,
  eaa_phe: 0,
  eaa_thr: 0,
  eaa_trp: 0,
  eaa_ile: 0,
  eaa_val: 0,
  eaa_his: 0,
};

/**
 * Converte una `FdcCachedFood` (Supabase `nutrition_fdc_foods`) in una `CanonicalFoodNutrients`
 * (per 100 g). Le bucket pre-partizionate (vitamins/minerals/aminoAcids/fattyAcids/otherNutrients)
 * sono unite con `nutrients_raw` non vuoto: la sorgente più completa vince per ciascun nutrientId.
 */
export function fdcCachedFoodToCanonical(food: FdcCachedFood): CanonicalFoodNutrients {
  const out: CanonicalFoodNutrients = { ...ZERO_CANONICAL };
  out.kcalPer100g = Math.max(0, Number(food.kcalPer100g ?? 0));
  out.proteinG = Math.max(0, Number(food.proteinPer100g ?? 0));
  out.carbsG = Math.max(0, Number(food.carbsPer100g ?? 0));
  out.fatG = Math.max(0, Number(food.fatPer100g ?? 0));
  out.fiberG = Math.max(0, Number(food.fiberPer100g ?? 0));
  out.na_mg = Math.max(0, Number(food.sodiumMgPer100g ?? 0));

  let omega3 = 0;
  const apply = (rows: { nutrientId: number; amountPer100g: number }[]) => {
    for (const r of rows) {
      const target = FDC_NUTRIENT_TO_CANONICAL[r.nutrientId];
      if (target) {
        const v = Math.max(0, Number(r.amountPer100g ?? 0));
        (out as Record<string, number>)[target] = v;
      }
      if (FDC_OMEGA3_IDS.includes(r.nutrientId)) {
        omega3 += Math.max(0, Number(r.amountPer100g ?? 0));
      }
    }
  };
  apply(food.vitamins);
  apply(food.minerals);
  apply(food.aminoAcids);
  apply(food.fattyAcids);
  apply(food.otherNutrients);
  out.omega3G = Number(omega3.toFixed(3));
  return out;
}

/** Estrae gli indici metabolici USDA per 100 g (eventualmente già stimati e salvati in DB). */
function metabolicIndicesPer100g(food: FdcCachedFood): { gi: number; ii: number; glPer100g: number } {
  return {
    gi: Number(food.glycemicIndexEstimate ?? 0) || 0,
    ii: Number(food.insulinIndexEstimate ?? 0) || 0,
    glPer100g: Number(food.glycemicLoadPer100g ?? 0) || 0,
  };
}

/**
 * Tenta di leggere i nutrienti dalla cache USDA. Se il `canonicalKey` non ha alias o l'import fallisce,
 * ritorna `null` e il caller deve fare fallback alla `CANONICAL_FOOD_TABLE` interna.
 */
export async function loadCanonicalFromFdc(canonicalKey: string): Promise<{
  canonical: CanonicalFoodNutrients;
  gi: number;
  ii: number;
  glPer100g: number;
  fdcId: number;
  description: string;
} | null> {
  const fdcId = fdcIdForCanonicalKey(canonicalKey);
  if (!fdcId) return null;
  const food = await getOrImportFdcFood(fdcId);
  if ("error" in food) return null;
  const canonical = fdcCachedFoodToCanonical(food);
  if (!canonical.kcalPer100g) return null;
  const indices = metabolicIndicesPer100g(food);
  return { canonical, ...indices, fdcId, description: food.description };
}

/** Snapshot per più chiavi canoniche, da pre-caricare sul server prima del solver del meal plan. */
export type FdcCanonicalSnapshot = Record<
  string,
  { canonical: CanonicalFoodNutrients; gi: number; ii: number; glPer100g: number; fdcId: number; description: string }
>;

/**
 * Pre-carica in batch tutti i `canonicalKey` mappati a un `fdcId`.
 * Fallisce silenziosamente per le voci non importabili (RLS, USDA giù, ecc.) → fallback TS.
 */
export async function buildFdcCanonicalSnapshot(canonicalKeys: string[]): Promise<FdcCanonicalSnapshot> {
  const unique = Array.from(new Set(canonicalKeys.filter((k) => Boolean(CANONICAL_FOOD_TO_FDC_ID[k]))));
  if (unique.length === 0) return {};
  const entries = await Promise.all(
    unique.map(async (key): Promise<[string, FdcCanonicalSnapshot[string]] | null> => {
      const loaded = await loadCanonicalFromFdc(key);
      if (!loaded) return null;
      return [key, loaded];
    }),
  );
  const out: FdcCanonicalSnapshot = {};
  for (const e of entries) {
    if (e) out[e[0]] = e[1];
  }
  return out;
}

/**
 * Estrae `gramsEdible` esplicito da un portionHint (g o ml con densità nota olio).
 * Replicato da `canonical-food-composition.ts` per non esporre helper privati.
 */
const OLIVE_OIL_G_PER_ML = 0.92;
function parseGramsFromHint(hint: string, compositionKey: string): number | undefined {
  const text = hint.trim();
  if (!text) return undefined;
  const grams = text.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?\b/i);
  if (grams) {
    const v = parseFloat(grams[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v;
  }
  const ml = text.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (ml) {
    const v = parseFloat(ml[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0 && compositionKey === "olive_oil") {
      return v * OLIVE_OIL_G_PER_ML;
    }
  }
  return undefined;
}

/**
 * Versione async di `nutrientsForMealPlanItem` che preferisce i dati USDA reali
 * (con GI/II) quando disponibili nello snapshot. Fallback automatico al TS table.
 *
 * Utilizzo tipico (server-side, dentro `meal-plan-response-finalize` o `deterministic-meal-plan-from-request`):
 *   const snap = await buildFdcCanonicalSnapshot(allItemKeys);
 *   for (const item of items) {
 *     const r = nutrientsForMealPlanItemFromCache(item, snap);
 *     ...
 *   }
 */
export function nutrientsForMealPlanItemFromCache(
  item: { name: string; portionHint: string; approxKcal: number },
  snapshot: FdcCanonicalSnapshot,
): {
  compositionKey: string;
  compositionStatus: "fdc_cache" | "canonical_estimate" | "unresolved";
  nutrients: ScaledMealItemNutrients;
} {
  const hay = `${item.name} ${item.portionHint}`;
  const compositionKey = inferCanonicalFoodKey(hay);

  if (compositionKey === "generic_mixed") {
    return {
      compositionKey: "unresolved",
      compositionStatus: "unresolved",
      nutrients: zeroScaled(),
    };
  }

  const fdc = snapshot[compositionKey];
  const tsRow = CANONICAL_FOOD_TABLE[compositionKey];

  const canonical: CanonicalFoodNutrients | undefined = fdc?.canonical ?? tsRow;
  if (!canonical || !canonical.kcalPer100g) {
    return {
      compositionKey: "unresolved",
      compositionStatus: "unresolved",
      nutrients: zeroScaled(),
    };
  }

  const hintForServing = `${item.portionHint} ${item.name}`.trim();
  const grams = parseGramsFromHint(hintForServing, compositionKey);
  const scaled =
    grams != null
      ? scaleCanonicalNutrientsToGrams(canonical, grams)
      : scaleCanonicalNutrientsToKcal(canonical, item.approxKcal);

  if (fdc) {
    const massG = grams ?? (canonical.kcalPer100g > 0 ? (item.approxKcal * 100) / canonical.kcalPer100g : 0);
    scaled.glycemicIndex = fdc.gi;
    scaled.insulinIndex = fdc.ii;
    scaled.glycemicLoad = Number(((fdc.glPer100g * massG) / 100).toFixed(2));
    return { compositionKey, compositionStatus: "fdc_cache", nutrients: scaled };
  }

  return { compositionKey, compositionStatus: "canonical_estimate", nutrients: scaled };
}

function zeroScaled(): ScaledMealItemNutrients {
  return {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    saturatedFatG: 0,
    monoFatG: 0,
    polyFatG: 0,
    omega3G: 0,
    vitA_mcg_RAE: 0,
    vitC_mg: 0,
    vitD_mcg: 0,
    vitE_mg: 0,
    vitK_mcg: 0,
    thiamineB1_mg: 0,
    riboflavinB2_mg: 0,
    niacinB3_mg: 0,
    vitB6_mg: 0,
    folate_mcg: 0,
    vitB12_mcg: 0,
    ca_mg: 0,
    fe_mg: 0,
    mg_mg: 0,
    p_mg: 0,
    k_mg: 0,
    na_mg: 0,
    zn_mg: 0,
    se_mcg: 0,
    eaa_leu: 0,
    eaa_lys: 0,
    eaa_met: 0,
    eaa_phe: 0,
    eaa_thr: 0,
    eaa_trp: 0,
    eaa_ile: 0,
    eaa_val: 0,
    eaa_his: 0,
    glycemicIndex: 0,
    insulinIndex: 0,
    glycemicLoad: 0,
  };
}
