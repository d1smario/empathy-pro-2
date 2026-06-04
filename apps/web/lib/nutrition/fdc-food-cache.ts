import "server-only";

import { buildNutritionFdcFoodUpsertPayloadFromUsdaRaw } from "@/lib/nutrition/fdc-import-row";
import { isFdcCacheOnly } from "@/lib/nutrition/fdc-runtime-config";
import { partitionFdcNutrientsFromCompact, type FdcMicroPer100g } from "@/lib/nutrition/fdc-micronutrient-extract";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scaleMacrosFromPer100g, type FdcPer100gMacros } from "@/lib/nutrition/usda-fdc-food-detail";

export type FdcCachedFood = FdcPer100gMacros & {
  publicationDate: string | null;
  foodCategory: string | null;
  fiberPer100g: number | null;
  sugarsPer100g: number | null;
  glycemicIndexEstimate: number | null;
  insulinIndexEstimate: number | null;
  glycemicLoadPer100g: number | null;
  insulinLoadPer100g: number | null;
  metabolicIndices: Record<string, unknown>;
  vitamins: FdcMicroPer100g[];
  minerals: FdcMicroPer100g[];
  aminoAcids: FdcMicroPer100g[];
  fattyAcids: FdcMicroPer100g[];
  otherNutrients: FdcMicroPer100g[];
};

export type ScaledMicronutrientSnapshot = {
  vitamins: FdcMicroPer100g[];
  minerals: FdcMicroPer100g[];
  aminoAcids: FdcMicroPer100g[];
  fattyAcids: FdcMicroPer100g[];
  otherNutrients: FdcMicroPer100g[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const FDC_BATCH_SELECT_CHUNK = 80;

function asMicroArray(v: unknown): FdcMicroPer100g[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const nutrientIdRaw = toNumber(r.nutrientId);
      const amountRaw = toNumber(r.amountPer100g);
      const name = typeof r.name === "string" ? r.name : "";
      const unit = typeof r.unit === "string" ? r.unit : "—";
      if (!nutrientIdRaw || !name || amountRaw == null) return null;
      return { nutrientId: Math.round(nutrientIdRaw), name, amountPer100g: amountRaw, unit };
    })
    .filter((row): row is FdcMicroPer100g => Boolean(row));
}

export function cachedFoodFromDbRow(row: Record<string, unknown>): FdcCachedFood {
  const base = {
    fdcId: Number(row.fdc_id),
    description: String(row.description ?? "Alimento FDC"),
    dataType: row.data_type != null ? String(row.data_type) : null,
    publicationDate: row.publication_date != null ? String(row.publication_date) : null,
    foodCategory: row.food_category != null ? String(row.food_category) : null,
    kcalPer100g: Number(row.kcal_100g ?? 0),
    carbsPer100g: Number(row.carbs_100g ?? 0),
    proteinPer100g: Number(row.protein_100g ?? 0),
    fatPer100g: Number(row.fat_100g ?? 0),
    fiberPer100g: row.fiber_100g != null ? Number(row.fiber_100g) : null,
    sugarsPer100g: row.sugars_100g != null ? Number(row.sugars_100g) : null,
    sodiumMgPer100g: row.sodium_mg_100g != null ? Number(row.sodium_mg_100g) : null,
    glycemicIndexEstimate: row.glycemic_index_estimate != null ? Number(row.glycemic_index_estimate) : null,
    insulinIndexEstimate: row.insulin_index_estimate != null ? Number(row.insulin_index_estimate) : null,
    glycemicLoadPer100g: row.glycemic_load_100g != null ? Number(row.glycemic_load_100g) : null,
    insulinLoadPer100g: row.insulin_load_100g != null ? Number(row.insulin_load_100g) : null,
    metabolicIndices: row.metabolic_indices && typeof row.metabolic_indices === "object" ? (row.metabolic_indices as Record<string, unknown>) : {},
  };
  const rawLines = asMicroArray(row.nutrients_raw);
  if (rawLines.length > 0) {
    const p = partitionFdcNutrientsFromCompact(rawLines);
    return {
      ...base,
      vitamins: p.vitamins,
      minerals: p.minerals,
      aminoAcids: p.aminoAcids,
      fattyAcids: p.fattyAcids,
      otherNutrients: p.other,
    };
  }
  return {
    ...base,
    vitamins: asMicroArray(row.vitamins),
    minerals: asMicroArray(row.minerals),
    aminoAcids: asMicroArray(row.amino_acids),
    fattyAcids: asMicroArray(row.fatty_acids),
    otherNutrients: asMicroArray(row.other_nutrients),
  };
}

