/**
 * Regression: composer breakfast generava item come
 *   "Smoothie colazione" portionHint = "200 ml latte + 1 mela media + 80 g frutti di bosco (frullato)"
 *   approxKcal = 320
 *
 * Il display mostrava 80 g / 71 kcal: il parser becca il primo `\d+ g` del portionHint e scala
 * i nutrienti come se l'intero compose fosse 80 g di un singolo ingrediente. Stessa cosa con
 * "Proteine in polvere" (plurale): la regex `whey_powder` matchava solo "proteina" → cadeva in
 * `generic_mixed` → 0 kcal / 0 g.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inferCanonicalFoodKey,
  inferCanonicalFoodKeyPreferName,
  looksLikeMultiIngredientPortionHint,
  nutrientsForMealPlanItem,
} from "@/lib/nutrition/canonical-food-composition";

test("inferCanonicalFoodKey: 'Proteine in polvere' (plurale) → whey_powder", () => {
  assert.equal(inferCanonicalFoodKey("Proteine in polvere"), "whey_powder");
  assert.equal(inferCanonicalFoodKey("Proteina in polvere"), "whey_powder");
  assert.equal(inferCanonicalFoodKey("Protein powder"), "whey_powder");
  assert.equal(inferCanonicalFoodKey("Whey 25 g"), "whey_powder");
});

test("looksLikeMultiIngredientPortionHint: compose con separatore '+' o piu' quantita'", () => {
  assert.equal(
    looksLikeMultiIngredientPortionHint("200 ml latte parzialmente scremato + 1 mela media + 80 g frutti di bosco (frullato)"),
    true,
  );
  assert.equal(looksLikeMultiIngredientPortionHint("200 ml latte + 30 g avena"), true);
  assert.equal(looksLikeMultiIngredientPortionHint("80 g frutti di bosco"), false);
  assert.equal(looksLikeMultiIngredientPortionHint("28 g proteine in polvere"), false);
  assert.equal(looksLikeMultiIngredientPortionHint(""), false);
});

test("nutrientsForMealPlanItem: Smoothie colazione (compose) scala per kcal, non per 80 g del primo ingrediente", () => {
  const res = nutrientsForMealPlanItem({
    name: "Smoothie colazione",
    portionHint: "200 ml latte parzialmente scremato + 1 mela media + 80 g frutti di bosco (frullato)",
    approxKcal: 320,
  });
  assert.equal(res.compositionStatus, "canonical_estimate");
  assert.ok(
    res.nutrients.kcal >= 250 && res.nutrients.kcal <= 360,
    `kcal atteso ~320, trovato ${res.nutrients.kcal} (regression: prima 71 kcal per parser del primo 'g')`,
  );
  assert.ok(res.nutrients.carbsG >= 30, `carbs attesi >=30 g, trovati ${res.nutrients.carbsG}`);
});

test("nutrientsForMealPlanItem: 'Proteine in polvere' 28 g produce kcal/PRO non-zero", () => {
  const res = nutrientsForMealPlanItem({
    name: "Proteine in polvere",
    portionHint: "28 g proteine in polvere",
    approxKcal: 110,
  });
  assert.equal(res.compositionKey, "whey_powder");
  assert.ok(res.nutrients.kcal > 80, `kcal attesi >80, trovati ${res.nutrients.kcal} (regression: prima 0)`);
  assert.ok(res.nutrients.proteinG >= 18, `PRO attesi >=18 g, trovati ${res.nutrients.proteinG} (regression: prima 0)`);
});

test("inferCanonicalFoodKeyPreferName: priorita' al nome (porridge d'avena NON deve cadere in milk_2pct)", () => {
  /** Regression catastrofica: 85 g di "Porridge d'avena cotti in 280 ml latte"
   *  veniva mappato a milk_2pct perche' la rule `/latte\b/i` matchava prima di
   *  `/avena/i` nel testo concatenato → display 44 kcal (latte × 85 g) invece
   *  di ~310 kcal (avena secca × 85 g). */
  assert.equal(
    inferCanonicalFoodKeyPreferName("Porridge d'avena", "85 g fiocchi d'avena cotti in 280 ml latte vaccino parzialmente scremato"),
    "oat_dry",
  );
  assert.equal(inferCanonicalFoodKeyPreferName("Fiocchi d'avena", "85 g fiocchi d'avena (peso secco)"), "oat_dry");
  assert.equal(inferCanonicalFoodKeyPreferName("Yogurt greco", "150 g yogurt greco"), "yogurt_plain");
  assert.equal(inferCanonicalFoodKeyPreferName("Latte", "250 ml latte vaccino parzialmente scremato"), "milk_2pct");
});

