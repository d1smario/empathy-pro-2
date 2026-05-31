import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";

export type PathwayAbsorptionHint = {
  nutrientId: string;
  slotPreference: MealSlotKey[];
  avoidWith: string[];
  pairWith: string[];
  rationaleIt: string;
};

const IRON_HINT: PathwayAbsorptionHint = {
  nutrientId: "fe_mg",
  slotPreference: ["lunch", "dinner"],
  avoidWith: ["tè", "caffè", "calcio contemporaneo"],
  pairWith: ["vitamina C", "pasto misto"],
  rationaleIt: "Ferro alimentare: preferire pranzo/cena lontano da tannini/calcio; associare vit C (modello qualitativo).",
};

const B12_HINT: PathwayAbsorptionHint = {
  nutrientId: "vitB12_mcg",
  slotPreference: ["breakfast", "lunch"],
  avoidWith: ["alcol mattutino"],
  pairWith: ["proteine", "pasto completo"],
  rationaleIt: "B12: assorbimento migliore con pasto proteico regolare (classe emivita oraria).",
};

const VIT_D_HINT: PathwayAbsorptionHint = {
  nutrientId: "vitD_mcg",
  slotPreference: ["lunch", "dinner"],
  avoidWith: ["pasto iperlipidico estremo pre-intenso"],
  pairWith: ["grassi insaturi moderati"],
  rationaleIt: "Vitamina D liposolubile: con pasto contenente grassi moderati.",
};

const FAT_SOLUBLE_HINT: PathwayAbsorptionHint = {
  nutrientId: "vitA_mcg_RAE",
  slotPreference: ["lunch", "dinner"],
  avoidWith: [],
  pairWith: ["olio EVO", "grassi insaturi"],
  rationaleIt: "Micronutrienti liposolubili: preferire pasti principali con grassi alimentari.",
};

function pathwayText(vm: NutritionPathwayModulationViewModel | null | undefined): string {
  if (!vm?.pathways?.length) return "";
  return vm.pathways
    .flatMap((p) => [...(p.cofactors ?? []), ...(p.inhibitorsToAvoid ?? []), p.pathwayLabel])
    .join(" ")
    .toLowerCase();
}

/** Hint qualitativi PK v2 (classi emivita, no concentrazioni plasmatiche). */
export function buildPathwayAbsorptionHints(
  vm: NutritionPathwayModulationViewModel | null | undefined,
): PathwayAbsorptionHint[] {
  const haystack = pathwayText(vm);
  const out: PathwayAbsorptionHint[] = [];
  if (/ferr|iron|ferro|eritropo/i.test(haystack)) out.push(IRON_HINT);
  if (/b12|cobalam/i.test(haystack)) out.push(B12_HINT);
  if (/vit\s*d|vitamina d|colecalcif/i.test(haystack)) out.push(VIT_D_HINT);
  if (/vit\s*a|vit\s*e|vit\s*k|liposolub/i.test(haystack)) out.push(FAT_SOLUBLE_HINT);
  return out;
}

export function buildPathwayAbsorptionTimingLines(
  vm: NutritionPathwayModulationViewModel | null | undefined,
): string[] {
  return buildPathwayAbsorptionHints(vm).map(
    (h) => `[assorbimento] ${h.nutrientId}: slot=${h.slotPreference.join("/")} · ${h.rationaleIt}`,
  );
}

export function preferredSlotsForNutrientBoost(
  nutrientId: string,
  vm: NutritionPathwayModulationViewModel | null | undefined,
): MealSlotKey[] | null {
  const hint = buildPathwayAbsorptionHints(vm).find((h) => h.nutrientId === nutrientId);
  return hint?.slotPreference ?? null;
}
