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
 * italiani comuni. Lo script `apps/web/scripts/warm-usda-bulk.ts` (~120 alimenti) ha precaricato la
 * cache; lo snapshot di `fdcId` verificati è in `apps/web/scripts/usda-bulk-aliases.json`.
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
  potato_cooked: 170093, // Potatoes, baked, flesh and skin, without salt
  crackers_whole: 174985, // Crackers, wheat, regular

  // Verdure (proxy ricchi di micro)
  mixed_veg: 168462, // Spinach, raw — proxy verdura foglia ricca

  // Frutta
  banana: 173944, // Bananas, raw
  mixed_fruit: 2346411, // Blueberries, raw — proxy frutta rossa ricca

  // Legumi
  legumes_cooked: 172421, // Lentils, mature seeds, cooked, boiled, without salt — proxy legumi cotti

  // Proteine animali
  egg_whole: 171287, // Egg, whole, raw, fresh
  chicken_breast: 171077, // Chicken, broiler/fryers, breast, skinless, boneless, meat only, raw
  beef_lean: 168608, // Beef, grass-fed, ground, raw
  fish_white: 175167, // Fish, salmon, Atlantic, farmed, raw — proxy pesce ricco di micro/omega
  deli_lean: 167876, // Pork, cured, ham, whole, separable lean only, unheated

  // Latticini
  milk_goat: 171278, // Milk, goat, fluid, with added vitamin D
  yogurt_plain: 171284, // Yogurt, plain, whole milk
  cheese_hard: 171247, // Cheese, parmesan, grated

  // Grassi
  olive_oil: 171413, // Oil, olive, salad or cooking
  avocado: 171705, // Avocados, raw, all commercial varieties

  // Senza fdcId (proxy interni — USDA non offre un match diretto rilevante)
  generic_mixed: undefined, // fallback neutro: non risolvere via cache
  whey_powder: undefined, // proteina whey isolata — formula sintetica, non SR Legacy
  omega_capsule: undefined, // integratore — non in USDA SR Legacy
  // Riservate per futura mappatura quando il TS table cresce:
  // farro_dry: ?  (USDA SR Legacy non ha farro raw; potrebbe usare 169745 = Spelt uncooked)
  // milk_2pct: 171267  (presente in cache ma non in TS table)
};

export function fdcIdForCanonicalKey(canonicalKey: string): number | undefined {
  return CANONICAL_FOOD_TO_FDC_ID[canonicalKey];
}

/** Tutti i fdcId noti — utile per pre-caricare la cache USDA in batch. */
export function allKnownFdcIds(): number[] {
  return Object.values(CANONICAL_FOOD_TO_FDC_ID).filter((v): v is number => typeof v === "number");
}
