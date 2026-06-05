import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPathwayAdvice } from "./meal-pathway-advisor";
import {
  composeMediterraneanMeal,
  createMediterraneanDayContext,
  type MealMacroTargets,
  type MediterraneanDietType,
} from "./mediterranean-meal-composer";
import { isFruitCanonicalKey } from "./meal-composition-rules";
import type { MealSlotKey } from "./intelligent-meal-plan-types";
import { inferCanonicalFoodKeyPreferName, nutrientsForMealPlanItem } from "./canonical-food-composition";
import { buildHealthLabPathwayBridge } from "./health-lab-pathway-bridge";
import { buildActiveNutrientTargets } from "./pathway-cofactors-to-nutrient-targets";

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

/**
 * Guardrail "regole profilo": il composer DEVE rispettare denyFragments
 * (allergie, intolleranze, foodExclusions + diet implicit deny). Tutti gli
 * item emessi non devono contenere stringhe vietate nel name+portionHint.
 *
 * Regola operativa: Profile -> diet/allergies/intolerances/foodExclusions
 * passa via buildMealPlanFoodDenyFragments -> denyFragments -> composer.
 */
test("guardrail regole profilo: dieta vegan -> nessun item con carne/pesce/uova/latticini animali", () => {
  /** Fragment "latte"/"yogurt" generici NON sono vietati per vegan: il composer
   *  emette "Yogurt vegetale" e "Bevanda vegetale" che contengono quelle sottostringhe
   *  ma sono OK per vegan. Verifico fragments specifici animali. */
  const veganDeny = [
    "pollo", "tacchino", "manzo", "maiale", "agnello", "prosciutto", "salame",
    "carne", "bresaola", "bacon", "pancetta",
    "pesce", "tonno", "salmone", "sgombro", "acciug", "merluzz", "gamber",
    "calamar", "polpo", "cozze",
    "uov", "ovo", "album",
    "formaggio", "burro", "panna", "ricotta", "parmigiano",
    "mozzarella", "mascarpone", "pecorino", "whey",
    "latte vaccino", "latte di capra", "yogurt greco", "yogurt vaccino",
    "miele",
  ];
  const failures: string[] = [];

  for (const date of DATES) {
    const ctx = createMediterraneanDayContext(date, undefined, undefined, "vegan", veganDeny);
    for (const slot of SLOTS) {
      const macros = macrosForSlot(slot, 800);
      const composed = composeMediterraneanMeal(slot, macros, ctx);
      for (const it of composed.items) {
        const haystack = `${it.name} ${it.portionHint}`.toLowerCase();
        for (const fragment of veganDeny) {
          /** Match preciso: la regex evita falsi positivi su sostringhe troppo corte.
           *  "uov" ⊂ "uovo/uova" (OK) ma non in altre parole inutili.  */
          if (haystack.includes(fragment.toLowerCase())) {
            failures.push(`[vegan/${date}/${slot}] item "${it.name}" (${it.portionHint}) contiene fragment vietato "${fragment}"`);
          }
        }
      }
    }
  }

  assert.equal(
    failures.length,
    0,
    `Composer ha violato denyFragments vegan in ${failures.length} casi:\n${[...new Set(failures.map((f) => f.replace(/\[[^\]]+\]\s*/, "")))].slice(0, 20).join("\n")}`,
  );
});

test("guardrail regole profilo: foodExclusions custom (es. 'pomodoro', 'banana') -> nessun item li contiene", () => {
  const customDeny = ["pomodoro", "banana", "patate"];
  const failures: string[] = [];

  /** Test con dietType omnivore + foodExclusions custom: il deny deve passare comunque. */
  for (const date of DATES.slice(0, 3)) {
    const ctx = createMediterraneanDayContext(date, undefined, undefined, "omnivore", customDeny);
    for (const slot of SLOTS) {
      const macros = macrosForSlot(slot, 800);
      const composed = composeMediterraneanMeal(slot, macros, ctx);
      for (const it of composed.items) {
        const haystack = `${it.name} ${it.portionHint}`.toLowerCase();
        for (const fragment of customDeny) {
          if (haystack.includes(fragment.toLowerCase())) {
            failures.push(`[omnivore+excl/${date}/${slot}] item "${it.name}" contiene fragment escluso "${fragment}"`);
          }
        }
      }
    }
  }

  assert.equal(failures.length, 0, failures.slice(0, 10).join("\n"));
});

