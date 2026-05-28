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

function pickBreakfastFruit(
  seed: number,
  carbsG: number,
  variant: "default" | "smoothie" = "default",
  ctx?: MediterraneanDayContext,
): BreakfastFruitPick {
  /** Rispetta foodExclusions del profilo (es. coach esclude "banana", "mirtillo"...).
   *  Se l'unica opzione di default e' vietata, fallback su mela o pera. */
  const deny = ctx?.denyFragments;
  const bananaBanned = denyHit(["banana"], deny);
  const berryBanned = denyHit(["lampon", "mirtill", "frutti di bosco", "berry", "bosco"], deny);
  const appleBanned = denyHit(["mela", "apple"], deny);
  const pearBanned = denyHit(["pera", "pear"], deny);

  /** Smoothie predefinisce banana ma se vietata cade su frutti di bosco; se anche quelli vietati, su mela. */
  if (variant === "smoothie") {
    if (!bananaBanned) return { line: "1 banana media", kcal: D.bananaKcal, cho: D.bananaCho, prot: D.bananaProt };
    if (!berryBanned) {
      const bg = clamp(carbsG * 0.22 / D.berryChoPerG, 40, 110);
      return { line: `${bg} g lamponi / mirtilli / frutti di bosco`, kcal: bg * D.berryKcalPerG, cho: bg * D.berryChoPerG, prot: bg * 0.01 };
    }
    if (!appleBanned) return { line: "1 mela media (~150 g)", kcal: 80, cho: 21, prot: 0.4 };
    if (!pearBanned) return { line: "1 pera media (~160 g)", kcal: 90, cho: 24, prot: 0.6 };
  }

  /** Default: alterna banana/berries con seed, escludendo cio' che e' vietato. */
  const useBanana = seed % 3 !== 0;
  if (useBanana && !bananaBanned) {
    return { line: "1 banana media", kcal: D.bananaKcal, cho: D.bananaCho, prot: D.bananaProt };
  }
  if (!berryBanned) {
    const bg = clamp(carbsG * 0.22 / D.berryChoPerG, 40, 110);
    return { line: `${bg} g lamponi / mirtilli / frutti di bosco`, kcal: bg * D.berryKcalPerG, cho: bg * D.berryChoPerG, prot: bg * 0.01 };
  }
  if (!bananaBanned) {
    return { line: "1 banana media", kcal: D.bananaKcal, cho: D.bananaCho, prot: D.bananaProt };
  }
  if (!appleBanned) return { line: "1 mela media (~150 g)", kcal: 80, cho: 21, prot: 0.4 };
  if (!pearBanned) return { line: "1 pera media (~160 g)", kcal: 90, cho: 24, prot: 0.6 };
  /** Fallback estremo (tutta la frutta dolce vietata): kiwi. */
  return { line: "2 kiwi (~150 g)", kcal: 92, cho: 22, prot: 1.7 };
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
  /** CHO solido = ~60% del target CHO pasto. Niente upper cap: porzione SCALA col target del solver. */
  const cerealG = Math.max(32, Math.round(C * 0.6 / D.cerealChoPerG));
  const fruit = pickBreakfastFruit(seed, C, "default", ctx);
  const cerealLabel = seed % 2 === 0 ? "Cereali / fiocchi (avena, muesli)" : "Cereali soffiati o fiocchi d’avena";

  items.push(
    item(
      /** Usa il label specifico ("Latte vaccino", "Bevanda mandorla", ...): permette al
       *  lookup canonical di matchare la rule corretta (es. plant_drink_almond invece di
       *  cadere in unresolved come accadeva con il name generico "Bevanda vegetale"). */
      bev.bev.label,
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
  /** Avena = fonte CHO dominante del porridge. ~65% del target CHO, nessun upper cap. */
  const oatG = Math.max(40, Math.round(C * 0.65 / D.cerealChoPerG));
  const bev = pickBreakfastBeverage(ctx, seed, 1, clamp(K * 0.32 / D.milkKcalPerMl, 160, 280));
  const fruit = pickBreakfastFruit(seed + 1, C, "default", ctx);

  /**
   * Item separati (1 alimento per item): permettono al lookup USDA di scalare
   * i nutrienti per la quantita' reale di ogni singolo ingrediente. Niente
   * piu' compose "X g avena + Y ml latte" in un solo item che confonderebbe
   * il mapping canonicalKey (es. "latte" matchato prima di "avena").
   */
  items.push(
    item(
      "Fiocchi d'avena",
      `${oatG} g fiocchi d'avena (peso secco)`,
      oatG * D.cerealKcalPerG,
      "cho_heavy",
      "Avena secca: base CHO complessa del porridge.",
    ),
  );
  lines.push(`${oatG} g fiocchi d'avena (peso secco)`);
  items.push(
    item(
      bev.bev.label,
      bev.bev.hint(bev.ml).slice(0, 160),
      bev.kcal,
      "protein",
      `${bev.bev.label} per la cottura del porridge.`,
    ),
  );
  lines.push(bev.bev.hint(bev.ml));
  items.push(item("Frutta", fruit.line, fruit.kcal, "cho_heavy", "Frutta sul porridge."));
  lines.push(fruit.line);
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed);
}

function composeBreakfastToastJam(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const C = Math.max(25, m.carbsG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  /** Pane = CHO dominante toast_jam. ~70% del target (la marmellata copre il resto). Nessun upper cap. */
  const breadG = Math.max(50, Math.round(C * 0.7 / D.breadChoPerG));
  const jamG = clamp(12 + (seed % 10), 12, 22);
  const bev = pickBreakfastBeverage(ctx, seed, 2, clamp(K * 0.22 / D.milkKcalPerMl, 120, 200));

  items.push(item("Pane tostato", `${breadG} g pane integrale o di segale (2 fette)`, breadG * D.breadKcalPerG, "cho_heavy", "Pane tostato integrale."));
  lines.push(`${breadG} g pane tostato integrale`);
  items.push(item("Marmellata", `${jamG} g marmellata di frutta`, jamG * 2.5, "cho_heavy", "Marmellata leggera."));
  lines.push(`${jamG} g marmellata`);
  items.push(
    item(bev.bev.label, bev.bev.hint(bev.ml).slice(0, 160), bev.kcal, "protein", "Bevanda di accompagnamento."),
  );
  lines.push(bev.bev.hint(bev.ml));
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed);
}

function composeBreakfastRusks(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const C = Math.max(25, m.carbsG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];
  /** Fette biscottate = CHO dominante. ~70% del target CHO, nessun upper cap. */
  const ruskG = Math.max(35, Math.round(C * 0.7 / D.crackerChoPerG));
  const jamG = clamp(10 + (seed % 8), 10, 18);
  const bev = pickBreakfastBeverage(ctx, seed, 3, clamp(K * 0.24 / D.milkKcalPerMl, 120, 220));

  items.push(item("Fette biscottate", `${ruskG} g fette biscottate integrali (4–6 fette)`, ruskG * D.crackerKcalPerG, "cho_heavy", "Colazione classica mediterranea."));
  lines.push(`${ruskG} g fette biscottate integrali`);
  items.push(item("Marmellata", `${jamG} g marmellata`, jamG * 2.5, "cho_heavy", "Marmellata leggera."));
  lines.push(`${jamG} g marmellata`);
  items.push(
    item(bev.bev.label, bev.bev.hint(bev.ml).slice(0, 160), bev.kcal, "protein", "Latte/bevanda per intingere."),
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
  /** Granola/muesli/cereali nel bowl = CHO dominante. ~55% del target CHO (frutta copre il resto). Nessun upper cap. */
  const cerealG = Math.max(20, Math.round(C * 0.55 / D.cerealChoPerG));
  const fruit = pickBreakfastFruit(seed + 2, C, "default", ctx);

  /** Item separati: yogurt (proteico) + granola/muesli (CHO) + frutta. Un alimento per item. */
  items.push(
    item(
      skipDairy ? "Yogurt vegetale" : "Yogurt greco",
      skipDairy ? `${yogurtG} g yogurt vegetale (soia/cocco) non zuccherato` : `${yogurtG} g yogurt greco`,
      yogurtG * D.yogurtKcalPerG,
      "protein",
      skipDairy ? "Yogurt vegetale: base proteica del bowl." : "Yogurt greco: base proteica del bowl.",
    ),
  );
  lines.push(skipDairy ? `${yogurtG} g yogurt vegetale (soia/cocco) non zuccherato` : `${yogurtG} g yogurt greco`);
  items.push(
    item(
      "Muesli / granola",
      `${cerealG} g muesli o granola (topping croccante)`,
      cerealG * D.cerealKcalPerG,
      "cho_heavy",
      "Cereali croccanti nel bowl: CHO complessi.",
    ),
  );
  lines.push(`${cerealG} g muesli o granola`);
  items.push(item("Frutta", fruit.line, fruit.kcal, "cho_heavy", "Frutta nel bowl."));
  lines.push(fruit.line);
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed + 1);
}

function composeBreakfastSmoothie(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const C = Math.max(25, m.carbsG);
  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];

  /**
   * Cereale solido a fianco dello smoothie: copre la quota CHO complessa che
   * frutta + bevanda non possono garantire. ~55% del CHO target del solver,
   * nessun upper cap: porzioni reali se il target lo richiede.
   */
  const oatG = Math.max(40, Math.round(C * 0.55 / D.cerealChoPerG));
  items.push(
    item(
      "Fiocchi d'avena",
      `${oatG} g fiocchi d'avena (peso secco, a parte o nel frullato)`,
      oatG * D.cerealKcalPerG,
      "cho_heavy",
      "CHO complesso solido: copre il fabbisogno carbo che lo smoothie liquido da solo non garantisce.",
    ),
  );
  lines.push(`${oatG} g fiocchi d'avena (peso secco)`);

  /**
   * Smoothie spezzato in item singoli (bevanda + frutta + extra). Niente piu'
   * "200 ml latte + 1 mela + 80 g frutti di bosco (frullato)" come singolo item:
   * il lookup USDA non saprebbe quale alimento usare e scalerebbe i nutrienti
   * di uno solo dei tre per la prima quantita' trovata nel testo.
   */
  const bev = pickBreakfastBeverage(ctx, seed, 4, clamp(K * 0.22 / D.milkKcalPerMl, 180, 280));
  const fruit = pickBreakfastFruit(seed, C, "smoothie", ctx);
  const useBerries = seed % 2 === 0;

  items.push(
    item(
      bev.bev.label,
      bev.bev.hint(bev.ml).slice(0, 160),
      bev.kcal,
      "protein",
      "Liquido del frullato.",
    ),
  );
  lines.push(bev.bev.hint(bev.ml));
  items.push(item("Frutta", fruit.line, fruit.kcal, "cho_heavy", "Frutta principale del frullato."));
  lines.push(fruit.line);
  if (useBerries) {
    items.push(item("Frutti di bosco", "80 g frutti di bosco (mirtilli/lamponi)", 80 * D.berryKcalPerG, "cho_heavy", "Mix bacche nel frullato."));
    lines.push("80 g frutti di bosco");
  } else {
    items.push(item("Mela", "1 mela media (~150 g)", 72, "cho_heavy", "Mela nel frullato."));
    lines.push("1 mela media");
  }
  return finalizeBreakfastMeal(items, lines, m.proteinG, ctx, seed);
}

/** Esportata per test deterministici (forza un archetipo). Non usare nel runtime di prodotto. */
export function composeBreakfastByArchetype(
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
