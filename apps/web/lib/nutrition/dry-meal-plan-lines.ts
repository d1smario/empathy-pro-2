/**
 * Piano alimentare “secco” per UI: quantità + alimento, senza paragrafi di fisiologia.
 * Euristiche da nomi curati/USDA + macro dello slot (non sostituisce un dietologo).
 */

import type { IntelligentMealPlanFunctionalFoodGroup, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { composeMediterraneanMeal } from "@/lib/nutrition/mediterranean-meal-composer";
import {
  pathwayTargetsMissingFoodCoverage,
  pruneSnackDryLineConflicts,
  supplementHintLinesForUncoveredTargets,
} from "@/lib/nutrition/meal-slot-food-rules";

export type DryMealSlotMacros = {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Porzione leggibile da etichetta alimento (italiano / inglese comune). */
export function dryPortionLineForFoodLabel(label: string, slot: DryMealSlotMacros, itemIndex: number): string {
  const raw = label.trim();
  const l = raw.toLowerCase();

  if (/yogurt\s*greco|greek\s*yogurt/.test(l)) return `150–200 g yogurt greco (${raw.split(/[,(]/)[0]?.trim() ?? "yogurt"})`;
  if (/\byogurt\b/.test(l) && !/greco/.test(l)) return `125–180 g yogurt`;
  if (/\blatte\b/.test(l) && !/cereal/.test(l)) return `${clamp(180 + itemIndex * 20, 150, 280)} ml latte`;
  if (/cereal|avena|oat|muesli/.test(l)) return `${clamp(slot.carbsG * 0.12 + 25, 35, 65)} g cereali`;
  if (/pane|bread/.test(l)) return `${clamp(40 + slot.carbsG * 0.08, 40, 90)} g pane`;
  if (/pasta|riso|rice|orzo|farro/.test(l))
    return `${clamp(55 + slot.carbsG * 0.15, 60, 120)} g ${raw.split(/[,(]/)[0]?.trim() ?? "carboidrato"} (peso a crudo/secco per pasta, riso, farro e orzo)`;
  if (/banana/.test(l)) return "1 banana media (matura se post-workout)";
  if (/mela|apple/.test(l)) return "1 mela media";
  if (/mirtill|blueberry/.test(l)) return `${clamp(30 + itemIndex * 15, 30, 80)} g mirtilli`;
  if (/frutti\s*di\s*bosco|berries/.test(l)) return `${clamp(50, 40, 100)} g frutti di bosco`;
  if (/spinaci|bietol|cicoria|chard/.test(l))
    return `${clamp(80 + itemIndex * 20, 70, 150)} g ${raw.split(/[,(]/)[0]?.trim() ?? "verdura a foglia"}`;
  if (/lenticch|ceci|cece|chickpea|legum/.test(l)) return `${clamp(80 + slot.proteinG * 2, 70, 130)} g legumi cotti`;
  if (/patat|potato/.test(l)) return `${clamp(150 + slot.carbsG * 2, 150, 280)} g patate (cotte)`;
  if (/uov|egg/.test(l)) return `${slot.proteinG > 35 ? 3 : 2} uova medie`;
  if (/whey|proteina\s*in\s*polvere|protein\s*powder/.test(l)) return `${clamp(20 + slot.proteinG * 0.35, 15, 40)} g proteine in polvere`;
  if (/petto|pollo|chicken|tacchino|turkey/.test(l)) return `${clamp(120 + slot.proteinG * 2.2, 100, 220)} g petto di pollo/tacchino`;
  if (/tonno|sgombro|salmone|pesce|fish|tuna|mackerel|salmon/.test(l)) return `${clamp(100 + slot.proteinG * 1.8, 90, 200)} g ${raw.split(/[,(]/)[0]?.trim() ?? "pesce"}`;
  if (/manzo|beef|maiale|pork|prosciutto/.test(l)) return `${clamp(100 + slot.proteinG * 1.5, 90, 180)} g carne magra`;
  if (/mandorl|noci|walnut|almond|semi\s*di\s*zucca|pumpkin\s*seed/.test(l)) return `${clamp(15 + slot.fatG * 1.2, 15, 45)} g frutta secca / semi`;
  if (/olio|evo|olive\s*oil/.test(l)) return `${clamp(8 + slot.fatG * 0.4, 8, 20)} ml olio EVO`;
  if (/cioccolat|dark\s*chocolate/.test(l)) return `${clamp(20, 15, 40)} g cioccolato fondente`;
  if (/arachid|peanut/.test(l)) return `${clamp(25, 20, 45)} g arachidi (o burro di arachidi equivalente)`;
  if (/formaggio|cheese|parmesan|parmigiano/.test(l)) return `${clamp(30 + itemIndex * 10, 25, 60)} g formaggio`;
  if (/cottage/.test(l)) return `150–200 g cottage cheese`;
  if (/avocado/.test(l)) return `½–1 avocado (≈70–140 g polpa)`;
  if (/barbabiet|beet/.test(l)) return `150–200 ml succo barbabietola (o porzione equivalente)`;
  if (/rucol|arugul|rocket/.test(l)) return `40–80 g rucola`;
  if (/broccoli|peperon|verdur|insalat|salad/.test(l)) return `${clamp(120, 100, 220)} g verdure`;
  if (/kiwi|agrum|arancia|orange/.test(l)) return "1 porzione frutta (~150 g)";

  const g = clamp(40 + slot.kcal / (itemIndex + 4), 35, 90);
  return `${g} g (porzione indicativa) — ${raw.split(",")[0]?.trim() ?? raw}`;
}

/** Ordine etichette: curated prima, poi USDA, dedupe. */
export function collectOptionLabelsFromGroups(
  groups: Array<{ options: Array<{ label: string; source: string }> }>,
  max = 8,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    const k = label.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(label.trim());
  };
  for (const g of groups) {
    for (const o of g.options) {
      if (o.source === "curated") push(o.label);
      if (out.length >= max) return out;
    }
  }
  for (const g of groups) {
    for (const o of g.options) {
      if (o.source !== "curated") push(o.label);
      if (out.length >= max) return out;
    }
  }
  return out;
}

function fallbackDryLinesForMealSlot(mealSlotKey: MealSlotKey, slot: DryMealSlotMacros): string[] {
  if (mealSlotKey === "breakfast") {
    return [
      `${clamp(160 + slot.kcal * 0.02, 120, 280)} ml latte o bevanda vegetale`,
      `${clamp(slot.carbsG * 0.1 + 30, 35, 65)} g cereali o fiocchi d’avena`,
      "1 frutta oppure 60–100 g frutti di bosco / lamponi",
    ];
  }
  if (mealSlotKey === "snack_am") {
    return [
      "125–200 g yogurt o 180 ml latte",
      "1 frutto di stagione o frutti di bosco",
      `${clamp(15 + slot.kcal * 0.02, 12, 32)} g cereali / muesli`,
    ];
  }
  if (mealSlotKey === "snack_pm") {
    return [
      "40–55 g gallette integrali o pane tostato",
      "50–70 g affettato magro o hummus",
      `${clamp(18 + slot.fatG * 0.45, 15, 38)} g frutta secca o olio su cracker`,
    ];
  }
  return [
    `${clamp(slot.carbsG * 0.25, 30, 90)} g carboidrato (pasta / riso / pane / patate) — pasto principale`,
    `${clamp(slot.proteinG * 0.35, 25, 55)} g proteine (carne / pesce / legumi / latticini)`,
    `${clamp(slot.fatG * 0.35, 10, 28)} g grassi (olio EVO / frutta secca / avocado)`,
  ];
}

export function buildDryMealPlanLinesForSlot(
  mealSlotKey: MealSlotKey,
  slot: DryMealSlotMacros,
  groups: IntelligentMealPlanFunctionalFoodGroup[],
  pathwayTargets?: Array<{ nutrientId: string; displayNameIt: string }>,
): string[] {
  const composed = composeMediterraneanMeal(mealSlotKey, slot);
  let out = [...composed.lines];

  const targets = pathwayTargets ?? [];
  const uncovered = pathwayTargetsMissingFoodCoverage(targets, groups);
  out = [...out, ...supplementHintLinesForUncoveredTargets(mealSlotKey, uncovered, 2)];

  if (mealSlotKey === "snack_am" || mealSlotKey === "snack_pm") out = pruneSnackDryLineConflicts(out);

  if (out.length < 3) {
    out = [...out, ...fallbackDryLinesForMealSlot(mealSlotKey, slot)];
  }
  return out.slice(0, 10);
}
