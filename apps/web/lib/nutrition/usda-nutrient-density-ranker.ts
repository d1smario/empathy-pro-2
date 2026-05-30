import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CanonicalFoodNutrients } from "@/lib/nutrition/canonical-food-composition";
import type { FdcCachedFood } from "@/lib/nutrition/fdc-food-cache";
import { fdcCachedFoodToCanonical } from "@/lib/nutrition/fdc-to-canonical-scaler";
import type { FdcMicroPer100g } from "@/lib/nutrition/fdc-micronutrient-extract";
import { partitionFdcNutrientsFromCompact } from "@/lib/nutrition/fdc-micronutrient-extract";
import type { NutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";

/**
 * Ranking deterministico degli alimenti più ricchi del nutriente target dalla cache USDA
 * (`nutrition_fdc_foods`). Densità per **100 g** prima, secondaria per **kcal-density** (per evitare
 * di suggerire solo alimenti molto calorici quando un alimento meno calorico ha più micro per kcal).
 *
 * Architettura: AI / sistema intelligente decide il pathway (es. eritropoiesi) e produce target
 * `(B12, Folati, Ferro)`. Questo ranker NON ragiona sul pathway: legge la cache USDA, ordina, ritorna
 * top-N. La cache USDA è popolata in modo deterministico dagli script `warm-usda-bulk` e
 * `warm-usda-corrections`.
 */

export type UsdaRankedFood = {
  fdcId: number;
  description: string;
  /** Quantità del nutriente target per 100 g di alimento (mg, mcg, g a seconda del campo). */
  amountPer100g: number;
  /** Quantità per 100 kcal (utile per confrontare densità energetiche diverse). */
  amountPer100Kcal: number;
  /** Unità del nutriente (mg / mcg / g). */
  unit: string;
  /** kcal per 100 g (utile per la UI quando confronta porzioni). */
  kcalPer100g: number;
};

/** Mappa il `NutrientTargetId` su una funzione di accesso ai valori già scalati al per-100g del FdcCachedFood. */
function readPer100gByTargetId(food: FdcCachedFood, target: NutrientTargetId): { amount: number; unit: string } {
  const can = fdcCachedFoodToCanonical(food);
  /** Unità per nutriente (allineate a `CanonicalFoodNutrients`). */
  const unitMap: Record<NutrientTargetId, string> = {
    vitA_mcg_RAE: "mcg",
    vitC_mg: "mg",
    vitD_mcg: "mcg",
    vitE_mg: "mg",
    vitK_mcg: "mcg",
    thiamineB1_mg: "mg",
    riboflavinB2_mg: "mg",
    niacinB3_mg: "mg",
    vitB6_mg: "mg",
    folate_mcg: "mcg",
    vitB12_mcg: "mcg",
    ca_mg: "mg",
    fe_mg: "mg",
    mg_mg: "mg",
    p_mg: "mg",
    k_mg: "mg",
    na_mg: "mg",
    zn_mg: "mg",
    se_mcg: "mcg",
    fiberG: "g",
    omega3G: "g",
  };
  const amount = (can as Record<string, number>)[target] ?? 0;
  return { amount: Number.isFinite(amount) ? amount : 0, unit: unitMap[target] };
}

/** Carica tutta la cache USDA disponibile (limite alto: ~200 entries). Filtra solo righe con kcal. */
async function loadAllCachedFoods(): Promise<FdcCachedFood[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("nutrition_fdc_foods")
    .select("*")
    .order("description", { ascending: true })
    .limit(400);
  if (error || !Array.isArray(data)) return [];
  /** Replica del rowToCachedFood (privato) — minimal: serve solo per estrarre nutrienti micro. */
  return data
    .map((row) => normalizeCacheRow(row as Record<string, unknown>))
    .filter((f) => Number.isFinite(f.kcalPer100g) && f.kcalPer100g > 0);
}

function asMicroArray(v: unknown): FdcMicroPer100g[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = Number(r.nutrientId);
      const amount = Number(r.amountPer100g);
      const name = typeof r.name === "string" ? r.name : "";
      const unit = typeof r.unit === "string" ? r.unit : "—";
      if (!Number.isFinite(id) || id <= 0 || !name || !Number.isFinite(amount)) return null;
      return { nutrientId: Math.round(id), name, amountPer100g: amount, unit };
    })
    .filter((row): row is FdcMicroPer100g => Boolean(row));
}

