/**
 * Archetipi colazione deterministici — rotazione settimanale via `breakfast:*` staple keys.
 * Convogliato dal composer mediterraneo (unica pipeline meal-plan).
 */

import type { IntelligentMealPlanItemOut } from "@/lib/nutrition/intelligent-meal-plan-types";

export type BreakfastArchetype =
  | "cereals_milk"
  | "porridge"
  | "toast_jam"
  | "rusks"
  | "yogurt_bowl"
  | "smoothie";

type MealMacroTargets = {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

type MediterraneanDietType = "omnivore" | "vegetarian" | "pescatarian" | "vegan";

type MediterraneanDayContext = {
  planDate: string;
  usedStaples: Set<string>;
  weekStapleCounts?: Record<string, number>;
  dietType?: MediterraneanDietType;
  denyFragments?: string[];
};

export type MediterraneanComposedMeal = {
  lines: string[];
  items: IntelligentMealPlanItemOut[];
  totalApproxKcal: number;
};

const BREAKFAST_ARCHETYPE_ORDER: BreakfastArchetype[] = [
  "cereals_milk",
  "porridge",
  "toast_jam",
  "rusks",
  "yogurt_bowl",
  "smoothie",
];

const BREAKFAST_ARCHETYPE_DENY: Record<BreakfastArchetype, readonly string[]> = {
  cereals_milk: [],
  porridge: ["avena", "oat"],
  toast_jam: ["pane", "glutine", "gluten", "frumento", "toast", "marmellat"],
  rusks: ["fette", "biscott", "glutine", "gluten", "frumento", "marmellat"],
  yogurt_bowl: ["yogurt", "latticino", "lattosio", "kefir"],
  smoothie: ["smoothie", "frullat"],
};

const MAX_STAPLE_USES_PER_WEEK = 3;

type BreakfastBeverage = {
  label: string;
  hint: (ml: number) => string;
  tags: readonly string[];
  animal: boolean;
};

const BREAKFAST_BEVERAGES: BreakfastBeverage[] = [
  {
    label: "Latte vaccino",
    hint: (ml) => `${ml} ml latte vaccino parzialmente scremato`,
    tags: ["latte", "lattosio", "latticino"],
    animal: true,
  },
  {
    label: "Latte senza lattosio",
    hint: (ml) => `${ml} ml latte vaccino senza lattosio`,
    tags: ["latte", "latticino"],
    animal: true,
  },
  {
    label: "Bevanda mandorla",
    hint: (ml) => `${ml} ml bevanda di mandorla non zuccherata`,
    tags: ["mandorl", "frutta a guscio"],
    animal: false,
  },
  {
    label: "Bevanda riso",
    hint: (ml) => `${ml} ml bevanda di riso non zuccherata`,
    tags: ["riso"],
    animal: false,
  },
  {
    label: "Bevanda avena",
    hint: (ml) => `${ml} ml bevanda d’avena non zuccherata`,
    tags: ["avena", "glutine"],
    animal: false,
  },
];

const D = {
  milkKcalPerMl: 0.64,
  milkProtPerMl: 0.032,
  milkChoPerMl: 0.048,
  cerealKcalPerG: 3.65,
  cerealChoPerG: 0.73,
  cerealProtPerG: 0.11,
  berryKcalPerG: 0.52,
  berryChoPerG: 0.12,
  bananaKcal: 95,
  bananaCho: 24,
  bananaProt: 1.2,
  yogurtKcalPerG: 0.72,
  yogurtProtPerG: 0.085,
  wheyKcalPerG: 4.0,
  wheyProtPerG: 0.8,
  breadKcalPerG: 2.7,
  breadChoPerG: 0.52,
  crackerKcalPerG: 4.2,
  crackerChoPerG: 0.68,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function planDateHash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 10007;
  return h;
}

function denyHit(keywords: readonly string[], deny: readonly string[] | undefined): boolean {
  if (!deny || deny.length === 0) return false;
  for (const kw of keywords) {
    const k = kw.toLowerCase();
    for (const d of deny) {
      if (!d) continue;
      if (k.includes(d) || d.includes(k)) return true;
    }
  }
  return false;
}

function stapleBreakfast(k: BreakfastArchetype): string {
  return `breakfast:${k}`;
}

function weekCountFor(key: string, week?: Record<string, number>): number {
  return week?.[key] ?? 0;
}

function allowedBreakfastArchetypes(ctx: MediterraneanDayContext): BreakfastArchetype[] {
  const deny = ctx.denyFragments;
  const filtered = BREAKFAST_ARCHETYPE_ORDER.filter((a) => !denyHit(BREAKFAST_ARCHETYPE_DENY[a], deny));
  return filtered.length > 0 ? filtered : ["cereals_milk"];
}

/** Selezione archetipo colazione con soft-cap settimanale (stesso schema pranzo/cena). */
export function pickBreakfastArchetype(seed: number, ctx: MediterraneanDayContext): BreakfastArchetype {
  const order = allowedBreakfastArchetypes(ctx);
  const used = ctx.usedStaples;
  const weekCounts = ctx.weekStapleCounts;
  const weekOk = order.filter((k) => weekCountFor(stapleBreakfast(k), weekCounts) < MAX_STAPLE_USES_PER_WEEK);
  const pool = weekOk.length ? weekOk : order;
  const dateOff = planDateHash(ctx.planDate);
  const idx = Math.abs(seed + dateOff * 3) % pool.length;
  let pick = pool[idx] ?? "cereals_milk";
  if (used.has(stapleBreakfast(pick))) {
    const esc = order.find((k) => !used.has(stapleBreakfast(k)));
    if (esc) pick = esc;
  }
  used.add(stapleBreakfast(pick));
  return pick;
}

function allowedBreakfastBeverages(ctx: MediterraneanDayContext): BreakfastBeverage[] {
  const isVegan = ctx.dietType === "vegan";
  const deny = ctx.denyFragments;
  const filtered = BREAKFAST_BEVERAGES.filter((b) => {
    if (isVegan && b.animal) return false;
    if (denyHit(b.tags, deny)) return false;
    return true;
  });
  if (filtered.length === 0) {
    return [
      {
        label: "Bevanda vegetale neutra",
        hint: (ml) => `${ml} ml bevanda vegetale non zuccherata`,
        tags: [],
        animal: false,
      },
    ];
  }
  return filtered;
}

function pickBreakfastBeverage(ctx: MediterraneanDayContext, seed: number, offset: number, targetMl: number) {
  const bevPool = allowedBreakfastBeverages(ctx);
  const bevIdx = (planDateHash(ctx.planDate) + seed * 7 + offset * 13) % bevPool.length;
  const bev = bevPool[bevIdx] ?? bevPool[0]!;
  const ml = clamp(targetMl, 100, 320);
  return { bev, ml, kcal: ml * D.milkKcalPerMl, prot: ml * D.milkProtPerMl };
}

type BreakfastFruitPick = { line: string; kcal: number; cho: number; prot: number };

function pickBreakfastFruit(seed: number, carbsG: number, variant: "default" | "smoothie" = "default"): BreakfastFruitPick {
  const useBanana = variant === "smoothie" ? true : seed % 3 !== 0;
  if (useBanana) {
    return { line: "1 banana media", kcal: D.bananaKcal, cho: D.bananaCho, prot: D.bananaProt };
  }
  const bg = clamp(carbsG * 0.22 / D.berryChoPerG, 40, 110);
  return {
    line: `${bg} g lamponi / mirtilli / frutti di bosco`,
    kcal: bg * D.berryKcalPerG,
    cho: bg * D.berryChoPerG,
    prot: bg * 0.01,
  };
}

function breakfastDairyBlocked(ctx: MediterraneanDayContext): boolean {
  return ctx.dietType === "vegan" || denyHit(["latte", "lattosio", "latticino", "yogurt"], ctx.denyFragments);
}

function item(
  name: string,
  portionHint: string,
  approxKcal: number,
  macroRole: IntelligentMealPlanItemOut["macroRole"],
  functionalBridge: string,
): IntelligentMealPlanItemOut {
  return {
    name,
    portionHint: portionHint.slice(0, 160),
    approxKcal: Math.max(15, Math.round(approxKcal)),
    macroRole,
    functionalBridge: functionalBridge.slice(0, 500),
  };
}

function appendBreakfastProteinTopUp(
  ctx: MediterraneanDayContext,
  seed: number,
  proteinG: number,
  items: IntelligentMealPlanItemOut[],
  lines: string[],
): void {
  const P = Math.max(12, proteinG);
  const isVegan = ctx.dietType === "vegan";
  const skipDairy = breakfastDairyBlocked(ctx);
  let yogurtG = seed % 4 === 0 ? 0 : clamp(P * 0.2 / D.yogurtProtPerG, 0, 160);
  let wheyG = 0;
  if (yogurtG * D.yogurtProtPerG < P * 0.35 && yogurtG < 120) yogurtG += 40;
  if (yogurtG * D.yogurtProtPerG + wheyG * D.wheyProtPerG < P * 0.75) {
    wheyG = clamp((P * 0.75 - yogurtG * D.yogurtProtPerG) / D.wheyProtPerG, 0, 28);
  }

  if (yogurtG >= 50) {
    const yk = yogurtG * D.yogurtKcalPerG;
    if (skipDairy) {
      const ygLabel = `${clamp(yogurtG, 80, 200)} g yogurt vegetale (soia o cocco) non zuccherato`;
      items.push(item("Yogurt vegetale", ygLabel, yk, "protein", "Yogurt vegetale: quota proteica complementare."));
      lines.push(ygLabel);
    } else {
      const ygLabel = `${clamp(yogurtG, 80, 200)} g yogurt greco o kefir`;
      items.push(item("Yogurt o kefir", ygLabel, yk, "protein", "Fermentato lattiero sul target proteico."));
      lines.push(ygLabel);
    }
  }

  if (wheyG >= 8) {
    const wk = wheyG * D.wheyKcalPerG;
    const isVeganProt = isVegan || denyHit(["whey", "siero"], ctx.denyFragments);
    const protLabel = isVeganProt
      ? `${clamp(wheyG, 10, 35)} g proteine vegetali in polvere (pisello/riso/soia)`
      : `${clamp(wheyG, 10, 35)} g proteine in polvere (shake)`;
    items.push(
      item(
        isVeganProt ? "Proteine vegetali in polvere" : "Proteine in polvere",
        protLabel,
        wk,
        "protein",
        "Complemento proteico sul target dello slot.",
      ),
    );
    lines.push(protLabel);
  }
}

function finalizeBreakfastMeal(
  items: IntelligentMealPlanItemOut[],
  lines: string[],
  proteinG: number,
  ctx: MediterraneanDayContext,
  seed: number,
): MediterraneanComposedMeal {
  appendBreakfastProteinTopUp(ctx, seed, proteinG, items, lines);
  return { lines, items, totalApproxKcal: items.reduce((a, i) => a + i.approxKcal, 0) };
}

function composeBreakfastCerealsMilk(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const C = Math.max(25, m.carbsG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  const bev = pickBreakfastBeverage(ctx, seed, 0, clamp(K * 0.28 / D.milkKcalPerMl, 140, 280));
  const cerealG = clamp(C * 0.38 / D.cerealChoPerG, 32, 78);
  const fruit = pickBreakfastFruit(seed, C);
  const cerealLabel = seed % 2 === 0 ? "Cereali / fiocchi (avena, muesli)" : "Cereali soffiati o fiocchi d’avena";

  items.push(
    item(
      bev.bev.animal ? "Latte o bevanda vegetale" : "Bevanda vegetale",
      bev.bev.hint(bev.ml).slice(0, 160),
      bev.kcal,
      "protein",
      `${bev.bev.label} con cereali.`,
    ),
  );
  lines.push(bev.bev.hint(bev.ml));
  items.push(item(cerealLabel, `${cerealG} g ${cerealLabel.toLowerCase()}`, cerealG * D.cerealKcalPerG, "cho_heavy", "CHO complesso."));
  lines.push(`${cerealG} g cereali / avena / muesli`);
  items.push(item("Frutta", fruit.line, fruit.kcal, "cho_heavy", "Frutta fresca."));
  lines.push(fruit.line);
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed);
}

function composeBreakfastPorridge(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const C = Math.max(25, m.carbsG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  const oatG = clamp(C * 0.42 / D.cerealChoPerG, 40, 85);
  const bev = pickBreakfastBeverage(ctx, seed, 1, clamp(K * 0.32 / D.milkKcalPerMl, 160, 280));
  const fruit = pickBreakfastFruit(seed + 1, C);

  items.push(
    item(
      "Porridge d’avena",
      `${oatG} g fiocchi d’avena cotti in ${bev.ml} ml ${bev.bev.animal ? "latte" : "bevanda vegetale"}`,
      oatG * D.cerealKcalPerG + bev.kcal * 0.85,
      "cho_heavy",
      "Porridge: colazione saziante a rilascio graduale.",
    ),
  );
  lines.push(`${oatG} g porridge d’avena (cotti in ${bev.bev.hint(bev.ml)})`);
  items.push(item("Frutta", fruit.line, fruit.kcal, "cho_heavy", "Frutta sul porridge."));
  lines.push(fruit.line);
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed);
}

function composeBreakfastToastJam(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const C = Math.max(25, m.carbsG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  const breadG = clamp(C * 0.45 / D.breadChoPerG, 50, 95);
  const jamG = clamp(12 + (seed % 10), 12, 22);
  const bev = pickBreakfastBeverage(ctx, seed, 2, clamp(K * 0.22 / D.milkKcalPerMl, 120, 200));

  items.push(item("Pane tostato", `${breadG} g pane integrale o di segale (2 fette)`, breadG * D.breadKcalPerG, "cho_heavy", "Pane tostato integrale."));
  lines.push(`${breadG} g pane tostato integrale`);
  items.push(item("Marmellata", `${jamG} g marmellata di frutta`, jamG * 2.5, "cho_heavy", "Marmellata leggera."));
  lines.push(`${jamG} g marmellata`);
  items.push(
    item(bev.bev.animal ? "Latte o bevanda vegetale" : "Bevanda vegetale", bev.bev.hint(bev.ml).slice(0, 160), bev.kcal, "protein", "Bevanda di accompagnamento."),
  );
  lines.push(bev.bev.hint(bev.ml));
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed);
}

function composeBreakfastRusks(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const C = Math.max(25, m.carbsG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  const ruskG = clamp(C * 0.4 / D.crackerChoPerG, 35, 65);
  const jamG = clamp(10 + (seed % 8), 10, 18);
  const bev = pickBreakfastBeverage(ctx, seed, 3, clamp(K * 0.24 / D.milkKcalPerMl, 120, 220));

  items.push(item("Fette biscottate", `${ruskG} g fette biscottate integrali (4–6 fette)`, ruskG * D.crackerKcalPerG, "cho_heavy", "Colazione classica mediterranea."));
  lines.push(`${ruskG} g fette biscottate integrali`);
  items.push(item("Marmellata", `${jamG} g marmellata`, jamG * 2.5, "cho_heavy", "Marmellata leggera."));
  lines.push(`${jamG} g marmellata`);
  items.push(
    item(bev.bev.animal ? "Latte o bevanda vegetale" : "Bevanda vegetale", bev.bev.hint(bev.ml).slice(0, 160), bev.kcal, "protein", "Latte/bevanda per intingere."),
  );
  lines.push(bev.bev.hint(bev.ml));
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed);
}

function composeBreakfastYogurtBowl(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const C = Math.max(25, m.carbsG);
  const P = Math.max(12, m.proteinG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  const skipDairy = breakfastDairyBlocked(ctx);
  const yogurtG = clamp(P * 0.55 / D.yogurtProtPerG, 120, 220);
  const cerealG = clamp(C * 0.28 / D.cerealChoPerG, 20, 45);
  const fruit = pickBreakfastFruit(seed + 2, C);
  const ygLabel = skipDairy
    ? `${yogurtG} g yogurt vegetale (soia/cocco) + ${cerealG} g granola o cereali`
    : `${yogurtG} g yogurt greco + ${cerealG} g muesli/granella`;

  items.push(
    item(
      skipDairy ? "Yogurt bowl vegetale" : "Yogurt bowl",
      ygLabel.slice(0, 160),
      yogurtG * D.yogurtKcalPerG + cerealG * D.cerealKcalPerG,
      "protein",
      "Bowl proteico con topping croccante.",
    ),
  );
  lines.push(ygLabel);
  items.push(item("Frutta", fruit.line, fruit.kcal, "cho_heavy", "Frutta nel bowl."));
  lines.push(fruit.line);
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed + 1);
}

function composeBreakfastSmoothie(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const C = Math.max(25, m.carbsG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  const bev = pickBreakfastBeverage(ctx, seed, 4, clamp(K * 0.35 / D.milkKcalPerMl, 180, 280));
  const fruit = pickBreakfastFruit(seed, C, "smoothie");
  const extraBerry =
    seed % 2 === 0
      ? { line: "80 g frutti di bosco", kcal: 80 * D.berryKcalPerG }
      : { line: "1 mela media", kcal: 72 };

  items.push(
    item(
      "Smoothie colazione",
      `${bev.bev.hint(bev.ml).slice(0, 80)} + ${fruit.line} + ${extraBerry.line} (frullato)`,
      bev.kcal + fruit.kcal + extraBerry.kcal,
      "cho_heavy",
      "Smoothie rapido: frutta + latte/bevanda vegetale.",
    ),
  );
  lines.push(`Smoothie: ${bev.bev.hint(bev.ml)}, ${fruit.line}, ${extraBerry.line}`);
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed);
}

function composeBreakfastByArchetype(
  archetype: BreakfastArchetype,
  m: MealMacroTargets,
  seed: number,
  ctx: MediterraneanDayContext,
): MediterraneanComposedMeal {
  switch (archetype) {
    case "porridge":
      return composeBreakfastPorridge(m, seed, ctx);
    case "toast_jam":
      return composeBreakfastToastJam(m, seed, ctx);
    case "rusks":
      return composeBreakfastRusks(m, seed, ctx);
    case "yogurt_bowl":
      return composeBreakfastYogurtBowl(m, seed, ctx);
    case "smoothie":
      return composeBreakfastSmoothie(m, seed, ctx);
    case "cereals_milk":
    default:
      return composeBreakfastCerealsMilk(m, seed, ctx);
  }
}

/** Composizione colazione con archetipo rotante (registrato in ctx.usedStaples). */
export function composeBreakfastWithArchetypes(
  m: MealMacroTargets,
  seed: number,
  ctx: MediterraneanDayContext,
): MediterraneanComposedMeal {
  const archetype = pickBreakfastArchetype(seed, ctx);
  return composeBreakfastByArchetype(archetype, m, seed, ctx);
}
