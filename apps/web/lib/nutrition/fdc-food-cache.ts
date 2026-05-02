import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  scaleMacrosFromPer100g,
  summarizePer100gFromFdcNutrientRows,
  type FdcPer100gMacros,
} from "@/lib/nutrition/usda-fdc-food-detail";
import {
  bucketForFdcNutrientName,
  extractMicroNutrientsPer100g,
  type FdcMicroBucket,
  type FdcMicroPer100g,
} from "@/lib/nutrition/fdc-micronutrient-extract";

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

function estimateMetabolicIndices(input: {
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

function compactRawNutrients(nutrients: Array<Record<string, unknown>>): FdcMicroPer100g[] {
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

function bucketMicros(micros: FdcMicroPer100g[]): Record<FdcMicroBucket, FdcMicroPer100g[]> {
  const out: Record<FdcMicroBucket, FdcMicroPer100g[]> = {
    vitamins: [],
    minerals: [],
    aminoAcids: [],
    fattyAcids: [],
  };
  for (const row of micros) {
    const bucket = bucketForFdcNutrientName(row.name);
    if (bucket) out[bucket].push(row);
  }
  return out;
}

function otherNutrients(raw: Array<Record<string, unknown>>, micros: FdcMicroPer100g[]): FdcMicroPer100g[] {
  const known = new Set(micros.map((m) => m.nutrientId));
  return raw
    .map((row) => {
      const id = nutrientId(row);
      const name = nutrientName(row);
      const amount = nutrientAmount(row);
      if (!id || !name || amount == null || known.has(id)) return null;
      return { nutrientId: id, name, amountPer100g: amount, unit: nutrientUnit(row) };
    })
    .filter((row): row is FdcMicroPer100g => Boolean(row));
}

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

function rowToCachedFood(row: Record<string, unknown>): FdcCachedFood {
  return {
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

export async function getOrImportFdcFood(fdcId: number): Promise<FdcCachedFood | { error: string }> {
  const id = Math.round(Number(fdcId));
  if (!Number.isFinite(id) || id < 1) return { error: "fdcId non valido" };

  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "service_role_unconfigured: SUPABASE_SERVICE_ROLE_KEY richiesta per cache USDA FDC." };

  const { data: existing, error: selectError } = await admin
    .from("nutrition_fdc_foods")
    .select("*")
    .eq("fdc_id", id)
    .maybeSingle();
  if (selectError && selectError.code !== "42P01") return { error: selectError.message };
  if (existing) return rowToCachedFood(existing as Record<string, unknown>);

  const apiKey = process.env.USDA_API_KEY?.trim();
  if (!apiKey) return { error: "USDA_API_KEY non configurata: impossibile importare alimento FDC." };

  try {
    const raw = await fetchFdcFoodRaw(apiKey, id);
    const nutrients = (Array.isArray(raw.foodNutrients) ? raw.foodNutrients : []) as Array<Record<string, unknown>>;
    const macros = summarizePer100gFromFdcNutrientRows(nutrients);
    if (macros.kcalPer100g == null && macros.carbsPer100g == null && macros.proteinPer100g == null && macros.fatPer100g == null) {
      return { error: "Nessun nutriente per 100 g riconosciuto nella risposta FDC" };
    }

    const micros = extractMicroNutrientsPer100g(nutrients);
    const buckets = bucketMicros(micros);
    const rawCompact = compactRawNutrients(nutrients);
    const fiberPer100g = pickNutrientByName(nutrients, ["fiber, total dietary", "fiber"]);
    const sugarsPer100g = pickNutrientByName(nutrients, ["sugars, total including", "sugars, total"]);
    const metabolic = estimateMetabolicIndices({
      carbsPer100g: macros.carbsPer100g,
      proteinPer100g: macros.proteinPer100g,
      fatPer100g: macros.fatPer100g,
      fiberPer100g,
      sugarsPer100g,
    });
    const payload = {
      fdc_id: id,
      description: String(raw.description ?? "Alimento FDC"),
      data_type: raw.dataType != null ? String(raw.dataType) : null,
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
      metabolic_indices: metabolic.metabolicIndices,
      vitamins: buckets.vitamins,
      minerals: buckets.minerals,
      amino_acids: buckets.aminoAcids,
      fatty_acids: buckets.fattyAcids,
      other_nutrients: otherNutrients(nutrients, micros),
      nutrients_raw: rawCompact,
      source_payload: {
        fdcId: raw.fdcId ?? id,
        dataType: raw.dataType ?? null,
        description: raw.description ?? null,
        foodClass: raw.foodClass ?? null,
      },
      refreshed_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("nutrition_fdc_foods")
      .upsert(payload, { onConflict: "fdc_id" })
      .select("*")
      .single();
    if (error) return { error: error.message };
    return rowToCachedFood(data as Record<string, unknown>);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Import USDA FDC fallito." };
  }
}
