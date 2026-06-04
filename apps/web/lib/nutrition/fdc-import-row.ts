import { partitionFdcNutrientsFromCompact, type FdcMicroPer100g } from "@/lib/nutrition/fdc-micronutrient-extract";
import { summarizePer100gFromFdcNutrientRows } from "@/lib/nutrition/usda-fdc-food-detail";

export type NutritionFdcFoodUpsertPayload = {
  fdc_id: number;
  description: string;
  data_type: string | null;
  publication_date: string | null;
  food_category: string | null;
  kcal_100g: number;
  carbs_100g: number;
  protein_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  sugars_100g: number | null;
  sodium_mg_100g: number | null;
  glycemic_index_estimate: number;
  insulin_index_estimate: number;
  glycemic_load_100g: number;
  insulin_load_100g: number;
  metabolic_indices: Record<string, unknown>;
  vitamins: FdcMicroPer100g[];
  minerals: FdcMicroPer100g[];
  amino_acids: FdcMicroPer100g[];
  fatty_acids: FdcMicroPer100g[];
  other_nutrients: FdcMicroPer100g[];
  nutrients_raw: FdcMicroPer100g[];
  source_payload: Record<string, unknown>;
  refreshed_at: string;
};

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function nutrientName(row: Record<string, unknown>): string {
  const nested = row.nutrient as Record<string, unknown> | undefined;
  return String(nested?.name ?? row.nutrientName ?? "").trim();
}

function nutrientUnit(row: Record<string, unknown>): string {
  const nested = row.nutrient as Record<string, unknown> | undefined;
  return String(nested?.unitName ?? row.unitName ?? "").trim() || "—";
}

function nutrientId(row: Record<string, unknown>): number | null {
  const nested = row.nutrient as Record<string, unknown> | undefined;
  const raw = nested?.id ?? row.nutrientId;
  const id = toNumber(raw);
  return id != null && id > 0 ? Math.round(id) : null;
}

function nutrientAmount(row: Record<string, unknown>): number | null {
  const amount = toNumber(row.amount ?? row.value);
  return amount != null && amount >= 0 ? amount : null;
}

