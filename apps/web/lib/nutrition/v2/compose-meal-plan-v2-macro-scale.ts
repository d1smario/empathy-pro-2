import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import type { SlotBranchSpec } from "@/lib/nutrition/v2/fdc-pool-specs";

export type BranchMacroTargets = {
  choG: number;
  proG: number;
  fatG: number;
  kcal: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Quota macro per leva (allineato al solver mediterraneo V1). */
export function branchMacroTargets(
  slot: { kcal: number; carbs: number; protein: number; fat: number },
  branch: SlotBranchSpec,
): BranchMacroTargets {
  const share = branch.kcalShare;
  if (branch.macroRole === "cho_heavy") {
    return {
      choG: slot.carbs * 0.55,
      proG: slot.protein * 0.04,
      fatG: slot.fat * 0.05,
      kcal: slot.kcal * share,
    };
  }
  if (branch.macroRole === "protein") {
    return {
      choG: slot.carbs * 0.04,
      proG: slot.protein * 0.78,
      fatG: slot.fat * 0.35,
      kcal: slot.kcal * share,
    };
  }
  if (branch.macroRole === "veg") {
    return {
      choG: slot.carbs * 0.1,
      proG: slot.protein * 0.08,
      fatG: slot.fat * 0.05,
      kcal: slot.kcal * Math.min(0.18, share),
    };
  }
  return {
    choG: slot.carbs * 0.35,
    proG: slot.protein * 0.25,
    fatG: slot.fat * 0.2,
    kcal: slot.kcal * share,
  };
}

const GRAM_LIMITS: Record<SlotBranchSpec["macroRole"], { min: number; max: number }> = {
  cho_heavy: { min: 45, max: 220 },
  protein: { min: 80, max: 320 },
  veg: { min: 80, max: 220 },
  mixed: { min: 30, max: 200 },
};

/** Grammi per raggiungere il macro dominante del branch (non solo kcal). */
export function gramsForBranchTarget(
  hit: FdcFoodBrowseHit,
  branch: SlotBranchSpec,
  targets: BranchMacroTargets,
): number {
  const { min, max } = GRAM_LIMITS[branch.macroRole];

  if (branch.macroRole === "cho_heavy" && hit.carbsPer100g >= 8) {
    return clamp((targets.choG / hit.carbsPer100g) * 100, min, max);
  }
  if (branch.macroRole === "protein" && hit.proteinPer100g >= 6) {
    return clamp((targets.proG / hit.proteinPer100g) * 100, min, max);
  }
  if (branch.macroRole === "veg") {
    return clamp(120, min, max);
  }
  if (branch.macroRole === "mixed" && hit.carbsPer100g >= 5) {
    return clamp((targets.choG / hit.carbsPer100g) * 100, min, max);
  }
  if (hit.kcalPer100g > 0) {
    return clamp((targets.kcal / hit.kcalPer100g) * 100, min, max);
  }
  return min;
}
