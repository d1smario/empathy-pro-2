import type { IntelligentMealPlanItemOut, IntelligentMealPlanSlotOut } from "@/lib/nutrition/intelligent-meal-plan-types";
import { nutrientsForMealPlanItem } from "@/lib/nutrition/canonical-food-composition";

/**
 * Macro per voce: sempre da banca canonica (nome+porzione+approxKcal), coerente con finalize server.
 * Non usare `item.nutrients` qui: evita righe tutte uguali se il client riceve blob omogenei o path «dry» senza item strutturati.
 */
export function approxMacrosForPlanItem(item: IntelligentMealPlanItemOut): {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
} {
  const { nutrients } = nutrientsForMealPlanItem({
    name: item.name,
    portionHint: item.portionHint ?? "",
    approxKcal: item.approxKcal,
  });
  return {
    kcal: Math.round(nutrients.kcal),
    carbsG: round1(nutrients.carbsG),
    proteinG: round1(nutrients.proteinG),
    fatG: round1(nutrients.fatG),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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
  const gm = hint.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?\b/i);
  if (gm) return Math.round(Number(parseFloat(gm[1].replace(",", "."))));
  const ml = hint.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (ml && /olio|evo|olive\s+oil/i.test(hint)) {
    return Math.round(Number(parseFloat(ml[1].replace(",", "."))) * 0.92);
  }
  return undefined;
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
 * Righe testuali del piano base (pathway): stesse kcal per voce (quota sul totale pasto),
 * ma CHO/PRO/FAT/IG da inferenza canonica sulla stringa (non ripartizione uniforme dei macro).
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
  return trimmed.map((line, ii) => {
    const kcal = Math.max(1, Math.round(kEach));
    const stub: IntelligentMealPlanItemOut = {
      name: line,
      portionHint: "",
      functionalBridge: "",
      approxKcal: kcal,
      macroRole: "mixed",
    };
    const m = approxMacrosForPlanItem(stub);
    const ig = estimatedItemGlycemicIndex(stub);
    return {
      sourceIndex: ii,
      name: line,
      kcal: m.kcal,
      carbsG: m.carbsG,
      proteinG: m.proteinG,
      fatG: m.fatG,
      ig,
      weightG: parseGramsFromPortion(line),
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
