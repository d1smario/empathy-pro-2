import assert from "node:assert/strict";
import test from "node:test";
import {
  composeBreakfastByArchetype,
  composeBreakfastWithArchetypes,
  pickBreakfastArchetype,
} from "./breakfast-meal-archetypes";
import { composeMediterraneanMeal, createMediterraneanDayContext } from "./mediterranean-meal-composer";

const MACROS = { kcal: 420, carbsG: 55, proteinG: 18, fatG: 12 };

test("pickBreakfastArchetype: 7 giorni consecutivi producono almeno 3 archetipi distinti", () => {
  const seen = new Set<string>();
  for (let d = 1; d <= 7; d += 1) {
    const date = `2026-05-${String(d).padStart(2, "0")}`;
    const ctx = createMediterraneanDayContext(date);
    const seed = 900 + d;
    seen.add(pickBreakfastArchetype(seed, ctx));
  }
  assert.ok(seen.size >= 3, `expected variety, got ${[...seen].join(", ")}`);
});

test("composeBreakfastWithArchetypes: nessun latte di capra nel pool standard", () => {
  const ctx = createMediterraneanDayContext("2026-05-10");
  const meal = composeBreakfastWithArchetypes(MACROS, 1200, ctx);
  const text = meal.lines.join(" ").toLowerCase();
  assert.equal(text.includes("capra"), false);
});

test("composeMediterraneanMeal breakfast: registra staple breakfast:* per rotazione settimanale", () => {
  const ctx = createMediterraneanDayContext("2026-05-11");
  composeMediterraneanMeal("breakfast", MACROS, ctx);
  const staples = [...ctx.usedStaples].filter((s) => s.startsWith("breakfast:"));
  assert.equal(staples.length, 1);
});

test("composeMediterraneanMeal breakfast: date diverse cambiano la prima voce principale", () => {
  const a = composeMediterraneanMeal(
    "breakfast",
    MACROS,
    createMediterraneanDayContext("2026-05-12"),
  ).lines[0];
  const b = composeMediterraneanMeal(
    "breakfast",
    MACROS,
    createMediterraneanDayContext("2026-05-13"),
  ).lines[0];
  assert.notEqual(a, b);
});

/**
 * Regression: prima di questo fix gli archetipi avevano upper cap hardcoded
 * sulle porzioni CHO solido (cerealG max 78 g, breadG max 95 g, ecc.). Per un
 * target endurance (es. colazione da ~1152 kcal / 202 g CHO) la somma kcal
 * dell'archetipo si fermava intorno ai 460 kcal e CHO ~80 g, indipendentemente
 * dal target. Lo `smoothie` era il caso peggiore: solo bev + frutta, niente
 * cereale solido, max ~50 g CHO. Adesso le porzioni CHO scalano col target del
 * solver (niente upper cap), e lo smoothie ha un cereale solido a fianco.
 */
const HIGH_BREAKFAST_TARGET = { kcal: 1152, carbsG: 202, proteinG: 37, fatG: 22 };

test("composeBreakfastWithArchetypes: target alto (202 g CHO) → ogni archetipo copre >= 70% del CHO target", () => {
  const archetypes = ["cereals_milk", "porridge", "toast_jam", "rusks", "yogurt_bowl", "smoothie"];
  for (let i = 0; i < archetypes.length; i += 1) {
    /** Seed scelti per pescare archetipi diversi nella settimana. */
    const date = `2026-06-${String(1 + i * 2).padStart(2, "0")}`;
    const ctx = createMediterraneanDayContext(date);
    const meal = composeBreakfastWithArchetypes(HIGH_BREAKFAST_TARGET, 1000 + i, ctx);
    /** kcal totali del compose: ora deve raggiungere almeno il 70% del target. */
    assert.ok(
      meal.totalApproxKcal >= HIGH_BREAKFAST_TARGET.kcal * 0.7,
      `kcal compose ${meal.totalApproxKcal} < 70% target ${HIGH_BREAKFAST_TARGET.kcal} (regression: prima ~460 kcal a prescindere dal target)`,
    );
  }
});

test("composeBreakfastByArchetype('smoothie'): include un cereale solido (avena) per il CHO + item singoli", () => {
  const ctx = createMediterraneanDayContext("2026-08-15");
  const meal = composeBreakfastByArchetype("smoothie", HIGH_BREAKFAST_TARGET, 7777, ctx);
  /** Regression: lo smoothie da solo (bev + frutta + extra) copre ~50 g CHO indipendentemente
   *  dal target. Adesso include un cereale solido (avena) come item separato per coprire CHO. */
  const hasSolidCho = meal.items.some((it) => /avena|fiocchi/i.test(`${it.name} ${it.portionHint}`));
  assert.ok(hasSolidCho, `smoothie senza cereale solido: items=${meal.items.map((x) => x.name).join("|")}`);
  /** Nessun item deve essere "compose" multi-ingrediente (separatore " + " nel portionHint),
   *  altrimenti il lookup USDA non sa quale alimento scalare. */
  for (const it of meal.items) {
    assert.ok(
      !(it.portionHint ?? "").includes(" + "),
      `item compose multi-ingrediente trovato: '${it.name}' portionHint='${it.portionHint}'`,
    );
  }
});

test("yogurt_bowl: una sola fonte yogurt greco (no doppio kefir)", () => {
  const ctx = createMediterraneanDayContext("2026-06-05", undefined, undefined, "omnivore");
  const meal = composeBreakfastByArchetype(
    "yogurt_bowl",
    { kcal: 550, carbsG: 70, proteinG: 28, fatG: 16 },
    42,
    ctx,
  );
  const yogurtItems = meal.items.filter((i) => /yogurt/i.test(i.name));
  assert.equal(yogurtItems.length, 1, `Attesa 1 voce yogurt, got: ${yogurtItems.map((i) => i.name).join(", ")}`);
  assert.match(yogurtItems[0]!.name, /greco/i);
  assert.ok(!meal.items.some((i) => /kefir/i.test(i.name)));
});

test("composeBreakfastByArchetype('porridge' | 'yogurt_bowl'): item singoli, niente compose", () => {
  const ctx = createMediterraneanDayContext("2026-08-16");
  for (const archetype of ["porridge", "yogurt_bowl"] as const) {
    const meal = composeBreakfastByArchetype(archetype, HIGH_BREAKFAST_TARGET, 8888, ctx);
    for (const it of meal.items) {
      assert.ok(
        !(it.portionHint ?? "").includes(" + "),
        `[${archetype}] item compose multi-ingrediente: '${it.name}' portionHint='${it.portionHint}'`,
      );
    }
  }
});
