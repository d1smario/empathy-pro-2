/**
 * Composizione deterministica “piano alimentare” stile mediterraneo:
 * per slot si fissano target kcal/macro (dal solver), poi si compone il pasto con
 * una fonte principale di CHO, una di proteine, grassi (olio / formaggio), fibre (verdura),
 * eventuale pane — porzioni iterate su densità indicative; nessuna ripartizione uniforme
 * delle kcal sul numero di voci (le kcal per riga restano legate alle quantità stimati).
 */

import type { IntelligentMealPlanItemOut, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

/** Allineato a `DryMealSlotMacros` in dry-meal-plan-lines (evita import circolare). */
export type MealMacroTargets = {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

/** Contesto unico per tutti gli slot dello stesso giorno: evita stessi amidi/proteine ripetuti. */
export type MediterraneanDayContext = {
  planDate: string;
  /** Chiavi: carb:pasta | prot:pollo | prot:pesce | … */
  usedStaples: Set<string>;
  /** Conteggi staple negli altri giorni della settimana ISO (cache client). Soft cap ~2. */
  weekStapleCounts?: Record<string, number>;
  /** Orario slot spostato vs routine (fine seduta + propagazione): pranzo/cena CHO più refeed; spuntini più CHO / meno grassi. */
  postWorkoutMealBySlot?: Partial<Record<MealSlotKey, boolean>>;
};

/** Max utilizzi/settimana per stesso amido o stessa famiglia proteica principale (latte/olio/ zucchero non sono in questa lista). */
const MAX_STAPLE_USES_PER_WEEK = 3;

export function createMediterraneanDayContext(
  planDate: string,
  weekStapleCounts?: Record<string, number>,
  postWorkoutMealBySlot?: Partial<Record<MealSlotKey, boolean>>,
): MediterraneanDayContext {
  const w =
    weekStapleCounts && Object.keys(weekStapleCounts).length
      ? { ...weekStapleCounts }
      : undefined;
  const pw =
    postWorkoutMealBySlot && Object.keys(postWorkoutMealBySlot).length
      ? { ...postWorkoutMealBySlot }
      : undefined;
  return { planDate, usedStaples: new Set(), weekStapleCounts: w, postWorkoutMealBySlot: pw };
}

function planDateHash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 10007;
  return h;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function roundToStep(n: number, step = 5): number {
  return Math.round(n / step) * step;
}

function clampStep(n: number, lo: number, hi: number, step = 5): number {
  return Math.max(lo, Math.min(hi, roundToStep(n, step)));
}

function hashSeed(slot: MealSlotKey, kcal: number): number {
  const s = slot.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Math.abs(Math.round(kcal * 1.73 + s * 41));
}

/** kcal e macro approssimati (ordine di grandezza educativo, non laboratorio). */
const D = {
  milkKcalPerMl: 0.64,
  milkProtPerMl: 0.032,
  milkChoPerMl: 0.048,
  milkFatPerMl: 0.036,
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
  yogurtChoPerG: 0.045,
  yogurtFatPerG: 0.038,
  wheyKcalPerG: 4.0,
  wheyProtPerG: 0.8,
  wheyChoPerG: 0.06,
  pastaDryKcalPerG: 3.71,
  pastaDryChoPerG: 0.75,
  pastaDryProtPerG: 0.13,
  riceDryKcalPerG: 3.65,
  riceDryChoPerG: 0.8,
  riceDryProtPerG: 0.071,
  potatoCookedKcalPerG: 0.9,
  potatoCookedChoPerG: 0.2,
  farroDryKcalPerG: 3.38,
  farroDryChoPerG: 0.7,
  farroDryProtPerG: 0.14,
  chickenKcalPerG: 1.65,
  chickenProtPerG: 0.31,
  fishKcalPerG: 1.55,
  fishProtPerG: 0.28,
  meatKcalPerG: 1.85,
  meatProtPerG: 0.26,
  legumeKcalPerG: 1.15,
  legumeProtPerG: 0.09,
  legumeChoPerG: 0.15,
  eggKcalEach: 78,
  eggProtEach: 6.3,
  vegKcalPerG: 0.35,
  vegChoPerG: 0.05,
  oilKcalPerMl: 9.0,
  oilFatPerMl: 1.0,
  breadKcalPerG: 2.7,
  breadChoPerG: 0.52,
  focacciaKcalPerG: 3.0,
  granaKcalPerG: 4.0,
  granaProtPerG: 0.32,
  granaFatPerG: 0.28,
  avocadoKcalPerG: 1.6,
  avocadoFatPerG: 0.15,
  crackerKcalPerG: 4.2,
  crackerChoPerG: 0.68,
};

export type MediterraneanComposedMeal = {
  lines: string[];
  items: IntelligentMealPlanItemOut[];
  totalApproxKcal: number;
};

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

const BREAKFAST_BEVERAGES: Array<{ label: string; hint: (ml: number) => string }> = [
  {
    label: "Latte vaccino",
    hint: (ml) => `${ml} ml latte vaccino parzialmente scremato`,
  },
  {
    label: "Latte senza lattosio",
    hint: (ml) => `${ml} ml latte vaccino senza lattosio`,
  },
  {
    label: "Bevanda mandorla",
    hint: (ml) => `${ml} ml bevanda di mandorla non zuccherata`,
  },
  {
    label: "Bevanda riso",
    hint: (ml) => `${ml} ml bevanda di riso non zuccherata`,
  },
  {
    label: "Bevanda avena",
    hint: (ml) => `${ml} ml bevanda d’avena non zuccherata`,
  },
  {
    label: "Latte capra",
    hint: (ml) => `${ml} ml latte di capra`,
  },
];

function composeBreakfast(m: MealMacroTargets, seed: number, ctx: MediterraneanDayContext): MediterraneanComposedMeal {
  const K = Math.max(220, m.kcal);
  const P = Math.max(12, m.proteinG);
  const C = Math.max(25, m.carbsG);
  const F = Math.max(6, m.fatG);

  let milkMl = clamp(K * 0.28 / D.milkKcalPerMl, 140, 300);
  let cerealG = clamp(C * 0.38 / D.cerealChoPerG, 32, 78);
  const useBanana = seed % 3 !== 0;
  let fruitKcal = 0;
  let fruitCho = 0;
  let fruitProt = 0;
  let fruitLine = "";
  if (useBanana) {
    fruitKcal = D.bananaKcal;
    fruitCho = D.bananaCho;
    fruitProt = D.bananaProt;
    fruitLine = "1 banana media";
  } else {
    const bg = clamp(C * 0.22 / D.berryChoPerG, 40, 110);
    fruitKcal = bg * D.berryKcalPerG;
    fruitCho = bg * D.berryChoPerG;
    fruitProt = bg * 0.01;
    fruitLine = `${clamp(bg, 40, 110)} g lamponi / mirtilli / frutti di bosco`;
  }

  let yogurtG = seed % 4 === 0 ? 0 : clamp(P * 0.25 / D.yogurtProtPerG, 0, 180);
  let wheyG = 0;

  const sumK = () =>
    milkMl * D.milkKcalPerMl +
    cerealG * D.cerealKcalPerG +
    fruitKcal +
    yogurtG * D.yogurtKcalPerG +
    wheyG * D.wheyKcalPerG;
  const sumP = () =>
    milkMl * D.milkProtPerMl +
    cerealG * D.cerealProtPerG +
    fruitProt +
    yogurtG * D.yogurtProtPerG +
    wheyG * D.wheyProtPerG;

  for (let i = 0; i < 6; i++) {
    const f = K / Math.max(120, sumK());
    milkMl = clamp(milkMl * Math.pow(f, 0.55), 120, 320);
    cerealG = clamp(cerealG * Math.pow(f, 0.55), 30, 85);
    if (sumP() < P * 0.88) {
      if (yogurtG < 120) yogurtG += 40;
      else wheyG = clamp(wheyG + 12, 0, 30);
    }
    if (sumK() > K * 1.05) break;
  }

  if (sumP() < P * 0.8) wheyG = Math.max(wheyG, clamp((P - sumP()) / D.wheyProtPerG, 12, 28));

  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];

  const mk = milkMl * D.milkKcalPerMl;
  const bevIdx = (planDateHash(ctx.planDate) + seed * 7) % BREAKFAST_BEVERAGES.length;
  const bev = BREAKFAST_BEVERAGES[bevIdx] ?? BREAKFAST_BEVERAGES[0]!;
  const mlRounded = clamp(milkMl, 120, 320);
  items.push(
    item(
      "Latte o bevanda vegetale",
      bev.hint(mlRounded).slice(0, 160),
      mk,
      "protein",
      `${bev.label}: densità energetica simile al latte per porzione; cereali e frutta completano CHO e fibre.`,
    ),
  );
  lines.push(bev.hint(mlRounded));

  const ck = cerealG * D.cerealKcalPerG;
  const cerealLabel = seed % 2 === 0 ? "Cereali / fiocchi (avena, muesli)" : "Cereali soffiati o fiocchi d’avena";
  items.push(
    item(cerealLabel, `${clamp(cerealG, 30, 80)} g ${cerealLabel.toLowerCase()}`, ck, "cho_heavy", "Carboidrato complesso a basso indice glicemico relativo (porzione sul target CHO)."),
  );
  lines.push(`${clamp(cerealG, 30, 80)} g cereali / avena / muesli`);

  items.push(
    item("Frutta", fruitLine, fruitKcal, "cho_heavy", "Frutta fresca o frutti di bosco; vitamine e CHO."),
  );
  lines.push(fruitLine);

  if (yogurtG >= 50) {
    const yk = yogurtG * D.yogurtKcalPerG;
    items.push(
      item(
        "Yogurt o kefir",
        `${clamp(yogurtG, 80, 200)} g yogurt greco o kefir`,
        yk,
        "protein",
        "Fermentato lattiero; aumenta proteine senza duplicare una seconda fonte proteica animale intera.",
      ),
    );
    lines.push(`${clamp(yogurtG, 80, 200)} g yogurt greco o kefir`);
  }

  if (wheyG >= 8) {
    const wk = wheyG * D.wheyKcalPerG;
    items.push(
      item("Proteine in polvere", `${clamp(wheyG, 10, 35)} g proteine in polvere (shake)`, wk, "protein", "Complemento proteico sul target dello slot."),
    );
    lines.push(`${clamp(wheyG, 10, 35)} g proteine in polvere (sciolte nel latte)`);
  }

  const total = items.reduce((a, i) => a + i.approxKcal, 0);
  return { lines, items, totalApproxKcal: total };
}

type CarbKey = "pasta" | "riso" | "patate" | "farro";
type ProtKey = "pollo" | "pesce" | "legumi" | "manzo" | "uova";

const CARB_ORDER: CarbKey[] = ["pasta", "riso", "patate", "farro"];
const PROT_ORDER: ProtKey[] = ["pollo", "pesce", "legumi", "manzo", "uova"];

type FishKind = "merluzzo" | "spigola" | "salmone";

const FISH_KINDS: FishKind[] = ["merluzzo", "spigola", "salmone"];

/** Densità indicative: pasta/riso/farro in g a crudo; patate e pesce cotti al consumo. */
const FISH: Record<FishKind, { labelIt: string; kcalPerG: number; protPerG: number; fatPerG: number }> = {
  merluzzo: { labelIt: "merluzzo", kcalPerG: 0.82, protPerG: 0.18, fatPerG: 0.008 },
  spigola: { labelIt: "spigola", kcalPerG: 1.22, protPerG: 0.24, fatPerG: 0.028 },
  salmone: { labelIt: "salmone", kcalPerG: 2.08, protPerG: 0.2, fatPerG: 0.13 },
};

function stapleCarb(k: CarbKey): string {
  return `carb:${k}`;
}

/** Pesce: una famiglia al giorno (no pranzo pesce + cena pesce). */
function stapleProt(protKey: ProtKey): string {
  if (protKey === "pesce") return "prot:pesce";
  return `prot:${protKey}`;
}

function weekCountFor(key: string, week?: Record<string, number>): number {
  return week?.[key] ?? 0;
}

function pickCarbKey(seed: number, offset: number, used: Set<string>, weekCounts?: Record<string, number>): CarbKey {
  const sameDayOk = CARB_ORDER.filter((k) => !used.has(stapleCarb(k)));
  const base = sameDayOk.length ? sameDayOk : CARB_ORDER;
  const weekOk = base.filter((k) => weekCountFor(stapleCarb(k), weekCounts) < MAX_STAPLE_USES_PER_WEEK);
  const pool = weekOk.length ? weekOk : base;
  const idx = Math.abs(seed + offset * 7) % pool.length;
  let k = pool[idx]!;
  if (used.has(stapleCarb(k))) {
    const esc = CARB_ORDER.find((c) => !used.has(stapleCarb(c)));
    if (esc) k = esc;
  }
  return k;
}

function protAllowedWithCarb(carbKey: CarbKey, protKey: ProtKey): boolean {
  if (carbKey === "patate" && protKey === "legumi") return false;
  return true;
}

function pickProtAndFish(
  seed: number,
  offset: number,
  carbKey: CarbKey,
  used: Set<string>,
  weekCounts?: Record<string, number>,
): { protKey: ProtKey; fishKind: FishKind | null } {
  const sameDayOk = PROT_ORDER.filter((pk) => protAllowedWithCarb(carbKey, pk) && !used.has(stapleProt(pk)));
  const base = sameDayOk.length ? sameDayOk : PROT_ORDER.filter((pk) => protAllowedWithCarb(carbKey, pk));
  const weekOk = base.filter((pk) => weekCountFor(stapleProt(pk), weekCounts) < MAX_STAPLE_USES_PER_WEEK);
  const pool = weekOk.length ? weekOk : base;
  const idx = Math.abs(seed * 3 + offset * 5) % pool.length;
  let protKey = pool[idx]!;

  /** Mai ripetere la stessa proteina principale nello stesso giorno: se il pool ha sbagliato, cerca una libera. */
  if (used.has(stapleProt(protKey))) {
    const escape = PROT_ORDER.find((pk) => protAllowedWithCarb(carbKey, pk) && !used.has(stapleProt(pk)));
    protKey = escape ?? "pollo";
  }

  if (protKey === "pesce") {
    const fishKind = FISH_KINDS[(seed + offset * 11 + idx * 3) % FISH_KINDS.length]!;
    return { protKey, fishKind };
  }
  return { protKey, fishKind: null };
}

function carbLine(key: CarbKey, g: number): { line: string; kcal: number; cho: number; prot: number; fat: number } {
  switch (key) {
    case "pasta": {
      const gc = clampStep(g, 45, 140);
      return {
        line: `${gc} g pasta secca (peso a crudo), condimento a parte`,
        kcal: gc * D.pastaDryKcalPerG,
        cho: gc * D.pastaDryChoPerG,
        prot: gc * D.pastaDryProtPerG,
        fat: gc * 0.015,
      };
    }
    case "riso": {
      const gc = clampStep(g, 40, 120);
      return {
        line: `${gc} g riso (peso a crudo)`,
        kcal: gc * D.riceDryKcalPerG,
        cho: gc * D.riceDryChoPerG,
        prot: gc * D.riceDryProtPerG,
        fat: gc * 0.006,
      };
    }
    case "patate": {
      const gc = clampStep(g, 80, 320);
      return {
        line: `${gc} g patate (cotte al forno/bollite)`,
        kcal: gc * D.potatoCookedKcalPerG,
        cho: gc * D.potatoCookedChoPerG,
        prot: gc * 0.02,
        fat: gc * 0.01,
      };
    }
    case "farro": {
      const gc = clampStep(g, 45, 130);
      return {
        line: `${gc} g farro o orzo (peso a crudo/secco)`,
        kcal: gc * D.farroDryKcalPerG,
        cho: gc * D.farroDryChoPerG,
        prot: gc * D.farroDryProtPerG,
        fat: gc * 0.022,
      };
    }
    default:
      return carbLine("pasta", g);
  }
}

function protLine(
  key: ProtKey,
  g: number,
  eggs: number,
  fishKind: FishKind | null,
): { line: string; kcal: number; cho: number; prot: number; fat: number } {
  switch (key) {
    case "pollo": {
      const gc = clampStep(g, 100, 240);
      return {
        line: `${gc} g petto di pollo o tacchino`,
        kcal: gc * D.chickenKcalPerG,
        cho: gc * 0.01,
        prot: gc * D.chickenProtPerG,
        fat: gc * 0.04,
      };
    }
    case "pesce": {
      const fk = fishKind ?? "merluzzo";
      const spec = FISH[fk];
      const gc = clampStep(g, 85, 280);
      return {
        line: `${gc} g ${spec.labelIt} (peso netto cotto)`,
        kcal: gc * spec.kcalPerG,
        cho: 0,
        prot: gc * spec.protPerG,
        fat: gc * spec.fatPerG,
      };
    }
    case "legumi": {
      const gc = clampStep(g, 120, 220);
      return {
        line: `${gc} g legumi cotti (ceci, lenticchie, fagioli)`,
        kcal: gc * D.legumeKcalPerG,
        cho: gc * D.legumeChoPerG,
        prot: gc * D.legumeProtPerG,
        fat: gc * 0.02,
      };
    }
    case "manzo": {
      const gc = clampStep(g, 100, 220);
      return {
        line: `${gc} g carne magra (manzo/maiale magro)`,
        kcal: gc * D.meatKcalPerG,
        cho: 0,
        prot: gc * D.meatProtPerG,
        fat: gc * 0.08,
      };
    }
    case "uova": {
      const n = clamp(eggs, 2, 4);
      return {
        line: `${n} uova (frittata / strapazzate)`,
        kcal: n * D.eggKcalEach,
        cho: n * 0.6,
        prot: n * D.eggProtEach,
        fat: n * 5.3,
      };
    }
    default:
      return protLine("pollo", g, eggs, null);
  }
}

function composeMainMeal(
  slot: MealSlotKey,
  m: MealMacroTargets,
  seed: number,
  ctx?: MediterraneanDayContext,
): MediterraneanComposedMeal {
  const K = Math.max(350, m.kcal);
  const P = Math.max(25, m.proteinG);
  const F = Math.max(10, m.fatG);

  const offset = slot === "dinner" ? 2 : 0;
  const used = ctx?.usedStaples;
  let carbKey: CarbKey;
  let protKey: ProtKey;
  let fishKind: FishKind | null = null;

  const weekCounts = ctx?.weekStapleCounts;

  if (used && (slot === "lunch" || slot === "dinner")) {
    carbKey = pickCarbKey(seed, offset, used, weekCounts);
    const picked = pickProtAndFish(seed, offset, carbKey, used, weekCounts);
    protKey = picked.protKey;
    fishKind = picked.fishKind;
  } else {
    carbKey = CARB_ORDER[(seed + offset) % CARB_ORDER.length];
    protKey = PROT_ORDER[(seed * 3 + offset) % PROT_ORDER.length];
    if (carbKey === "patate" && protKey === "legumi") protKey = "pollo";
    fishKind = protKey === "pesce" ? FISH_KINDS[(seed + offset * 2) % FISH_KINDS.length]! : null;
  }

  const postWorkout = Boolean(ctx?.postWorkoutMealBySlot?.[slot]);
  if (postWorkout && (slot === "lunch" || slot === "dinner") && used) {
    if (carbKey === "pasta" || carbKey === "farro") {
      const canRiso =
        !used.has(stapleCarb("riso")) && weekCountFor(stapleCarb("riso"), weekCounts) < MAX_STAPLE_USES_PER_WEEK;
      const canPatate =
        !used.has(stapleCarb("patate")) && weekCountFor(stapleCarb("patate"), weekCounts) < MAX_STAPLE_USES_PER_WEEK;
      if (canRiso && (seed % 2 !== 0 || !canPatate)) {
        carbKey = "riso";
      } else if (canPatate) {
        carbKey = "patate";
      } else if (canRiso) {
        carbKey = "riso";
      }
    }
    if (carbKey === "patate" && protKey === "legumi") {
      if (!used.has(stapleProt("pollo"))) {
        protKey = "pollo";
        fishKind = null;
      } else {
        protKey = "pesce";
        fishKind = FISH_KINDS[(seed + offset * 2) % FISH_KINDS.length]!;
      }
    } else if (protKey === "legumi") {
      if (!used.has(stapleProt("pollo"))) {
        protKey = "pollo";
        fishKind = null;
      } else if (!used.has(stapleProt("pesce"))) {
        protKey = "pesce";
        fishKind = FISH_KINDS[(seed + offset * 2) % FISH_KINDS.length]!;
      } else {
        protKey = "manzo";
        fishKind = null;
      }
    }
  }

  const eggs = protKey === "uova" ? clamp(Math.round(P / 17), 2, 4) : 3;

  const fishProtDen =
    protKey === "pesce" && fishKind ? FISH[fishKind].protPerG : protKey === "pesce" ? FISH.merluzzo.protPerG : 0.29;

  let carbG =
    carbKey === "patate"
      ? clamp(K * 0.32 / D.potatoCookedKcalPerG, 140, 320)
      : carbKey === "riso"
        ? clamp(K * 0.38 / D.riceDryKcalPerG, 45, 120)
        : carbKey === "farro"
          ? clamp(K * 0.38 / D.farroDryKcalPerG, 50, 130)
          : clamp(K * 0.38 / D.pastaDryKcalPerG, 50, 140);
  let protG =
    protKey === "uova"
      ? 0
      : protKey === "legumi"
        ? clamp(P * 0.72 / D.legumeProtPerG, 130, 210)
        : clamp(P * 0.72 / fishProtDen, 90, 280);

  let vegG = clamp(160 + (seed % 3) * 25, 150, 250);
  let oilMl = clamp(F * 0.55 / D.oilFatPerMl, 8, 22);
  let paneG =
    carbKey === "pasta"
      ? clamp(22 + (seed % 3) * 8, 20, 50)
      : carbKey === "patate" || carbKey === "riso"
        ? clamp(32 + (seed % 2) * 12, 28, 65)
        : clamp(28 + (seed % 2) * 10, 25, 55);
  const granaG = seed % 5 === 0 ? clamp(15 + (seed % 3) * 6, 15, 35) : 0;

  const totalKcal = () => {
    const c = carbLine(carbKey, carbG);
    const p = protLine(protKey, protG, eggs, fishKind);
    return (
      c.kcal +
      p.kcal +
      vegG * D.vegKcalPerG +
      oilMl * D.oilKcalPerMl +
      paneG * D.breadKcalPerG +
      granaG * D.granaKcalPerG
    );
  };

  const carbGClamp = (): { lo: number; hi: number } => {
    if (carbKey === "patate") return { lo: 90, hi: 340 };
    if (carbKey === "riso") return { lo: 38, hi: 125 };
    if (carbKey === "farro") return { lo: 40, hi: 135 };
    return { lo: 42, hi: 145 };
  };

  for (let i = 0; i < 12; i++) {
    const t = totalKcal();
    const f = K / Math.max(180, t);
    if (Math.abs(f - 1) < 0.04) break;
    const { lo, hi } = carbGClamp();
    carbG = clamp(carbG * Math.pow(f, 0.55), lo, hi);
    if (protKey !== "uova") protG = clamp(protG * Math.pow(f, 0.45), 95, 260);
    vegG = clamp(vegG * Math.pow(f, 0.15), 130, 280);
    oilMl = clamp(oilMl * Math.pow(f, 0.2), 6, 26);
  }

  const carbFinal = carbLine(carbKey, carbG);
  const protFinal = protLine(protKey, protG, eggs, fishKind);
  const vegFinalG = clampStep(vegG, 130, 280);
  const oilFinalMl = clamp(oilMl, 8, 22);
  const paneFinalG = clampStep(paneG, 20, 65);
  const granaFinalG = granaG > 0 ? clampStep(granaG, 15, 35) : 0;
  const vegK = vegFinalG * D.vegKcalPerG;
  const oilK = oilFinalMl * D.oilKcalPerMl;
  const paneK = paneFinalG * D.breadKcalPerG;
  const granaK = granaFinalG * D.granaKcalPerG;

  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];

  const carbName =
    carbKey === "pasta"
      ? "Pasta (unica fonte amido principale)"
      : carbKey === "riso"
        ? "Riso (unica fonte amido principale)"
        : carbKey === "patate"
          ? "Patate (unica fonte amido principale)"
          : "Farro/orzo (unica fonte amido principale)";

  items.push(
    item(carbName, carbFinal.line, carbFinal.kcal, "cho_heavy", "Un solo carboidrato complesso da pasto principale (no pasta + riso insieme)."),
  );
  lines.push(carbFinal.line);

  const protName =
    protKey === "pollo"
      ? "Proteina: pollo/tacchino"
      : protKey === "pesce"
        ? fishKind
          ? `Proteina: ${FISH[fishKind].labelIt}`
          : "Proteina: pesce"
        : protKey === "legumi"
          ? "Proteina: legumi"
          : protKey === "manzo"
            ? "Proteina: carne magra"
            : "Proteina: uova";

  items.push(
    item(protName, protFinal.line, protFinal.kcal, "protein", "Una sola famiglia proteica principale (no pollo + pesce + uova nello stesso pasto)."),
  );
  lines.push(protFinal.line);

  items.push(
    item("Contorno verdure", `${vegFinalG} g verdure miste (crude o cotte)`, vegK, "veg", "Fibre, minerali, volume; condisci con parte degli grassi del pasto."),
  );
  lines.push(`${vegFinalG} g verdure miste a piacere`);

  items.push(
    item("Condimento olio EVO", `${oilFinalMl} ml olio d’oliva (a crudo)`, oilK, "fat", "Grassi insaturi; solo pranzo/cena, non in colazione."),
  );
  lines.push(`${oilFinalMl} ml olio d’oliva a crudo`);

  if (paneFinalG > 0) {
    const isFocaccia = seed % 7 === 0;
    const label = isFocaccia ? `${paneFinalG} g focaccia (porzione piccola)` : `${paneFinalG} g pane integrale o gallette`;
    items.push(item("Pane / focaccia", label, paneK, "cho_heavy", "Accompagnamento in piccola quantità; il carboidrato principale resta quello scelto sopra."));
    lines.push(label);
  }

  if (granaFinalG > 0) {
    items.push(
      item("Grana / formaggio", `${granaFinalG} g grana o formaggio stagionato`, granaK, "fat", "Sapore e proteine; quota grassi del pasto."),
    );
    lines.push(`${granaFinalG} g grana o formaggio stagionato`);
  }

  if (m.fatG > 22 && seed % 4 === 1) {
    items.push(
      item(
        "Omega (integrazione)",
        "Se serve: 1 capsula omega 3 (EPA/DHA) lontano dai pasti o come da protocollo",
        15,
        "fat",
        "Complemento lipidi essenziali se il pesce è sporadico; non sostituisce olio e alimenti interi.",
      ),
    );
    lines.push("Opzionale: omega-3 EPA/DHA (integrazione se concordata)");
  }

  const total = items.reduce((a, i) => a + i.approxKcal, 0);

  if (used && (slot === "lunch" || slot === "dinner")) {
    used.add(stapleCarb(carbKey));
    used.add(stapleProt(protKey));
  }

  return { lines, items, totalApproxKcal: total };
}