async function fetchFdcFoodRaw(apiKey: string, fdcId: number): Promise<Record<string, unknown>> {
  const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`USDA FDC ${res.status}: ${text.slice(0, 160)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

export function scaleFdcMicros(food: FdcCachedFood, quantityG: number): ScaledMicronutrientSnapshot {
  const factor = quantityG / 100;
  const scale = (rows: FdcMicroPer100g[]): FdcMicroPer100g[] =>
    rows.map((row) => ({
      ...row,
      amountPer100g: Math.round(row.amountPer100g * factor * 1000) / 1000,
    }));
  return {
    vitamins: scale(food.vitamins),
    minerals: scale(food.minerals),
    aminoAcids: scale(food.aminoAcids),
    fattyAcids: scale(food.fattyAcids),
    otherNutrients: scale(food.otherNutrients),
  };
}

export function scaleFdcMetabolicIndices(food: FdcCachedFood, quantityG: number) {
  const factor = quantityG / 100;
  const glycemicLoad =
    food.glycemicLoadPer100g != null && Number.isFinite(factor) && factor > 0 ? round2(food.glycemicLoadPer100g * factor) : null;
  const insulinLoad =
    food.insulinLoadPer100g != null && Number.isFinite(factor) && factor > 0 ? round2(food.insulinLoadPer100g * factor) : null;

  return {
    glycemicIndexEstimate: food.glycemicIndexEstimate,
    insulinIndexEstimate: food.insulinIndexEstimate,
    glycemicLoad,
    insulinLoad,
    metabolicIndices: {
      ...food.metabolicIndices,
      quantityG,
      glycemicLoad,
      insulinLoad,
    },
  };
}

export function scaleMacrosFromCachedFdcFood(food: FdcCachedFood, quantityG: number) {
  return scaleMacrosFromPer100g(food, quantityG);
}

function chunkNumericIds(ids: number[], size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Lettura batch da `nutrition_fdc_foods` (nessuna chiamata USDA). */
export async function loadFdcFoodsByIds(fdcIds: number[]): Promise<Map<number, FdcCachedFood>> {
  const ids = [
    ...new Set(
      fdcIds
        .map((v) => Math.round(Number(v)))
        .filter((id) => Number.isFinite(id) && id >= 1),
    ),
  ];
  const out = new Map<number, FdcCachedFood>();
  if (ids.length === 0) return out;

  const admin = createSupabaseAdminClient();
  if (!admin) return out;

  for (const chunk of chunkNumericIds(ids, FDC_BATCH_SELECT_CHUNK)) {
    const { data, error } = await admin.from("nutrition_fdc_foods").select("*").in("fdc_id", chunk);
    if (error && error.code !== "42P01") break;
    if (!Array.isArray(data)) continue;
    for (const row of data) {
      const r = row as Record<string, unknown>;
      const id = Math.round(Number(r.fdc_id));
      if (Number.isFinite(id) && id >= 1) out.set(id, cachedFoodFromDbRow(r));
    }
  }
  return out;
}

/** Singola riga cache locale; non importa da USDA. */
export async function getFdcFoodFromCacheOnly(fdcId: number): Promise<FdcCachedFood | null> {
  const map = await loadFdcFoodsByIds([fdcId]);
  return map.get(Math.round(fdcId)) ?? null;
}

export async function getOrImportFdcFood(fdcId: number): Promise<FdcCachedFood | { error: string }> {
  const id = Math.round(Number(fdcId));
  if (!Number.isFinite(id) || id < 1) return { error: "fdcId non valido" };

  const cached = await getFdcFoodFromCacheOnly(id);
  if (cached) return cached;

  if (isFdcCacheOnly()) {
    return { error: "fdc_not_in_local_cache" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "service_role_unconfigured: SUPABASE_SERVICE_ROLE_KEY richiesta per cache USDA FDC." };

  const apiKey = process.env.USDA_API_KEY?.trim();
  if (!apiKey) return { error: "USDA_API_KEY non configurata: impossibile importare alimento FDC." };

  try {
    const raw = await fetchFdcFoodRaw(apiKey, id);
    const built = buildNutritionFdcFoodUpsertPayloadFromUsdaRaw(raw, { sourceTag: "get_or_import_fdc_food" });
    if ("error" in built) return built;

    const { data, error } = await admin
      .from("nutrition_fdc_foods")
      .upsert(built, { onConflict: "fdc_id" })
      .select("*")
      .single();
    if (error) return { error: error.message };
    return cachedFoodFromDbRow(data as Record<string, unknown>);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Import USDA FDC fallito." };
  }
}
