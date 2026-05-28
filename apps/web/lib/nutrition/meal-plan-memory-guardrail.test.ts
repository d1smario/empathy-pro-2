import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composeMediterraneanMeal,
  createMediterraneanDayContext,
  type MealMacroTargets,
  type MediterraneanDietType,
} from "./mediterranean-meal-composer";
import type { MealSlotKey } from "./intelligent-meal-plan-types";
import { nutrientsForMealPlanItem } from "./canonical-food-composition";

/**
 * Guardrail "memoria-driven" del sistema generativo meal plan.
 *
 * REGOLA OPERATIVA (empathy_nutrition_diet_meal_plan_generative.mdc, Reg. 2 +
 * empathy_generative_core.mdc): gli alimenti sono nella memoria
 * (CANONICAL_FOOD_TABLE + USDA FDC cache). Il composer deterministico PESCA
 * dalla memoria via canonical key e identifica le quantita' per coprire i
 * target macro dello slot. Nessun item puo' essere emesso con un name che
 * non risolve a un canonical key valido (compositionStatus="unresolved" =
 * 0 kcal silenzioso = bug strutturale).
 *
 * Questo test esercita TUTTI gli slot del meal plan, per TUTTI i dietType
 * supportati, su un range di target kcal/macro plausibili, e fallisce se
 * QUALSIASI item generato cade in unresolved o ha kcal = 0 con quantita'
 * non-zero. Regression target dei bug:
 *  - "Bevanda vegetale 0 kcal"  (name generico senza rule INFER)
 *  - "Porridge d'avena 44 kcal" (compose multi-ingredient mappato a milk_2pct)
 *  - "Latte 0 kcal"             (ml senza scaling g per liquidi-latte)
 */

const SLOTS: MealSlotKey[] = [
  "breakfast",
  "snack_am",
  "lunch",
  "snack_pm",
  "dinner",
  "snack_evening",
];

const DIET_TYPES: MediterraneanDietType[] = [
  "omnivore",
  "vegetarian",
  "pescatarian",
  "vegan",
];

/** Range realistico: snack ~150-300 kcal, pasti principali 500-1500 kcal. */
function macrosForSlot(slot: MealSlotKey, kcal: number): MealMacroTargets {
  /** CHO 50% / PRO 20% / FAT 30% — generico. Il composer adatta. */
  const choKcal = kcal * 0.5;
  const proKcal = kcal * 0.2;
  const fatKcal = kcal * 0.3;
  return {
    kcal: Math.round(kcal),
    carbsG: Math.round(choKcal / 4),
    proteinG: Math.round(proKcal / 4),
    fatG: Math.round(fatKcal / 9),
  };
}

/** Date diversificate per esercitare planDateHash → archetipi e selezioni diverse. */
const DATES = ["2026-05-25", "2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31"];

const KCAL_RANGES: Record<MealSlotKey, number[]> = {
  breakfast: [600, 900, 1280, 1500],
  lunch: [700, 1100, 1493, 1700],
  dinner: [600, 900, 1066, 1300],
  snack_am: [120, 220, 320],
  snack_pm: [120, 220, 320],
  snack_evening: [120, 220, 320],
};

test("guardrail memoria: ogni item del composer risolve a canonical key + kcal > 0 (no unresolved silenzioso)", () => {
  const failures: string[] = [];
  let totalItems = 0;

  for (const dietType of DIET_TYPES) {
    for (const date of DATES) {
      const ctx = createMediterraneanDayContext(date, undefined, undefined, dietType, undefined, undefined);
      for (const slot of SLOTS) {
        const kcalRange = KCAL_RANGES[slot];
        for (const kcal of kcalRange) {
          const macros = macrosForSlot(slot, kcal);
          const composed = composeMediterraneanMeal(slot, macros, ctx);
          for (const it of composed.items) {
            totalItems += 1;
            const res = nutrientsForMealPlanItem({
              name: it.name,
              portionHint: it.portionHint,
              approxKcal: it.approxKcal,
            });
            if (res.compositionStatus === "unresolved") {
              failures.push(
                `[${dietType}/${date}/${slot}/${kcal}kcal] item "${it.name}" (${it.portionHint}) -> compositionStatus="unresolved" (missing rule INFER o canonical row)`,
              );
              continue;
            }
            if (res.nutrients.kcal <= 0 && it.approxKcal > 0) {
              failures.push(
                `[${dietType}/${date}/${slot}/${kcal}kcal] item "${it.name}" approxKcal=${it.approxKcal} risolto a key="${res.compositionKey}" ma scaled kcal=${res.nutrients.kcal}`,
              );
            }
          }
        }
      }
    }
  }

  assert.ok(
    failures.length === 0,
    `Composer ha emesso ${failures.length} item non risolvibili dalla memoria canonica su ${totalItems} totali:\n${[...new Set(failures.map((f) => f.replace(/\[[^\]]+\]\s*/, "")))].slice(0, 60).join("\n")}`,
  );
  assert.ok(totalItems > 100, `Test smoke insufficiente: solo ${totalItems} item esercitati (atteso > 100)`);
});

test("guardrail memoria: nessun item emesso dal composer ha name vuoto o portionHint vuoto", () => {
  const failures: string[] = [];

  for (const dietType of DIET_TYPES) {
    const ctx = createMediterraneanDayContext("2026-05-28", undefined, undefined, dietType);
    for (const slot of SLOTS) {
      const macros = macrosForSlot(slot, 800);
      const composed = composeMediterraneanMeal(slot, macros, ctx);
      for (const it of composed.items) {
        if (!it.name?.trim()) failures.push(`[${dietType}/${slot}] item con name vuoto`);
        if (!it.portionHint?.trim()) failures.push(`[${dietType}/${slot}] item "${it.name}" con portionHint vuoto`);
      }
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"));
});