/** kcal stimate da grammatura nell’etichetta affettato (educativo, allineato a ordini di grandezza comuni). */
function kcalFromDeliLine(line: string): number {
  const m = line.match(/(\d+(?:[.,]\d+)?)\s*g/i);
  const g = m ? parseFloat(m[1]!.replace(",", ".")) : 50;
  if (!Number.isFinite(g) || g <= 0) return 85;
  if (/bresaola/i.test(line)) return Math.round(g * 1.28);
  if (/cotto/i.test(line)) return Math.round(g * 1.22);
  if (/crudo/i.test(line)) return Math.round(g * 2.65);
  return Math.round(g * 1.5);
}

function composeSnack(
  m: MealMacroTargets,
  seed: number,
  variant: "snack_am" | "snack_pm",
  ctx?: MediterraneanDayContext,
): MediterraneanComposedMeal {
  const K = Math.max(120, m.kcal);
  /** Spuntino mattutino tendenzialmente più “dolce”; pomeridiano più salato (con piccola rotazione). */
  let sweet = variant === "snack_am";
  if (seed % 7 === 0) sweet = !sweet;
  /** Dopo ricalibrazione orari (es. post-seduta): spuntino più CHO, senza variante salata pesante. */
  const postSlot = Boolean(ctx?.postWorkoutMealBySlot?.[variant]);
  if (postSlot) sweet = true;

  const items: IntelligentMealPlanItemOut[] = [];
  const lines: string[] = [];

  if (sweet) {
    const yg = clamp(120 + K * 0.08, 125, 220);
    const yk = yg * D.yogurtKcalPerG;
    items.push(item("Yogurt", `${clamp(yg, 125, 220)} g yogurt`, yk, "protein", "Spuntino dolce: latticino + frutta."));
    lines.push(`${clamp(yg, 125, 220)} g yogurt`);

    const fruit = seed % 3 === 0 ? "1 frutto medio" : `${clamp(40 + (seed % 5) * 12, 40, 100)} g frutta fresca o frutti di bosco`;
    const fk = seed % 3 === 0 ? 80 : 55;
    items.push(item("Frutta", fruit, fk, "cho_heavy", "CHO e fibre."));
    lines.push(fruit);

    const cgLo = postSlot ? 18 : 12;
    const cgHi = postSlot ? 48 : 35;
    const cg = clamp((postSlot ? 18 : 12) + K * (postSlot ? 0.045 : 0.03), cgLo, cgHi);
    const ck = cg * D.cerealKcalPerG;
    items.push(
      item(
        "Cereali",
        `${clamp(cg, cgLo, cgHi)} g cereali / muesli (sul yogurt)`,
        ck,
        "cho_heavy",
        postSlot
          ? "Spuntino post-rientro orari: più cereali sul target CHO (refeed leggero)."
          : "Completa lo spuntino senza seconda fonte proteica animale.",
      ),
    );
    lines.push(`${clamp(cg, cgLo, cgHi)} g cereali o muesli`);
  } else {
    const crG = postSlot ? clamp(36 + (seed % 4) * 8, 32, 58) : clamp(28 + (seed % 4) * 6, 24, 48);
    const crK = crG * D.crackerKcalPerG;
    items.push(item("Gallette / pane", `${crG} g gallette integrali o pane tostato`, crK, "cho_heavy", "Base croccante; una fonte proteica sotto."));
    lines.push(`${crG} g gallette o pane tostato`);

    const cold = postSlot
      ? seed % 2 === 0
        ? "55 g prosciutto cotto magro"
        : "50 g bresaola"
      : seed % 3 === 0
        ? "60 g prosciutto cotto magro"
        : seed % 3 === 1
          ? "50 g bresaola"
          : "45 g prosciutto crudo";
    const pk = kcalFromDeliLine(cold);
    items.push(item("Affettato", cold, pk, "protein", postSlot ? "Proteina magra; variante meno grassa dopo spostamento orari." : "Proteina magra in spuntino salato."));
    lines.push(cold);

    const fatPick =
      seed % 2 === 0
        ? { line: "15 g avocado", kcal: 15 * D.avocadoKcalPerG, role: "fat" as const }
        : { line: "20 g grana grattugiato", kcal: 20 * D.granaKcalPerG, role: "fat" as const };
    items.push(item("Grasso spuntino", fatPick.line, fatPick.kcal, fatPick.role, "Una sola fonte di grasso aggiunto oltre all’affettato."));
    lines.push(fatPick.line);
  }

  const s = items.reduce((a, i) => a + i.approxKcal, 0);
  return { lines, items, totalApproxKcal: s };
}

/** Piano mediterraneo: porzioni e kcal coerenti con il target dello slot. */
export function composeMediterraneanMeal(
  slot: MealSlotKey,
  macros: MealMacroTargets,
  ctx?: MediterraneanDayContext,
): MediterraneanComposedMeal {
  const seed = hashSeed(slot, macros.kcal);
  const breakfastCtx = ctx ?? createMediterraneanDayContext("");
  if (slot === "breakfast") return composeBreakfast(macros, seed, breakfastCtx);
  if (slot === "snack_am") return composeSnack(macros, seed, "snack_am", ctx);
  if (slot === "snack_pm") return composeSnack(macros, seed, "snack_pm", ctx);
  return composeMainMeal(slot, macros, seed, ctx);
}