/**
 * Guardrail "alternanza settimanale": il composer DEVE alternare gli
 * staple (amido principale e fonte proteica) lungo la settimana ISO.
 *
 * Regola operativa: MAX_STAPLE_USES_PER_WEEK = 3 -> nessun staple appare
 * piu' di 3 volte in 7 giorni di pranzi/cene. Il request del meal plan
 * include `weeklyStapleCounts` accumulato giorno per giorno via
 * `recordPlanDayStaples` (localStorage) -> `aggregateStapleCountsForWeek`.
 *
 * Simulo la rotazione: per ogni giorno, ricevo `weeklyStapleCounts` dai
 * giorni precedenti, genero il pasto, aggiungo gli staple usati. Al
 * termine: nessun staple supera MAX_STAPLE_USES_PER_WEEK.
 */
test("guardrail alternanza settimanale: lunch+dinner su 7 giorni -> staple distinti >= 4 (no monotonia)", () => {
  const weeklyStapleCounts: Record<string, number> = {};
  const stapleByDay: string[][] = [];

  /** Settimana ISO simulata: lun 25 mag -> dom 31 mag 2026 */
  for (const date of DATES) {
    const ctx = createMediterraneanDayContext(
      date,
      { ...weeklyStapleCounts },
      undefined,
      "omnivore",
      undefined,
    );
    /** Genera lunch + dinner del giorno: i pasti principali sono quelli che variano gli staple. */
    composeMediterraneanMeal("lunch", macrosForSlot("lunch", 1100), ctx);
    composeMediterraneanMeal("dinner", macrosForSlot("dinner", 900), ctx);
    const dayStaples = [...ctx.usedStaples];
    stapleByDay.push(dayStaples);
    for (const s of dayStaples) {
      weeklyStapleCounts[s] = (weeklyStapleCounts[s] ?? 0) + 1;
    }
  }

  /** Nessun staple deve superare MAX_STAPLE_USES_PER_WEEK = 3. */
  const violations = Object.entries(weeklyStapleCounts).filter(([, n]) => n > 3);
  assert.equal(
    violations.length,
    0,
    `Alternanza violata: ${violations.map(([k, n]) => `${k}=${n}`).join(", ")} (max 3 in 7 giorni). Dettaglio:\n${stapleByDay.map((d, i) => `${DATES[i]}: ${d.join(", ")}`).join("\n")}`,
  );

  /** Varianza minima: su 7 giorni di lunch+dinner devono comparire almeno 4 carb staple distinti
   *  (CARB_ORDER = pasta/riso/farro/patate/pane/quinoa/... oltre); altrimenti il composer e' monotono. */
  const carbStaples = Object.keys(weeklyStapleCounts).filter((k) => k.startsWith("carb:"));
  assert.ok(
    carbStaples.length >= 4,
    `Solo ${carbStaples.length} carb staple distinti su 7 giorni: ${carbStaples.join(", ")}. Atteso >= 4.`,
  );

  /** Stessa cosa per le proteine animali (omnivore deve variare). */
  const protStaples = Object.keys(weeklyStapleCounts).filter((k) => k.startsWith("prot:"));
  assert.ok(
    protStaples.length >= 4,
    `Solo ${protStaples.length} prot staple distinti su 7 giorni: ${protStaples.join(", ")}. Atteso >= 4.`,
  );
});

/**
 * Guardrail "regole composizione CHO" (utente nutrizionista):
 *
 * COLAZIONE:
 *  - CHO target >= 130 g -> 2 fonti CHO distinte (es. cereali + pane tostato).
 *
 * PRANZO / CENA:
 *  - CHO target > 100 g -> pane NON puo' essere il carb principale (deve essere
 *    pasta/riso/farro/quinoa/patate).
 *  - CHO target >= 130 g -> 2 fonti CHO: primaria (complessa) + secondaria
 *    (pane/focaccia/patate).
 */

function countChoHeavyItems(items: { macroRole?: string }[]): number {
  return items.filter((i) => i.macroRole === "cho_heavy").length;
}

