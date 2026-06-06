import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import type { MealSlotAssemblyRole, SlotMacroTargets } from "@/lib/nutrition/v2/meal-slot-assembly-spec";

export type FdcAssemblyLine = {
  spec: MealSlotAssemblyRole;
  hit: FdcFoodBrowseHit;
};

function clampStep(n: number, lo: number, hi: number, step: number): number {
  const clamped = Math.max(lo, Math.min(hi, n));
  return Math.round(clamped / step) * step;
}

function macroPerG(hit: FdcFoodBrowseHit): { c: number; p: number; f: number } {
  return {
    c: hit.carbsPer100g / 100,
    p: hit.proteinPer100g / 100,
    f: hit.fatPer100g / 100,
  };
}

/**
 * Coordinate descent su grammi FDC — stessa logica di `solvePortionsByMacros` (mediterranean-meal-composer).
 * Leve: cho / protein / fat; voci `fixed` (verdura) a grammi costanti.
 */
export function solveFdcMealPortions(lines: FdcAssemblyLine[], target: SlotMacroTargets): number[] {
  const grams = lines.map((line) => {
    if (line.spec.lever === "fixed") {
      return clampStep(line.spec.fixedG ?? line.spec.minG, line.spec.minG, line.spec.maxG, line.spec.stepG);
    }
    return line.spec.minG;
  });

  const idxOf = (lever: "cho" | "protein" | "fat") => lines.findIndex((l) => l.spec.lever === lever);

  const choIdx = idxOf("cho");
  const proIdx = idxOf("protein");
  const fatIdx = idxOf("fat");

  const sumMacro = (m: "c" | "p" | "f"): number =>
    lines.reduce((acc, line, i) => acc + grams[i]! * macroPerG(line.hit)[m], 0);

  const adjust = (idx: number, m: "c" | "p" | "f", t: number): void => {
    if (idx < 0) return;
    const line = lines[idx]!;
    const perG = macroPerG(line.hit)[m];
    if (perG <= 0) return;
    const others = sumMacro(m) - grams[idx]! * perG;
    grams[idx] = clampStep((t - others) / perG, line.spec.minG, line.spec.maxG, line.spec.stepG);
  };

  for (let it = 0; it < 20; it++) {
    adjust(proIdx, "p", Math.max(0, target.proteinG));
    adjust(choIdx, "c", Math.max(0, target.carbsG));
    adjust(fatIdx, "f", Math.max(0, target.fatG));
  }

  return grams;
}