test("nutrientsForMealPlanItem: item singolo 'Fiocchi d'avena' 85 g → ~310 kcal (regression del 44 kcal)", () => {
  const res = nutrientsForMealPlanItem({
    name: "Fiocchi d'avena",
    portionHint: "85 g fiocchi d'avena (peso secco)",
    approxKcal: 310,
  });
  assert.equal(res.compositionKey, "oat_dry");
  assert.ok(
    res.nutrients.kcal >= 280 && res.nutrients.kcal <= 360,
    `kcal attesi 280-360, trovati ${res.nutrients.kcal} (regression: prima 44 perche' mappato a milk_2pct)`,
  );
  assert.ok(res.nutrients.carbsG >= 50, `CHO attesi >=50 g, trovati ${res.nutrients.carbsG}`);
});

test("nutrientsForMealPlanItem: bevande vegetali specifiche (mandorla/riso/avena) → kcal non-zero coerenti con USDA-like", () => {
  /** Regression: prima il composer emetteva name="Bevanda vegetale" generico e
   *  inferCanonicalFoodKey non aveva una rule per matcharlo → fallback unresolved → 0 kcal.
   *  Ora il composer usa il label specifico ("Bevanda mandorla", "Bevanda riso",
   *  "Bevanda d'avena") e le rule mappano a plant_drink_almond/rice/oat. */
  const mandorla = nutrientsForMealPlanItem({
    name: "Bevanda mandorla",
    portionHint: "200 ml bevanda di mandorla non zuccherata",
    approxKcal: 50,
  });
  assert.equal(mandorla.compositionKey, "plant_drink_almond");
  assert.ok(mandorla.nutrients.kcal >= 35 && mandorla.nutrients.kcal <= 65, `mandorla 200ml kcal attese 35-65, trovate ${mandorla.nutrients.kcal}`);

  const riso = nutrientsForMealPlanItem({
    name: "Bevanda riso",
    portionHint: "200 ml bevanda di riso non zuccherata",
    approxKcal: 90,
  });
  assert.equal(riso.compositionKey, "plant_drink_rice");
  assert.ok(riso.nutrients.kcal >= 80 && riso.nutrients.kcal <= 110, `riso 200ml kcal attese 80-110, trovate ${riso.nutrients.kcal}`);

  const avena = nutrientsForMealPlanItem({
    name: "Bevanda avena",
    portionHint: "200 ml bevanda d'avena non zuccherata",
    approxKcal: 90,
  });
  assert.equal(avena.compositionKey, "plant_drink_oat");
  assert.ok(avena.nutrients.kcal >= 80 && avena.nutrients.kcal <= 110, `avena 200ml kcal attese 80-110, trovate ${avena.nutrients.kcal}`);
});

test("nutrientsForMealPlanItem: 'Bevanda vegetale' generico → fallback plant_drink_generic (non zero kcal)", () => {
  const generic = nutrientsForMealPlanItem({
    name: "Bevanda vegetale",
    portionHint: "200 ml bevanda vegetale non zuccherata",
    approxKcal: 70,
  });
  assert.equal(generic.compositionKey, "plant_drink_generic");
  assert.ok(generic.nutrients.kcal >= 50 && generic.nutrients.kcal <= 90, `generic 200ml kcal attese 50-90, trovate ${generic.nutrients.kcal}`);
});

test("nutrientsForMealPlanItem: 'Latte' 280 ml → ~145 kcal (ml → g per liquidi-latte)", () => {
  /** Regression: l'utente segnala "il latte non ha marcato le calorie nel piano".
   *  Causa: parseGramsFromHint accettava solo `g` (e `ml` solo per olio). Per il
   *  latte, 280 ml non veniva riconosciuto come quantita' edibile → fallback
   *  scaleCanonicalNutrientsToKcal con approxKcal del composer.
   *  Fix: per milk_2pct/milk_goat/yogurt_plain, ml * 1.03 g/ml. */
  const res = nutrientsForMealPlanItem({
    name: "Latte",
    portionHint: "280 ml latte vaccino parzialmente scremato",
    approxKcal: 179,
  });
  assert.equal(res.compositionKey, "milk_2pct");
  assert.ok(
    res.nutrients.kcal >= 120 && res.nutrients.kcal <= 175,
    `kcal attesi 120-175 (latte parz. scremato ~52 kcal/100ml × 280ml), trovati ${res.nutrients.kcal}`,
  );
  assert.ok(res.nutrients.proteinG >= 7, `PRO attesi >=7 g, trovati ${res.nutrients.proteinG}`);
});