function normalizeCacheRow(row: Record<string, unknown>): FdcCachedFood {
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
    metabolicIndices:
      row.metabolic_indices && typeof row.metabolic_indices === "object"
        ? (row.metabolic_indices as Record<string, unknown>)
        : {},
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

/** Cache di processo per evitare round-trip multipli sulla stessa request. */
let MEMO_CACHED_FOODS: FdcCachedFood[] | null = null;
let MEMO_LOADED_AT = 0;
const MEMO_TTL_MS = 60_000;

async function getCachedFoods(): Promise<FdcCachedFood[]> {
  const now = Date.now();
  if (MEMO_CACHED_FOODS && now - MEMO_LOADED_AT < MEMO_TTL_MS) return MEMO_CACHED_FOODS;
  const fresh = await loadAllCachedFoods();
  MEMO_CACHED_FOODS = fresh;
  MEMO_LOADED_AT = now;
  return fresh;
}

/**
 * Top-N alimenti più ricchi del nutriente target dalla cache USDA.
 * Ranking primario: amountPer100g (densità per peso).
 * Tie-break: amountPer100Kcal (densità per energia, premia alimenti meno calorici a parità di micro).
 *
 * Esempio: per `vitB12_mcg` torna ~salmone, ~uovo intero, ~yogurt; per `fe_mg` torna ~lenticchie, ~spinaci, ~manzo.
 */
export async function rankUsdaCacheForNutrient(
  nutrientId: NutrientTargetId,
  topN = 3,
): Promise<UsdaRankedFood[]> {
  const foods = await getCachedFoods();
  const rows: UsdaRankedFood[] = foods
    .map((food) => {
      const { amount, unit } = readPer100gByTargetId(food, nutrientId);
      if (amount <= 0) return null;
      const kcal100 = Math.max(1, food.kcalPer100g);
      return {
        fdcId: food.fdcId,
        description: food.description,
        amountPer100g: amount,
        amountPer100Kcal: (amount * 100) / kcal100,
        unit,
        kcalPer100g: food.kcalPer100g,
      } satisfies UsdaRankedFood;
    })
    .filter((r): r is UsdaRankedFood => Boolean(r))
    .sort((a, b) => {
      if (b.amountPer100g !== a.amountPer100g) return b.amountPer100g - a.amountPer100g;
      return b.amountPer100Kcal - a.amountPer100Kcal;
    });
  return rows.slice(0, Math.max(1, topN));
}

/** Convenience: stessa cosa per più nutrienti in batch (reuse cache memoized). */
export async function rankUsdaCacheForTargets(
  nutrientIds: readonly NutrientTargetId[],
  topN = 3,
): Promise<Record<NutrientTargetId, UsdaRankedFood[]>> {
  const out = {} as Record<NutrientTargetId, UsdaRankedFood[]>;
  /** await esplicito (non Promise.all) per non saturare il pool DB; il dataset è piccolo. */
  for (const id of nutrientIds) {
    out[id] = await rankUsdaCacheForNutrient(id, topN);
  }
  return out;
}

export type RankFoodsForNutrientResult = {
  foods: UsdaRankedFood[];
  source: "cache" | "fdc_live" | "mixed" | "empty";
};

/** Ranker unico cache-first; live FDC solo su miss con apiKey e queries esplicite. */
export async function rankFoodsForNutrient(input: {
  nutrientId: NutrientTargetId;
  topN?: number;
  apiKey?: string;
  liveQueries?: string[];
  fdcNutrientId?: number;
  minimumPer100g?: number;
}): Promise<RankFoodsForNutrientResult> {
  const topN = Math.max(1, Math.min(10, Math.trunc(input.topN ?? 3) || 3));
  const cached = await rankUsdaCacheForNutrient(input.nutrientId, topN);
  if (cached.length >= topN) {
    return { foods: cached, source: "cache" };
  }
  const key = input.apiKey?.trim();
  if (!key || !input.liveQueries?.length || !input.fdcNutrientId) {
    return { foods: cached, source: cached.length ? "cache" : "empty" };
  }
  try {
    const { fetchUsdaRichFoodsMerged } = await import("@/lib/nutrition/usda-rich-foods-search");
    const liveRows = await fetchUsdaRichFoodsMerged({
      apiKey: key,
      queries: input.liveQueries.slice(0, 6),
      nutrientFilter: {
        id: Math.round(input.fdcNutrientId),
        type: "minimum",
        value: input.minimumPer100g ?? 0,
      },
      dataTypes: ["Foundation", "SR Legacy"],
      pageSizePerQuery: 18,
      resultLimit: topN * 2,
      delayMsBetweenQueries: 120,
    });
    const liveRanked: UsdaRankedFood[] = liveRows.slice(0, topN).map((r) => ({
      fdcId: r.fdcId,
      description: r.description,
      amountPer100g: r.targetAmountPer100g ?? 0,
      amountPer100Kcal:
        r.energyKcal100 && r.energyKcal100 > 0 && r.targetAmountPer100g != null
          ? (r.targetAmountPer100g * 100) / r.energyKcal100
          : r.targetAmountPer100g ?? 0,
      unit: r.targetUnitName ?? "mg",
      kcalPer100g: r.energyKcal100 ?? 0,
    }));
    const merged = [...cached];
    for (const row of liveRanked) {
      if (merged.length >= topN) break;
      if (!merged.some((m) => m.fdcId === row.fdcId)) merged.push(row);
    }
    return {
      foods: merged.slice(0, topN),
      source: cached.length && liveRanked.length ? "mixed" : liveRanked.length ? "fdc_live" : cached.length ? "cache" : "empty",
    };
  } catch {
    return { foods: cached, source: cached.length ? "cache" : "empty" };
  }
}

/** Per uso da test/debug: invalida la cache di processo. */
export function _resetUsdaRankerMemoForTests(): void {
  MEMO_CACHED_FOODS = null;
  MEMO_LOADED_AT = 0;
}

/** Tipizza una `CanonicalFoodNutrients` come Record string→number per accesso dinamico (read-only). */
export type _ScalerProbe = (food: FdcCachedFood) => CanonicalFoodNutrients;
