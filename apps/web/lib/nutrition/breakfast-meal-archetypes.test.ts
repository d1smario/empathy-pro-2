import assert from "node:assert/strict";
import test from "node:test";
import { composeBreakfastWithArchetypes, pickBreakfastArchetype } from "./breakfast-meal-archetypes";
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
