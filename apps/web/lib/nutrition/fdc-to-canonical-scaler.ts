import "server-only";

import {
  CANONICAL_FOOD_TABLE,
  inferCanonicalFoodKeyPreferName,
  looksLikeMultiIngredientPortionHint,
  scaleCanonicalNutrientsToGrams,
  scaleCanonicalNutrientsToKcal,
  type CanonicalFoodNutrients,
  type ScaledMealItemNutrients,
} from "@/lib/nutrition/canonical-food-composition";
import {
  buildFdcCanonicalSnapshotFromFoods,
  fdcCachedFoodToCanonical,
  metabolicIndicesPer100gFromFdc,
  type FdcCanonicalSnapshot,
} from "@/lib/nutrition/fdc-canonical-map";
import { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import { getOrImportFdcFood, loadFdcFoodsByIds } from "@/lib/nutrition/fdc-food-cache";

export { buildFdcCanonicalSnapshotFromFoods, fdcCachedFoodToCanonical, type FdcCanonicalSnapshot };
export { buildFdcCanonicalSnapshotFromFdcIds } from "@/lib/nutrition/fdc-canonical-map";

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
  const indices = metabolicIndicesPer100gFromFdc(food);
  return { canonical, ...indices, fdcId, description: food.description };
}

export async function buildFdcCanonicalSnapshot(canonicalKeys: string[]): Promise<FdcCanonicalSnapshot> {
  const uniqueKeys = Array.from(new Set(canonicalKeys));
  const fdcIds = uniqueKeys.map((k) => fdcIdForCanonicalKey(k)).filter((id): id is number => typeof id === "number");
  if (fdcIds.length === 0) return {};
  const foodsByFdcId = await loadFdcFoodsByIds(fdcIds);
  return buildFdcCanonicalSnapshotFromFoods(uniqueKeys, foodsByFdcId);
}

/**
 * Estrae `gramsEdible` esplicito da un portionHint (g o ml con densità nota olio).
 * Replicato da `canonical-food-composition.ts` per non esporre helper privati.
 *
 * Multi-ingredient guard: se il portionHint contiene un compose (`" + "` o piu' di
 * una quantita' g/ml), il primo `\d+ g` rappresenta solo uno degli ingredienti e
 * scalare i nutrienti del singolo USDA su quel valore e' fuorviante. In quel caso
 * torniamo undefined → il caller usa `scaleCanonicalNutrientsToKcal(canonical, approxKcal)`.
 */
const OLIVE_OIL_G_PER_ML = 0.92;
/** Densita' liquidi-latte (latte/yogurt/bevande vegetali): ~1 g/ml. */
const LIQUID_DAIRY_G_PER_ML = 1.03;
const LIQUIDS_AS_GRAMS_KEYS = new Set([
  "milk_2pct",
  "milk_goat",
  "yogurt_plain",
  "plant_drink_almond",
  "plant_drink_rice",
  "plant_drink_oat",
  "plant_drink_generic",
]);

function parseGramsFromHint(hint: string, compositionKey: string): number | undefined {
  const text = hint.trim();
  if (!text) return undefined;
  if (looksLikeMultiIngredientPortionHint(text)) return undefined;
  const grams = text.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?\b/i);
  if (grams) {
    const v = parseFloat(grams[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v;
  }
  const ml = text.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (ml) {
    const v = parseFloat(ml[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) {
      if (compositionKey === "olive_oil") return v * OLIVE_OIL_G_PER_ML;
      if (LIQUIDS_AS_GRAMS_KEYS.has(compositionKey)) return v * LIQUID_DAIRY_G_PER_ML;
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
function reconcileScaledNutrients(
  scaled: ScaledMealItemNutrients,
  approxKcal: number,
  canonical: CanonicalFoodNutrients,
): ScaledMealItemNutrients {
  if (approxKcal <= 0 || scaled.kcal <= 0) return scaled;
  const deviation = Math.abs(scaled.kcal - approxKcal) / Math.max(approxKcal, 1);
  if (deviation <= 0.2) return scaled;
  return scaleCanonicalNutrientsToKcal(canonical, approxKcal);
}

function scaleFromCanonical(
  canonical: CanonicalFoodNutrients,
  item: { portionHint: string; name: string; approxKcal: number },
  compositionKey: string,
  giMeta?: { gi: number; ii: number; glPer100g: number },
): ScaledMealItemNutrients {
  if (
    !isPlausiblePer100gMacros({
      kcal_100: canonical.kcalPer100g,
      carbs_100: canonical.carbsG,
      protein_100: canonical.proteinG,
      fat_100: canonical.fatG,
    })
  ) {
    const tsFallback = CANONICAL_FOOD_TABLE[compositionKey.replace(/^fdc:\d+$/, "")];
    if (tsFallback?.kcalPer100g) {
      return scaleCanonicalNutrientsToKcal(tsFallback, item.approxKcal);
    }
    return scaleCanonicalNutrientsToKcal(canonical, item.approxKcal);
  }

  const hintForServing = `${item.portionHint} ${item.name}`.trim();
  const grams = parseGramsFromHint(hintForServing, compositionKey);
  let scaled =
    grams != null
      ? scaleCanonicalNutrientsToGrams(canonical, grams)
      : scaleCanonicalNutrientsToKcal(canonical, item.approxKcal);
  scaled = reconcileScaledNutrients(scaled, item.approxKcal, canonical);

  if (giMeta) {
    const massG = grams ?? (canonical.kcalPer100g > 0 ? (item.approxKcal * 100) / canonical.kcalPer100g : 0);
    scaled.glycemicIndex = giMeta.gi;
    scaled.insulinIndex = giMeta.ii;
    scaled.glycemicLoad = Number(((giMeta.glPer100g * massG) / 100).toFixed(2));
  }
  return scaled;
}

export function nutrientsForMealPlanItemFromCache(
  item: { name: string; portionHint: string; approxKcal: number; compositionKey?: string },
  snapshot: FdcCanonicalSnapshot,
): {
  compositionKey: string;
  compositionStatus: "fdc_cache" | "canonical_estimate" | "unresolved";
  nutrients: ScaledMealItemNutrients;
} {
  const fdcKey = item.compositionKey?.startsWith("fdc:") ? item.compositionKey : null;
  if (fdcKey && snapshot[fdcKey]) {
    const fdc = snapshot[fdcKey]!;
    const scaled = scaleFromCanonical(fdc.canonical, item, fdcKey, {
      gi: fdc.gi,
      ii: fdc.ii,
      glPer100g: fdc.glPer100g,
    });
    return { compositionKey: fdcKey, compositionStatus: "fdc_cache", nutrients: scaled };
  }

  const compositionKey = inferCanonicalFoodKeyPreferName(item.name, item.portionHint);

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

  const scaled = scaleFromCanonical(
    canonical,
    item,
    compositionKey,
    fdc ? { gi: fdc.gi, ii: fdc.ii, glPer100g: fdc.glPer100g } : undefined,
  );

  if (fdc) {
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
