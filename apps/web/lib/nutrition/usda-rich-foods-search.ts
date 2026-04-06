/**
 * USDA FoodData Central — foods rich in a given nutrient (POST /foods/search).
 * Uses the `nutrients` filter (minimum per 100 g) plus text queries; merges, dedupes, sorts by target nutrient.
 * Nutrient IDs follow FDC (see usda-fdc Python client nutrient table).
 */

export type UsdaRichFoodNutrientFilter = {
  id: number;
  type: "minimum";
  value: number;
};

export type UsdaRichFoodRow = {
  fdcId: number;
  description: string;
  dataType: string;
  targetNutrientId: number;
  targetAmountPer100g: number | null;
  targetUnitName: string | null;
  energyKcal100: number | null;
  proteinG100: number | null;
  carbsG100: number | null;
  fatG100: number | null;
};

type FdcSearchFoodNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: unknown;
};

type FdcSearchFood = {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodNutrients?: FdcSearchFoodNutrient[];
};

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickNutrientAmount(food: FdcSearchFood, nutrientId: number): { amount: number | null; unit: string | null } {
  const list = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const row = list.find((n) => n.nutrientId === nutrientId);
  return {
    amount: row ? toNum(row.value) : null,
    unit: row?.unitName ? String(row.unitName) : null,
  };
}

function pickMacro(
  food: FdcSearchFood,
  nutrientIds: { energy: number; protein: number; carbs: number; fat: number },
): Pick<UsdaRichFoodRow, "energyKcal100" | "proteinG100" | "carbsG100" | "fatG100"> {
  const list = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const byId = (id: number) => toNum(list.find((n) => n.nutrientId === id)?.value);
  return {
    energyKcal100: byId(nutrientIds.energy),
    proteinG100: byId(nutrientIds.protein),
    carbsG100: byId(nutrientIds.carbs),
    fatG100: byId(nutrientIds.fat),
  };
}

/** FDC nutrient.id for common macros in search results */
const FDC_MACRO_IDS = { energy: 1008, protein: 1003, carbs: 1005, fat: 1004 };

async function postFoodsSearch(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<FdcSearchFood[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`USDA search failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { foods?: FdcSearchFood[] };
  return Array.isArray(data.foods) ? data.foods : [];
}

function foodToRow(food: FdcSearchFood, targetNutrientId: number): UsdaRichFoodRow | null {
  const id = food.fdcId;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  const { amount, unit } = pickNutrientAmount(food, targetNutrientId);
  const macros = pickMacro(food, FDC_MACRO_IDS);
  return {
    fdcId: id,
    description: String(food.description ?? "").trim() || "—",
    dataType: String(food.dataType ?? ""),
    targetNutrientId,
    targetAmountPer100g: amount,
    targetUnitName: unit,
    ...macros,
  };
}

export type FetchUsdaRichFoodsInput = {
  apiKey: string;
  /** Text queries; each becomes a POST search (merged). Keep small to respect rate limits. */
  queries: string[];
  nutrientFilter: UsdaRichFoodNutrientFilter;
  /** Default Foundation + SR Legacy for compositional detail */
  dataTypes?: string[];
  pageSizePerQuery?: number;
  /** Cap merged list after sort */
  resultLimit?: number;
  /** Delay ms between USDA calls (avoid 429) */
  delayMsBetweenQueries?: number;
};

/**
 * Runs one USDA search per query string, merges by fdcId, sorts by target nutrient (desc), returns top rows.
 */
export async function fetchUsdaRichFoodsMerged(input: FetchUsdaRichFoodsInput): Promise<UsdaRichFoodRow[]> {
  const dataTypes = input.dataTypes ?? ["Foundation", "SR Legacy"];
  const pageSize = Math.min(50, Math.max(5, input.pageSizePerQuery ?? 20));
  const limit = Math.min(60, Math.max(5, input.resultLimit ?? 30));
  const delay = Math.min(500, Math.max(0, input.delayMsBetweenQueries ?? 120));

  const trimmedQueries = input.queries.map((q) => q.trim()).filter((q) => q.length >= 2).slice(0, 6);
  if (!trimmedQueries.length) return [];

  const byFdc = new Map<number, UsdaRichFoodRow>();

  for (let i = 0; i < trimmedQueries.length; i++) {
    const q = trimmedQueries[i];
    const foods = await postFoodsSearch(input.apiKey, {
      query: q,
      pageSize,
      pageNumber: 1,
      dataType: dataTypes,
      nutrients: [input.nutrientFilter],
    });
    for (const f of foods) {
      const row = foodToRow(f, input.nutrientFilter.id);
      if (!row) continue;
      const prev = byFdc.get(row.fdcId);
      if (!prev) {
        byFdc.set(row.fdcId, row);
        continue;
      }
      const a = prev.targetAmountPer100g;
      const b = row.targetAmountPer100g;
      if (b != null && (a == null || b > a)) byFdc.set(row.fdcId, row);
    }
    if (i < trimmedQueries.length - 1 && delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const rows = Array.from(byFdc.values());
  rows.sort((x, y) => {
    const vx = x.targetAmountPer100g ?? -1;
    const vy = y.targetAmountPer100g ?? -1;
    return vy - vx;
  });
  return rows.slice(0, limit);
}
