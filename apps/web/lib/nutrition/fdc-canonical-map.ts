import type { CanonicalFoodNutrients } from "@/lib/nutrition/canonical-food-composition";
import { fdcIdForCanonicalKey } from "@/lib/nutrition/canonical-food-fdc-aliases";
import type { FdcCachedFood } from "@/lib/nutrition/fdc-food-cache";

const FDC_NUTRIENT_TO_CANONICAL: Record<number, keyof CanonicalFoodNutrients> = {
  1008: "kcalPer100g",
  1003: "proteinG",
  1005: "carbsG",
  1004: "fatG",
  1079: "fiberG",
  1258: "saturatedFatG",
  1292: "monoFatG",
  1293: "polyFatG",
  1106: "vitA_mcg_RAE",
  1162: "vitC_mg",
  1114: "vitD_mcg",
  1109: "vitE_mg",
  1185: "vitK_mcg",
  1165: "thiamineB1_mg",
  1166: "riboflavinB2_mg",
  1167: "niacinB3_mg",
  1175: "vitB6_mg",
  1177: "folate_mcg",
  1178: "vitB12_mcg",
  1087: "ca_mg",
  1089: "fe_mg",
  1090: "mg_mg",
  1091: "p_mg",
  1092: "k_mg",
  1093: "na_mg",
  1095: "zn_mg",
  1103: "se_mcg",
  1210: "eaa_trp",
  1211: "eaa_thr",
  1212: "eaa_ile",
  1213: "eaa_leu",
  1214: "eaa_lys",
  1215: "eaa_met",
  1217: "eaa_phe",
  1219: "eaa_val",
  1221: "eaa_his",
};

const FDC_OMEGA3_IDS = [1404, 1278, 1279, 1280, 1405, 1406];

const ZERO_CANONICAL: CanonicalFoodNutrients = {
  kcalPer100g: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  saturatedFatG: 0,
  monoFatG: 0,
  polyFatG: 0,
  omega3G: 0,
  vitA_mcg_RAE: 0,
  vitC_mg: 0,
  vitD_mcg: 0,
  vitE_mg: 0,
  vitK_mcg: 0,
  thiamineB1_mg: 0,
  riboflavinB2_mg: 0,
  niacinB3_mg: 0,
  vitB6_mg: 0,
  folate_mcg: 0,
  vitB12_mcg: 0,
  ca_mg: 0,
  fe_mg: 0,
  mg_mg: 0,
  p_mg: 0,
  k_mg: 0,
  na_mg: 0,
  zn_mg: 0,
  se_mcg: 0,
  eaa_leu: 0,
  eaa_lys: 0,
  eaa_met: 0,
  eaa_phe: 0,
  eaa_thr: 0,
  eaa_trp: 0,
  eaa_ile: 0,
  eaa_val: 0,
  eaa_his: 0,
};

export function fdcCachedFoodToCanonical(food: FdcCachedFood): CanonicalFoodNutrients {
  const out: CanonicalFoodNutrients = { ...ZERO_CANONICAL };
  out.kcalPer100g = Math.max(0, Number(food.kcalPer100g ?? 0));
  out.proteinG = Math.max(0, Number(food.proteinPer100g ?? 0));
  out.carbsG = Math.max(0, Number(food.carbsPer100g ?? 0));
  out.fatG = Math.max(0, Number(food.fatPer100g ?? 0));
  out.fiberG = Math.max(0, Number(food.fiberPer100g ?? 0));
  out.na_mg = Math.max(0, Number(food.sodiumMgPer100g ?? 0));

  let omega3 = 0;
  const apply = (rows: { nutrientId: number; amountPer100g: number }[]) => {
    for (const r of rows) {
      const target = FDC_NUTRIENT_TO_CANONICAL[r.nutrientId];
      if (target) {
        const v = Math.max(0, Number(r.amountPer100g ?? 0));
        (out as Record<string, number>)[target] = v;
      }
      if (FDC_OMEGA3_IDS.includes(r.nutrientId)) {
        omega3 += Math.max(0, Number(r.amountPer100g ?? 0));
      }
    }
  };
  apply(food.vitamins);
  apply(food.minerals);
  apply(food.aminoAcids);
  apply(food.fattyAcids);
  apply(food.otherNutrients);
  out.omega3G = Number(omega3.toFixed(3));
  return out;
}

export function metabolicIndicesPer100gFromFdc(food: FdcCachedFood): { gi: number; ii: number; glPer100g: number } {
  return {
    gi: Number(food.glycemicIndexEstimate ?? 0) || 0,
    ii: Number(food.insulinIndexEstimate ?? 0) || 0,
    glPer100g: Number(food.glycemicLoadPer100g ?? 0) || 0,
  };
}

export type FdcCanonicalSnapshot = Record<
  string,
  { canonical: CanonicalFoodNutrients; gi: number; ii: number; glPer100g: number; fdcId: number; description: string }
>;

function snapshotEntryFromCachedFood(food: FdcCachedFood, fdcId: number): FdcCanonicalSnapshot[string] | null {
  const canonical = fdcCachedFoodToCanonical(food);
  if (!canonical.kcalPer100g) return null;
  const indices = metabolicIndicesPer100gFromFdc(food);
  return { canonical, ...indices, fdcId, description: food.description };
}

export function buildFdcCanonicalSnapshotFromFoods(
  canonicalKeys: string[],
  foodsByFdcId: Map<number, FdcCachedFood>,
): FdcCanonicalSnapshot {
  const out: FdcCanonicalSnapshot = {};
  for (const key of new Set(canonicalKeys)) {
    const fdcId = fdcIdForCanonicalKey(key);
    if (!fdcId) continue;
    const food = foodsByFdcId.get(fdcId);
    if (!food) continue;
    const entry = snapshotEntryFromCachedFood(food, fdcId);
    if (entry) out[key] = entry;
  }
  return out;
}

/** Snapshot keyed by `fdc:{id}` per meal plan V2 (nutrienti reali dal fdc_id scelto). */
export function buildFdcCanonicalSnapshotFromFdcIds(
  fdcIds: number[],
  foodsByFdcId: Map<number, FdcCachedFood>,
): FdcCanonicalSnapshot {
  const out: FdcCanonicalSnapshot = {};
  for (const id of new Set(fdcIds)) {
    if (!Number.isFinite(id) || id < 1) continue;
    const food = foodsByFdcId.get(id);
    if (!food) continue;
    const entry = snapshotEntryFromCachedFood(food, id);
    if (entry) out[`fdc:${id}`] = entry;
  }
  return out;
}
