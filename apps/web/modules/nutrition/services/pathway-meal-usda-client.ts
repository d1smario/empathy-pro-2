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

  const res = await fetch(`/api/nutrition/usda-by-nutrient?catalogIds=${encodeURIComponent(ids.join(","))}`, {
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as {
    foods?: UsdaRichFoodItemViewModel[];
    error?: string;
  };
  const foods = j.foods ?? [];
  const usdaConfigured = res.status !== 503;
  const error =
    res.ok ? (j.error ?? null) : j.error ?? (usdaConfigured ? "Errore USDA." : "USDA_API_KEY non configurata (server).");

  return {
    foods: mergeAndRankFoods(foods, 12),
    error,
    usdaConfigured,
  };
}