function hasBreadAsPrimaryCarb(items: { name?: string; macroRole?: string }[]): boolean {
  /** "Pane integrale (carb principale ...)" e' il name che composeMainMeal usa
   *  quando carbKey === "pane" (label esplicito). La 2a fonte usa name diverso
   *  ("Pane / focaccia (2ª fonte CHO)" o "(accompagnamento)"). */
  return items.some((i) => /^pane integrale\s*\(carb principale/i.test(i.name ?? ""));
}

test("guardrail composizione CHO pranzo/cena: cho > 100 g -> pane NON e' carb principale", () => {
  const failures: string[] = [];
  /** Range CHO 110-220 g via kcal 1100-2200 (50% CHO ~ 137-275 g). */
  const lunchKcalSweep = [1100, 1300, 1500, 1800, 2000, 2200];
  for (const date of DATES) {
    for (const dietType of DIET_TYPES) {
      const ctx = createMediterraneanDayContext(date, undefined, undefined, dietType);
      for (const slot of ["lunch", "dinner"] as MealSlotKey[]) {
        for (const kcal of lunchKcalSweep) {
          const macros = macrosForSlot(slot, kcal);
          if (macros.carbsG <= 100) continue;
          const composed = composeMediterraneanMeal(slot, macros, ctx);
          if (hasBreadAsPrimaryCarb(composed.items)) {
            failures.push(
              `[${dietType}/${date}/${slot}/${kcal}kcal/cho=${macros.carbsG}g] pane usato come CARB PRINCIPALE (vietato per CHO > 100 g)`,
            );
          }
        }
      }
    }
  }
  assert.equal(
    failures.length,
    0,
    `Regola violata in ${failures.length} casi:\n${failures.slice(0, 15).join("\n")}`,
  );
});

test("guardrail composizione CHO pranzo/cena: cho >= 130 g -> 2 fonti CHO (primaria + secondaria)", () => {
  const failures: string[] = [];
  /** Range CHO >= 130 g via kcal alti. */
  const kcalSweep = [1300, 1500, 1700, 2000];
  for (const date of DATES.slice(0, 3)) {
    for (const dietType of DIET_TYPES) {
      const ctx = createMediterraneanDayContext(date, undefined, undefined, dietType);
      for (const slot of ["lunch", "dinner"] as MealSlotKey[]) {
        for (const kcal of kcalSweep) {
          const macros = macrosForSlot(slot, kcal);
          if (macros.carbsG < 130) continue;
          const composed = composeMediterraneanMeal(slot, macros, ctx);
          const choHeavyCount = countChoHeavyItems(composed.items);
          if (choHeavyCount < 2) {
            failures.push(
              `[${dietType}/${date}/${slot}/${kcal}kcal/cho=${macros.carbsG}g] solo ${choHeavyCount} item cho_heavy (atteso >= 2: primaria + secondaria). Items: ${composed.items.map((i) => i.name).join(" | ")}`,
            );
          }
        }
      }
    }
  }
  assert.equal(
    failures.length,
    0,
    `Regola violata in ${failures.length} casi:\n${failures.slice(0, 10).join("\n")}`,
  );
});

test("guardrail composizione CHO colazione: cho >= 130 g -> 2 fonti CHO solide distinte", () => {
  const failures: string[] = [];
  /** Colazione con CHO >= 130 g: kcal >= ~1040 con 50% CHO. */
  const kcalSweep = [1040, 1280, 1500, 1800];
  for (const date of DATES) {
    for (const dietType of DIET_TYPES) {
      const ctx = createMediterraneanDayContext(date, undefined, undefined, dietType);
      const macrosArr = kcalSweep.map((k) => ({ k, m: macrosForSlot("breakfast", k) }));
      for (const { k, m } of macrosArr) {
        if (m.carbsG < 130) continue;
        const composed = composeMediterraneanMeal("breakfast", m, ctx);
        /** Non basta contare item cho_heavy: la frutta lo e' anche lei. Conto SOLO le fonti
         *  CHO complesse solide (cereali, pane, fette, avena, muesli, granola, quinoa, ...). */
        const complexCarbRe = /(pane|cereali|cereale|fiocchi|avena|muesli|granola|fette\s+biscottate|farro|orzo)/i;
        const complexSolidSources = composed.items.filter(
          (i) => i.macroRole === "cho_heavy" && complexCarbRe.test(`${i.name} ${i.portionHint}`),
        );
        if (complexSolidSources.length < 2) {
          failures.push(
            `[${dietType}/${date}/breakfast/${k}kcal/cho=${m.carbsG}g] solo ${complexSolidSources.length} fonte CHO solida complessa (atteso >= 2). Items: ${composed.items.map((i) => i.name).join(" | ")}`,
          );
        }
      }
    }
  }
  assert.equal(
    failures.length,
    0,
    `Regola violata in ${failures.length} casi:\n${failures.slice(0, 12).join("\n")}`,
  );
});

test("pathway folato: lunch non stacka legumi — solo consiglio sostituzione", () => {
  const ctx = createMediterraneanDayContext("2026-05-30", undefined, undefined, "omnivore", undefined, undefined);
  const macros = { kcal: 900, carbsG: 110, proteinG: 45, fatG: 28 };
  const base = composeMediterraneanMeal("lunch", macros, ctx);
  const { meal, adviceNotes } = applyPathwayAdvice(base, "lunch", ["folate_mcg"], ctx);
  assert.equal(meal.items.length, base.items.length);
  const keys = meal.items.map((i) => inferCanonicalFoodKeyPreferName(i.name, i.portionHint));
  assert.ok(!keys.includes("legumes_cooked"), `Legumi non devono essere aggiunti a pranzo, got: ${keys.join(", ")}`);
  assert.ok(adviceNotes.length > 0, "Atteso almeno una nota pathway");
});

test("pathway folato: colazione non usa legumi — integrazione se non coperto", () => {
  const ctx = createMediterraneanDayContext("2026-05-30", undefined, undefined, "omnivore", undefined, undefined);
  const macros = { kcal: 550, carbsG: 70, proteinG: 28, fatG: 16 };
  const { meal } = applyPathwayAdvice(
    composeMediterraneanMeal("breakfast", macros, ctx),
    "breakfast",
    ["folate_mcg"],
    ctx,
  );
  const keys = meal.items.map((i) => inferCanonicalFoodKeyPreferName(i.name, i.portionHint));
  assert.ok(!keys.includes("legumes_cooked"), `Legumi non ammessi a colazione, got: ${keys.join(", ")}`);
});

test("pathway redox vit C: lunch non aggiunge frutta — solo peperone come consiglio", () => {
  const ctx = createMediterraneanDayContext("2026-05-30", undefined, undefined, "omnivore", undefined, undefined);
  const macros = { kcal: 850, carbsG: 100, proteinG: 42, fatG: 26 };
  const base = composeMediterraneanMeal("lunch", macros, ctx);
  const { meal, adviceNotes } = applyPathwayAdvice(base, "lunch", ["vitC_mg"], ctx);
  const keys = meal.items.map((i) => inferCanonicalFoodKeyPreferName(i.name, i.portionHint));
  assert.ok(!keys.some((k) => isFruitCanonicalKey(k)), `Nessuna frutta a pranzo, got: ${keys.join(", ")}`);
  assert.ok(
    adviceNotes.some((n) => n.toLowerCase().includes("peperone") || n.toLowerCase().includes("pathway")),
    `Atteso consiglio pathway, got: ${adviceNotes.join(" | ")}`,
  );
});

test("pathway lab ferro: ferritina bassa → lunch aggiunge ferro vegetale (fe_mg)", () => {
  const bridge = buildHealthLabPathwayBridge({
    blood: { ferritin_ng_ml: 22 },
    panels: [{ type: "blood", values: { ferritin_ng_ml: 22 } }],
    systemicModulationSnapshots: [],
  });
  const targets = buildActiveNutrientTargets({ cofactorStrings: bridge.cofactorStrings });
  const targetIds = targets.map((t) => t.nutrientId);
  assert.ok(targetIds.includes("fe_mg"), `Atteso fe_mg da lab bridge, got: ${targetIds.join(", ")}`);

  const ctx = createMediterraneanDayContext("2026-05-30", undefined, undefined, "omnivore", undefined, undefined);
  const macros = { kcal: 900, carbsG: 110, proteinG: 45, fatG: 28 };
  const base = composeMediterraneanMeal("lunch", macros, ctx);
  const { meal, adviceNotes } = applyPathwayAdvice(base, "lunch", targetIds, ctx);
  assert.equal(meal.items.length, base.items.length, "Pathway non deve aggiungere voci a pranzo");
  assert.ok(adviceNotes.length > 0, "Atteso consiglio integrazione/sostituzione ferro");
});
