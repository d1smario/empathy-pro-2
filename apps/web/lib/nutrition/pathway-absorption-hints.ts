import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import { catalogIdToNutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";

export type PathwayAbsorptionHint = {
  nutrientId: NutrientTargetId;
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

const B1_HINT: PathwayAbsorptionHint = {
  nutrientId: "thiamineB1_mg",
  slotPreference: ["breakfast", "lunch"],
  avoidWith: ["alcol nelle ore pre-carico intenso"],
  pairWith: ["CHO complessi", "pasto misto"],
  rationaleIt: "Tiamina (PDH/glicolisi): distribuzione su colazione/pranzo regolari (enzyme-linked v3).",
};

const FOLATE_HINT: PathwayAbsorptionHint = {
  nutrientId: "folate_mcg",
  slotPreference: ["lunch", "dinner"],
  avoidWith: [],
  pairWith: ["verdure a foglia", "legumi"],
  rationaleIt: "Folati: preferenza pranzo/cena; integrazione orale una sola volta al giorno se non coperto dal menu.",
};

const ZN_HINT: PathwayAbsorptionHint = {
  nutrientId: "zn_mg",
  slotPreference: ["lunch", "dinner"],
  avoidWith: ["ferro contemporaneo", "fibre molto alte nello stesso momento"],
  pairWith: ["proteine", "pasto misto"],
  rationaleIt: "Zinco: assorbimento migliore lontano da ferro e fibre concentrate.",
};

const VIT_C_HINT: PathwayAbsorptionHint = {
  nutrientId: "vitC_mg",
  slotPreference: ["breakfast", "snack_am"],
  avoidWith: [],
  pairWith: ["frutta", "pasto leggero"],
  rationaleIt: "Vitamina C idrosolubile: colazione/spuntino; non ripetere integrazione su più pasti.",
};

const MG_HINT: PathwayAbsorptionHint = {
  nutrientId: "mg_mg",
  slotPreference: ["lunch", "snack_pm"],
  avoidWith: [],
  pairWith: ["pasto misto", "idratazione"],
  rationaleIt: "Magnesio (PFK/PDH): preferenza pranzo/spuntino pomeridiano peri-stimolo.",
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

const STATIC_HINTS: PathwayAbsorptionHint[] = [
  IRON_HINT,
  B12_HINT,
  B1_HINT,
  FOLATE_HINT,
  ZN_HINT,
  VIT_C_HINT,
  MG_HINT,
  VIT_D_HINT,
  FAT_SOLUBLE_HINT,
];

function pathwayText(vm: NutritionPathwayModulationViewModel | null | undefined): string {
  if (!vm?.pathways?.length) return "";
  return vm.pathways
    .flatMap((p) => [
      ...(p.cofactors ?? []),
      ...(p.inhibitorsToAvoid ?? []),
      p.pathwayLabel,
      ...(p.stimulatedBy ?? []),
    ])
    .join(" ")
    .toLowerCase();
}

function hasStimulatedNode(vm: NutritionPathwayModulationViewModel | null | undefined, nodeId: string): boolean {
  return Boolean(vm?.pathways.some((p) => p.stimulatedBy?.includes(nodeId)));
}

function mergeHintsByNutrient(hints: PathwayAbsorptionHint[]): PathwayAbsorptionHint[] {
  const byId = new Map<NutrientTargetId, PathwayAbsorptionHint>();
  for (const h of hints) {
    if (!byId.has(h.nutrientId)) byId.set(h.nutrientId, h);
  }
  return [...byId.values()];
}

/** Hint qualitativi PK v2/v3 (classi emivita + enzyme-linked slot prefs). */
export function buildPathwayAbsorptionHints(
  vm: NutritionPathwayModulationViewModel | null | undefined,
): PathwayAbsorptionHint[] {
  const haystack = pathwayText(vm);
  const out: PathwayAbsorptionHint[] = [];
  if (/ferr|iron|ferro|eritropo/i.test(haystack)) out.push(IRON_HINT);
  if (/b12|cobalam/i.test(haystack)) out.push(B12_HINT);
  if (/tiamin|thiamin|\bb1\b|pdh|piruvato/i.test(haystack)) out.push(B1_HINT);
  if (/folat|folic|b9|b-9/i.test(haystack)) out.push(FOLATE_HINT);
  if (/zinc|\bzn\b/i.test(haystack)) out.push(ZN_HINT);
  if (/vit\s*c|vitamina c|ascorb/i.test(haystack)) out.push(VIT_C_HINT);
  if (/magnes|\bmg\b|pfk|chinasi/i.test(haystack)) out.push(MG_HINT);
  if (/vit\s*d|vitamina d|colecalcif/i.test(haystack)) out.push(VIT_D_HINT);
  if (/vit\s*a|vit\s*e|vit\s*k|liposolub/i.test(haystack)) out.push(FAT_SOLUBLE_HINT);

  if (hasStimulatedNode(vm, "enzyme.pdh")) {
    if (!out.some((h) => h.nutrientId === "thiamineB1_mg")) out.push(B1_HINT);
    if (!out.some((h) => h.nutrientId === "mg_mg")) out.push(MG_HINT);
  }
  if (hasStimulatedNode(vm, "enzyme.pfk") && !out.some((h) => h.nutrientId === "mg_mg")) {
    out.push(MG_HINT);
  }

  return mergeHintsByNutrient(out);
}

export function buildPathwayAbsorptionTimingLines(
  vm: NutritionPathwayModulationViewModel | null | undefined,
): string[] {
  return buildPathwayAbsorptionHints(vm).map(
    (h) => `[assorbimento] ${h.nutrientId}: slot=${h.slotPreference.join("/")} · ${h.rationaleIt}`,
  );
}

export function resolveNutrientTargetIdForHintLookup(nutrientOrCatalogId: string): NutrientTargetId | null {
  const fromCatalog = catalogIdToNutrientTargetId(nutrientOrCatalogId);
  if (fromCatalog) return fromCatalog;
  if (STATIC_HINTS.some((h) => h.nutrientId === nutrientOrCatalogId)) {
    return nutrientOrCatalogId as NutrientTargetId;
  }
  return null;
}

export function preferredSlotsForNutrientBoost(
  nutrientId: string,
  vm: NutritionPathwayModulationViewModel | null | undefined,
): MealSlotKey[] | null {
  const resolved = resolveNutrientTargetIdForHintLookup(nutrientId) ?? nutrientId;
  const hint = buildPathwayAbsorptionHints(vm).find((h) => h.nutrientId === resolved);
  return hint?.slotPreference ?? null;
}

export function slotPriorityForNutrientTarget(
  nutrientOrCatalogId: string,
  vm: NutritionPathwayModulationViewModel | null | undefined,
  focusFallback: MealSlotKey[],
): MealSlotKey[] {
  const prefs = preferredSlotsForNutrientBoost(nutrientOrCatalogId, vm);
  if (!prefs?.length) return focusFallback;
  const rest = focusFallback.filter((s) => !prefs.includes(s));
  return [...prefs, ...rest];
}

export function nutrientBoostAppliesToSlot(
  nutrientId: string,
  slot: MealSlotKey,
  vm: NutritionPathwayModulationViewModel | null | undefined,
): boolean {
  const prefs = preferredSlotsForNutrientBoost(nutrientId, vm);
  if (!prefs?.length) return true;
  return prefs.includes(slot);
}

export function preferredSlotsLabelIt(
  nutrientId: string,
  vm: NutritionPathwayModulationViewModel | null | undefined,
): string[] {
  const prefs = preferredSlotsForNutrientBoost(nutrientId, vm);
  return prefs ?? [];
}