function pickNutrientByName(nutrients: Array<Record<string, unknown>>, names: string[]): number | null {
  const targets = names.map((n) => n.toLowerCase());
  for (const row of nutrients) {
    const name = nutrientName(row).toLowerCase();
    if (!name) continue;
    if (targets.some((target) => name === target || name.includes(target))) {
      const amount = nutrientAmount(row);
      if (amount != null) return amount;
    }
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function estimateMetabolicIndicesFromMacros(input: {
  carbsPer100g: number | null;
  proteinPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  sugarsPer100g: number | null;
}) {
  const carbs = Math.max(0, input.carbsPer100g ?? 0);
  const protein = Math.max(0, input.proteinPer100g ?? 0);
  const fat = Math.max(0, input.fatPer100g ?? 0);
  const fiber = Math.max(0, input.fiberPer100g ?? 0);
  const sugars = Math.max(0, input.sugarsPer100g ?? 0);
  const availableCarbs = Math.max(0, carbs - fiber);
  const carbEnergy = availableCarbs * 4;
  const proteinEnergy = protein * 4;
  const fatEnergy = fat * 9;
  const energy = Math.max(1, carbEnergy + proteinEnergy + fatEnergy);
  const carbEnergyPct = carbEnergy / energy;
  const sugarShare = availableCarbs > 0 ? sugars / availableCarbs : 0;
  const fiberDampening = Math.min(18, fiber * 1.2);

  const glycemicIndex = Math.min(92, Math.max(18, 28 + carbEnergyPct * 58 + sugarShare * 18 - fiberDampening - Math.min(10, fat * 0.45)));
  const insulinIndex = Math.min(
    115,
    Math.max(18, glycemicIndex * 0.72 + Math.min(28, protein * 1.25) + Math.min(12, fat * 0.35)),
  );
  const glycemicLoad = (glycemicIndex * availableCarbs) / 100;
  const insulinLoad = (insulinIndex * (availableCarbs + protein * 0.45)) / 100;

  return {
    glycemicIndexEstimate: round2(glycemicIndex),
    insulinIndexEstimate: round2(insulinIndex),
    glycemicLoadPer100g: round2(glycemicLoad),
    insulinLoadPer100g: round2(insulinLoad),
    metabolicIndices: {
      method: "macro_profile_estimate_v1",
      source: "derived_from_usda_fdc_cache",
      caveat: "Estimated from USDA macro profile; not a measured glycemic or insulin index.",
      availableCarbsPer100g: round2(availableCarbs),
      sugarShare: round2(sugarShare),
    },
  };
}

export function compactRawNutrientsFromUsdaRows(nutrients: Array<Record<string, unknown>>): FdcMicroPer100g[] {
  return nutrients
    .map((row) => {
      const id = nutrientId(row);
      const name = nutrientName(row);
      const amount = nutrientAmount(row);
      if (!id || !name || amount == null) return null;
      return {
        nutrientId: id,
        name,
        amountPer100g: amount,
        unit: nutrientUnit(row),
      };
    })
    .filter((row): row is FdcMicroPer100g => Boolean(row));
}

export function resolveFdcIdFromUsdaRaw(raw: Record<string, unknown>): number | null {
  const rawFdc = raw.fdcId ?? raw.fdc_id;
  const id = typeof rawFdc === "number" ? rawFdc : typeof rawFdc === "string" ? Number(rawFdc) : null;
  if (id == null || !Number.isFinite(id) || id < 1) return null;
  return Math.round(id);
}

/** Normalizza array alimenti da dump USDA (Foundation / SR Legacy JSON). */
export function parseUsdaDumpFoodRows(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  for (const key of ["FoundationFoods", "SRLegacyFoods", "BrandedFoods", "foods", "Foods"]) {
    const arr = o[key];
    if (Array.isArray(arr)) return arr.filter((r) => r && typeof r === "object") as Record<string, unknown>[];
  }
  return [];
}

export function buildNutritionFdcFoodUpsertPayloadFromUsdaRaw(
  raw: Record<string, unknown>,
  opts?: { sourceTag?: string; refreshedAt?: string },
): NutritionFdcFoodUpsertPayload | { error: string } {
  const id = resolveFdcIdFromUsdaRaw(raw);
  if (!id) return { error: "fdcId non valido" };

  const nutrients = (Array.isArray(raw.foodNutrients) ? raw.foodNutrients : []) as Array<Record<string, unknown>>;
  const macros = summarizePer100gFromFdcNutrientRows(nutrients);
  if (macros.kcalPer100g == null && macros.carbsPer100g == null && macros.proteinPer100g == null && macros.fatPer100g == null) {
    return { error: "Nessun nutriente per 100 g riconosciuto nella risposta FDC" };
  }

  const rawCompact = compactRawNutrientsFromUsdaRows(nutrients);
  const parts = partitionFdcNutrientsFromCompact(rawCompact);
  const fiberPer100g = pickNutrientByName(nutrients, ["fiber, total dietary", "fiber"]);
  const sugarsPer100g = pickNutrientByName(nutrients, ["sugars, total including", "sugars, total"]);
  const metabolic = estimateMetabolicIndicesFromMacros({
    carbsPer100g: macros.carbsPer100g,
    proteinPer100g: macros.proteinPer100g,
    fatPer100g: macros.fatPer100g,
    fiberPer100g,
    sugarsPer100g,
  });

  const sourceTag = opts?.sourceTag ?? "usda_fdc_import";
  return {
    fdc_id: id,
    description: String(raw.description ?? "Alimento FDC"),
    data_type: raw.dataType != null ? String(raw.dataType) : raw.data_type != null ? String(raw.data_type) : null,
    publication_date: raw.publicationDate != null ? String(raw.publicationDate) : null,
    food_category: raw.foodCategory != null ? String(raw.foodCategory) : null,
    kcal_100g: Math.max(0, macros.kcalPer100g ?? 0),
    carbs_100g: Math.max(0, macros.carbsPer100g ?? 0),
    protein_100g: Math.max(0, macros.proteinPer100g ?? 0),
    fat_100g: Math.max(0, macros.fatPer100g ?? 0),
    fiber_100g: fiberPer100g,
    sugars_100g: sugarsPer100g,
    sodium_mg_100g: macros.sodiumMgPer100g,
    glycemic_index_estimate: metabolic.glycemicIndexEstimate,
    insulin_index_estimate: metabolic.insulinIndexEstimate,
    glycemic_load_100g: metabolic.glycemicLoadPer100g,
    insulin_load_100g: metabolic.insulinLoadPer100g,
    metabolic_indices: {
      ...metabolic.metabolicIndices,
      importSource: sourceTag,
    },
    vitamins: parts.vitamins,
    minerals: parts.minerals,
    amino_acids: parts.aminoAcids,
    fatty_acids: parts.fattyAcids,
    other_nutrients: parts.other,
    nutrients_raw: rawCompact,
    source_payload: {
      fdcId: raw.fdcId ?? id,
      dataType: raw.dataType ?? raw.data_type ?? null,
      description: raw.description ?? null,
      foodClass: raw.foodClass ?? null,
      importSource: sourceTag,
    },
    refreshed_at: opts?.refreshedAt ?? new Date().toISOString(),
  };
}
