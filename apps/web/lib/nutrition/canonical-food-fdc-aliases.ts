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
 * Estendere questo file man mano che `nutrition_fdc_foods` viene popolata (dump USDA Foundation+SR
 * via `import-usda-fdc-dump.ts`, oppure warm `warm-usda-bulk.ts`). Report alias: `usda-bulk-aliases.json`.
 * Meal plan legge la cache in batch (`loadFdcFoodsByIds`); con `FDC_CACHE_ONLY=1` niente USDA live.
 *
 * IMPORTANTE: quando aggiungi una mappatura, verifica che la `description` del `fdcId` sia
 * davvero coerente con il nome canonicalKey. USDA `foods/search` può restituire match per parole
 * comuni (es. cercando "Chickpeas, mature seeds, cooked, boiled" matchava "Lentils, mature seeds,
 * cooked, boiled" perché condividono 4 parole su 5). Lo script `warm-usda-corrections.ts` applica
 * filtri `mustContain` / `mustNotContain` per evitare questi mismatch.
 */

export const CANONICAL_FOOD_TO_FDC_ID: Record<string, number | undefined> = {
  // Cereali e amidi
  bread_white: 174925, // Bread, white, commercially prepared, toasted
  pasta_cooked: 168928, // Pasta, cooked, unenriched, without added salt
  pasta_dry: 168927, // Pasta, dry, unenriched
  rice_cooked: 169757, // Rice, white, long-grain, regular, unenriched, cooked without salt
  rice_dry: 169756, // Rice, white, long-grain, regular, raw, unenriched
  oat_dry: 172989, // Cereals, QUAKER, Quick Oats, Dry (proxy SR Legacy per fiocchi avena secchi)
  farro_cooked: 169746, // Spelt, cooked (farro = spelt USDA)
  farro_dry: 169746, // proxy spelt — macro da TS table se mismatch
  quinoa_dry: 168874, // Quinoa, uncooked
  tofu_firm: 172475,
  tempeh: 174272,
  potato_cooked: 170093, // Potatoes, baked, flesh and skin, without salt
  crackers_whole: 174985, // Crackers, wheat, regular

  // Verdure
  mixed_veg: 168462, // Spinach, raw — proxy verdura foglia generica
  spinach_raw: 168462,
  kale_raw: 168421,
  broccoli_raw: 170379,
  bell_pepper_red: 170108,
  asparagus_raw: 168389,
  beetroot_raw: 2685576,
  arugula_raw: 169387,
  zucchini_raw: 169291,
  tomato_raw: 170457,
  carrot_raw: 170393,
  lettuce_romaine: 169247,

  // Frutta
  banana: 173944,
  mixed_fruit: 2346411, // Blueberries, raw — proxy frutta rossa ricca
  orange_raw: 169097,
  kiwi_raw: 327046,
  strawberries_raw: 167762,
  apple_raw: 1750340,
  blueberries_raw: 2346411,
  pear_raw: 169118,

  // Legumi
  legumes_cooked: 172421, // Lentils, mature seeds, cooked, boiled, without salt
  chickpeas_cooked: 173799,

  // Semi / snack
  pumpkin_seeds_raw: 170556,
  almonds_raw: 2346393,
  dark_chocolate_70: 170273,

  // Proteine animali
  egg_whole: 171287,
  chicken_breast: 171077,
  beef_lean: 168608,
  fish_white: 175167, // Fish, salmon, Atlantic, farmed, raw — proxy pesce ricco di micro/omega
  deli_lean: 167876,

  // Latticini
  milk_goat: 171278,
  yogurt_plain: 171284,
  cheese_hard: 171247,
  ricotta_cheese: 170851,
  cottage_cheese: 173417,

  // Grassi
  olive_oil: 171413,
  avocado: 171705,

  // Senza fdcId (proxy interni — USDA non offre un match diretto rilevante)
  generic_mixed: undefined,
  whey_powder: undefined,
  omega_capsule: undefined,
};

export function fdcIdForCanonicalKey(canonicalKey: string): number | undefined {
  return CANONICAL_FOOD_TO_FDC_ID[canonicalKey];
}

/** Tutti i fdcId noti — utile per pre-caricare la cache USDA in batch. */
export function allKnownFdcIds(): number[] {
  return [...new Set(Object.values(CANONICAL_FOOD_TO_FDC_ID).filter((v): v is number => typeof v === "number"))];
}
