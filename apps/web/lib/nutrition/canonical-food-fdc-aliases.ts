/**
 * Mappa dei `canonicalKey` (banca alimenti interna) → `fdcId` USDA FoodData Central.
 *
 * Quando una key è mappata qui:
 * - `nutrientsForMealPlanItemFromCache` legge i nutrienti dalla tabella Supabase `nutrition_fdc_foods`
 *   (popolata via `getOrImportFdcFood` da diary, micronutrient API e meal plan).
 * - GI / II / GL già stimati dal pipeline FDC entrano direttamente nel rollup.
 *
 * Quando una key NON è mappata:
 * - Fallback al `CANONICAL_FOOD_TABLE` TS (compatibilità a iso-funzionalità con la versione attuale).
 *
 * Estendere questo file man mano che `nutrition_fdc_foods` viene popolata con nuovi alimenti
 * italiani comuni. Lo script `apps/web/scripts/warm-usda-micros.ts` precarica i fdcId qui sotto.
 */

export const CANONICAL_FOOD_TO_FDC_ID: Record<string, number | undefined> = {
  // Verdure foglia (USDA: spinach, raw – 171688)
  mixed_veg: 171688,
  // Pesce (USDA: salmon, atlantic, farmed, raw – 173686). Generic_white usa salmon come proxy ricco di micro.
  fish_white: 173686,
  // Legumi cotti (USDA: lentils, mature seeds, cooked, boiled, without salt – 172421)
  legumes_cooked: 172421,
  // Frutta mista (USDA: blueberries, raw – 171711). Proxy "frutto rosso" ricco di vit C, polifenoli.
  mixed_fruit: 171711,
  // Yogurt (USDA: yogurt, greek, plain, nonfat – 173944)
  yogurt_plain: 173944,
  // Avena cruda (USDA: oats, raw – 173410)
  oat_dry: 173410,
  // Patata cotta (USDA: sweet potato, cooked, baked in skin, without salt – 173757)
  potato_cooked: 173757,
  // Avocado (USDA: avocados, raw, all commercial varieties – 169910)
  avocado: 169910,
  // Uovo intero (USDA: eggs, grade A, large, egg whole – 170379)
  egg_whole: 170379,

  // Mappature ancora da popolare (richiedono fdcId verificato + warmup):
  // generic_mixed: lasciato senza fdcId (è il "neutral fallback")
  // milk_2pct: ?
  // milk_goat: ?
  // banana: ?
  // bread_white: ?
  // pasta_cooked / pasta_dry: ?
  // rice_cooked / rice_dry: ?
  // farro_cooked / farro_dry: ?
  // chicken_breast: ?
  // beef_lean: ?
  // olive_oil: ?
  // cheese_hard: ?
  // crackers_whole: ?
  // deli_lean: ?
  // whey_powder: ?
  // omega_capsule: ? (probabilmente non in USDA)
};

export function fdcIdForCanonicalKey(canonicalKey: string): number | undefined {
  return CANONICAL_FOOD_TO_FDC_ID[canonicalKey];
}

/** Tutti i fdcId noti — utile per pre-caricare la cache USDA in batch. */
export function allKnownFdcIds(): number[] {
  return Object.values(CANONICAL_FOOD_TO_FDC_ID).filter((v): v is number => typeof v === "number");
}
