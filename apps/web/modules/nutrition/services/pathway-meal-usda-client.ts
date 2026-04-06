import type { UsdaRichFoodItemViewModel } from "@/api/nutrition/contracts";

export type PathwayUsdaFetchResult = {
  foods: UsdaRichFoodItemViewModel[];
  error: string | null;
  usdaConfigured: boolean;
};

function mergeAndRankFoods(rows: UsdaRichFoodItemViewModel[], limit: number): UsdaRichFoodItemViewModel[] {
  const m = new Map<number, UsdaRichFoodItemViewModel>();
  for (const r of rows) {
    const prev = m.get(r.fdcId);
    if (!prev || (r.targetAmountPer100g ?? 0) > (prev.targetAmountPer100g ?? 0)) m.set(r.fdcId, r);
  }
  return Array.from(m.values())
    .sort((a, b) => (b.targetAmountPer100g ?? 0) - (a.targetAmountPer100g ?? 0))
    .slice(0, limit);
}

/** Una chiamata per catalogId (chiave catalogo funzionale EMPATHY, es. leucine_mtor). */
export async function fetchUsdaFoodsForCatalogIds(catalogIds: string[]): Promise<PathwayUsdaFetchResult> {
  const ids = Array.from(new Set(catalogIds.map((id) => id.trim()).filter(Boolean))).slice(0, 3);
  if (!ids.length) {
    return { foods: [], error: null, usdaConfigured: true };
  }

  const runs = await Promise.all(
    ids.map(async (catalogId) => {
      const res = await fetch(`/api/nutrition/usda-by-nutrient?catalogId=${encodeURIComponent(catalogId)}`, {
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as {
        foods?: UsdaRichFoodItemViewModel[];
        error?: string;
      };
      return { status: res.status, j };
    }),
  );

  let error: string | null = null;
  let usdaConfigured = true;
  const foods: UsdaRichFoodItemViewModel[] = [];
  for (const r of runs) {
    if (r.status === 503) {
      usdaConfigured = false;
      error = r.j.error ?? "USDA_API_KEY non configurata (server).";
    } else if (r.status < 200 || r.status >= 300) {
      error = r.j.error ?? error ?? "Errore USDA.";
    }
    foods.push(...(r.j.foods ?? []));
  }

  return {
    foods: mergeAndRankFoods(foods, 12),
    error: usdaConfigured ? error : error,
    usdaConfigured,
  };
}
