import type { IntelligentMealPlanItemOut, IntelligentMealPlanSlotOut } from "@/lib/nutrition/intelligent-meal-plan-types";

/** Stime educative quando `nutrients` non è ancora materializzato lato finalize. */
export function approxMacrosForPlanItem(item: IntelligentMealPlanItemOut): {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
} {
  if (item.nutrients) {
    const n = item.nutrients;
    return {
      kcal: Math.round(n.kcal),
      carbsG: round1(n.carbsG),
      proteinG: round1(n.proteinG),
      fatG: round1(n.fatG),
    };
  }
  const k = Math.max(1, item.approxKcal);
  const { carbKcalPct, proKcalPct, fatKcalPct } = roleToKcalSplit(item.macroRole);
  return {
    kcal: Math.round(k),
    carbsG: round1((k * carbKcalPct) / 4),
    proteinG: round1((k * proKcalPct) / 4),
    fatG: round1((k * fatKcalPct) / 9),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function roleToKcalSplit(role: IntelligentMealPlanItemOut["macroRole"]): {
  carbKcalPct: number;
  proKcalPct: number;
  fatKcalPct: number;
} {
  switch (role) {
    case "cho_heavy":
      return { carbKcalPct: 0.72, proKcalPct: 0.12, fatKcalPct: 0.16 };
    case "protein":
      return { carbKcalPct: 0.22, proKcalPct: 0.48, fatKcalPct: 0.3 };
    case "fat":
      return { carbKcalPct: 0.15, proKcalPct: 0.2, fatKcalPct: 0.65 };
    case "veg":
      return { carbKcalPct: 0.52, proKcalPct: 0.2, fatKcalPct: 0.28 };
    default:
      return { carbKcalPct: 0.48, proKcalPct: 0.28, fatKcalPct: 0.24 };
  }
}

/** IG stimato (non clinico): da ripartizione energia e ruolo macro. */
export function estimatedItemGlycemicIndex(item: IntelligentMealPlanItemOut): number {
  const { carbsG, proteinG, fatG } = approxMacrosForPlanItem(item);
  const denom = Math.max(1, carbsG * 4 + proteinG * 4 + fatG * 9);
  const carbEnergyPct = (carbsG * 4) / denom;
  let ig = 32 + carbEnergyPct * 52;
  if (item.macroRole === "cho_heavy") ig += 10;
  if (item.macroRole === "veg") ig -= 14;
  if (item.macroRole === "fat") ig -= 6;
  return Math.round(Math.min(92, Math.max(28, ig)));
}

export type GiBand = "low" | "med" | "high" | "vhigh";

export function bandFromGi(ig: number): GiBand {
  if (ig < 35) return "low";
  if (ig < 55) return "med";
  if (ig < 71) return "high";
  return "vhigh";
}

export function giBandLabelIt(band: GiBand): string {
  switch (band) {
    case "low":
      return "BASSO";
    case "med":
      return "MED";
    case "high":
      return "HIGH";
    case "vhigh":
      return "V.HIGH";
    default:
      return "";
  }
}

export function weightedAvgGlycemicIndex(items: Array<{ ig: number; kcal: number }>): number {
  const w = items.reduce((s, i) => s + Math.max(0, i.kcal), 0);
  if (w <= 0) return 50;
  const sum = items.reduce((s, i) => s + i.ig * Math.max(0, i.kcal), 0);
  return Math.round(sum / w);
}

export function parseGramsFromPortion(hint: string | undefined | null): number | undefined {
  if (!hint) return undefined;
  const m = hint.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?/i);
  if (!m) return undefined;
  return Math.round(Number(parseFloat(m[1].replace(",", "."))));
}

export function stimulusLabelFromAvgGi(avg: GiBand): { text: string; tone: "alto" | "medio" | "basso" } {
  if (avg === "vhigh" || avg === "high") return { text: "Stimolo ALTO", tone: "alto" };
  if (avg === "med") return { text: "Stimolo MEDIO", tone: "medio" };
  return { text: "Stimolo CONTENUTO", tone: "basso" };
}

/** Stima IG da grammi macro (uso righe «dry» / piano base senza item assembler). */
export function estimatedGlycemicIndexFromMacros(
  carbsG: number,
  proteinG: number,
  fatG: number,
  bias: "cho_heavy" | "balanced" | "protein" | "fat" | "veg" = "balanced",
): number {
  const denom = Math.max(1, carbsG * 4 + proteinG * 4 + fatG * 9);
  const carbEnergyPct = (carbsG * 4) / denom;
  let ig = 32 + carbEnergyPct * 52;
  if (bias === "cho_heavy") ig += 10;
  if (bias === "veg") ig -= 14;
  if (bias === "fat") ig -= 6;
  return Math.round(Math.min(92, Math.max(28, ig)));
}

/**
 * Converte righe testuali del piano deterministico (pathway) in voci exposition:
 * ripartizione uniforme dei macro del pasto sulla lista (stima educativa).
 */
export function buildExpositionItemsFromDryLines(
  lines: string[],
  totals: { kcal: number; carbsG: number; proteinG: number; fatG: number },
): Array<{
  sourceIndex: number;
  name: string;
  portionHint?: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  ig: number;
  weightG?: number;
}> {
  const trimmed = lines.map((l) => l.trim()).filter(Boolean);
  const n = Math.max(1, trimmed.length);
  const kEach = Math.max(0, totals.kcal) / n;
  const cEach = totals.carbsG / n;
  const pEach = totals.proteinG / n;
  const fEach = totals.fatG / n;
  return trimmed.map((line, ii) => {
    const kcal = Math.max(1, Math.round(kEach));
    const carbsG = round1(cEach);
    const proteinG = round1(pEach);
    const fatG = round1(fEach);
    const ig = estimatedGlycemicIndexFromMacros(carbsG, proteinG, fatG, "balanced");
    return {
      sourceIndex: ii,
      name: line,
      kcal,
      carbsG,
      proteinG,
      fatG,
      ig,
    };
  });
}

export function sumVisibleSlotMacros(
  slot: IntelligentMealPlanSlotOut,
  isVisible: (idx: number) => boolean,
  fallback: { kcal: number; carbsG: number; proteinG: number; fatG: number },
): { kcal: number; carbsG: number; proteinG: number; fatG: number } {
  let kcal = 0;
  let carbsG = 0;
  let proteinG = 0;
  let fatG = 0;
  for (let i = 0; i < slot.items.length; i++) {
    if (!isVisible(i)) continue;
    const m = approxMacrosForPlanItem(slot.items[i]);
    kcal += m.kcal;
    carbsG += m.carbsG;
    proteinG += m.proteinG;
    fatG += m.fatG;
  }
  if (kcal < 4) return { ...fallback };
  return {
    kcal: Math.round(kcal),
    carbsG: round1(carbsG),
    proteinG: round1(proteinG),
    fatG: round1(fatG),
  };
}
