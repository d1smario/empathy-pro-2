import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isFdcCacheOnly } from "@/lib/nutrition/fdc-runtime-config";
import { summarizePer100gFromFdcNutrientRows } from "@/lib/nutrition/usda-fdc-food-detail";

/** Risposta unica lookup: USDA da cache FDC o discovery API; integratori/fueling da catalogo dichiarazioni fornitore. */
export type CanonicalNutritionLookupItem = {
  source: "usda_fdc_cache" | "usda_discovery" | "brand-site";
  fdcId?: number | null;
  /** Riga `nutrition_product_catalog` quando source = brand-site */
  catalogId?: string | null;
  label: string;
  brand: string | null;
  kcal_100: number | null;
  carbs_100: number | null;
  protein_100: number | null;
  fat_100: number | null;
  sodium_mg_100: number | null;
};

import { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";

export { isPlausiblePer100gMacros } from "@/lib/nutrition/macro-plausibility";

function sanitizeIlikeFragment(raw: string): string {
  return raw.replace(/%/g, "").replace(/_/g, "").replace(/\\/g, "").trim().slice(0, 80);
}

function rowToCacheHit(r: Record<string, unknown>): CanonicalNutritionLookupItem {
  const fdcId = Number(r.fdc_id);
  return {
    source: "usda_fdc_cache",
    fdcId: Number.isFinite(fdcId) ? fdcId : null,
    catalogId: null,
    label: String(r.description ?? "Alimento FDC"),
    brand: null,
    kcal_100: r.kcal_100g != null ? Number(r.kcal_100g) : null,
    carbs_100: r.carbs_100g != null ? Number(r.carbs_100g) : null,
    protein_100: r.protein_100g != null ? Number(r.protein_100g) : null,
    fat_100: r.fat_100g != null ? Number(r.fat_100g) : null,
    sodium_mg_100: r.sodium_mg_100g != null ? Number(r.sodium_mg_100g) : null,
  };
}

function rowToCatalogHit(r: Record<string, unknown>): CanonicalNutritionLookupItem {
  return {
    source: "brand-site",
    fdcId: null,
    catalogId: r.id != null ? String(r.id) : null,
    label: String(r.product_name ?? "Prodotto"),
    brand: r.brand != null ? String(r.brand) : null,
    kcal_100: r.kcal_100g != null ? Number(r.kcal_100g) : null,
    carbs_100: r.cho_100g != null ? Number(r.cho_100g) : null,
    protein_100: r.protein_100g != null ? Number(r.protein_100g) : null,
    fat_100: r.fat_100g != null ? Number(r.fat_100g) : null,
    sodium_mg_100: r.sodium_mg_100g != null ? Number(r.sodium_mg_100g) : null,
  };
}

export async function searchNutritionFdcCache(
  db: SupabaseClient,
  q: string,
  limit: number,
): Promise<CanonicalNutritionLookupItem[]> {
  const safe = sanitizeIlikeFragment(q);
  if (safe.length < 2) return [];
  const pattern = `%${safe}%`;
  const { data, error } = await db
    .from("nutrition_fdc_foods")
    .select("fdc_id, description, data_type, kcal_100g, carbs_100g, protein_100g, fat_100g, sodium_mg_100g")
    .ilike("description", pattern)
    .order("description", { ascending: true })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return (data as Record<string, unknown>[])
    .map(rowToCacheHit)
    .filter((h) => isPlausiblePer100gMacros(h) && h.label.length > 0);
}

export async function searchNutritionProductCatalog(
  db: SupabaseClient,
  q: string,
  limit: number,
): Promise<CanonicalNutritionLookupItem[]> {
  const safe = sanitizeIlikeFragment(q);
  if (safe.length < 2) return [];
  const pattern = `%${safe}%`;
  const sel =
    "id, source, brand, product_name, kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g" as const;
  const [byName, byBrand] = await Promise.all([
    db
      .from("nutrition_product_catalog")
      .select(sel)
      .ilike("product_name", pattern)
      .in("source", ["brand-site", "internal"])
      .order("product_name", { ascending: true })
      .limit(limit),
    db
      .from("nutrition_product_catalog")
      .select(sel)
      .ilike("brand", pattern)
      .in("source", ["brand-site", "internal"])
      .order("product_name", { ascending: true })
      .limit(limit),
  ]);
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const batch of [byName.data, byBrand.data]) {
    if (!Array.isArray(batch)) continue;
    for (const r of batch) {
      const id = (r as Record<string, unknown>).id;
      const key = id != null ? String(id) : JSON.stringify(r);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(r as Record<string, unknown>);
    }
  }
  return rows
    .map(rowToCatalogHit)
    .filter((h) => isPlausiblePer100gMacros(h) && h.label.length > 0)
    .slice(0, limit);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function mapUsdaSearchFoodToDiscoveryItem(f: Record<string, unknown>): CanonicalNutritionLookupItem | null {
  const nutrients = Array.isArray(f.foodNutrients) ? (f.foodNutrients as Array<Record<string, unknown>>) : [];
  const s = summarizePer100gFromFdcNutrientRows(nutrients);
  const rawFdc = f.fdcId;
  const fdcId =
    typeof rawFdc === "number" && Number.isFinite(rawFdc)
      ? rawFdc
      : typeof rawFdc === "string"
        ? Number(rawFdc)
        : null;
  if (fdcId == null || !Number.isFinite(fdcId)) return null;
  const item: CanonicalNutritionLookupItem = {
    source: "usda_discovery",
    fdcId: Math.round(fdcId),
    catalogId: null,
    label: String(f.description ?? "USDA product"),
    brand: f.brandOwner ? String(f.brandOwner) : null,
    kcal_100: s.kcalPer100g,
    carbs_100: s.carbsPer100g,
    protein_100: s.proteinPer100g,
    fat_100: s.fatPer100g,
    sodium_mg_100: s.sodiumMgPer100g,
  };
  if (!isPlausiblePer100gMacros(item)) return null;
  return item;
}

/** Discovery USDA (solo con API key). Valori mostrati sono da search; al salvataggio si usa sempre `getOrImportFdcFood`. */
export async function searchUsdaFdcDiscovery(q: string, apiKey: string, limit: number): Promise<CanonicalNutritionLookupItem[]> {
  const enc = encodeURIComponent(apiKey);
  const query = encodeURIComponent(q.trim());
  const dataTypes = ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"];
  const typeQs = dataTypes.map((t) => `&dataType=${encodeURIComponent(t)}`).join("");
  const base = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${enc}&query=${query}${typeQs}&pageSize=50`;

  const byId = new Map<number, CanonicalNutritionLookupItem>();
  for (let pageNumber = 0; pageNumber < 3; pageNumber += 1) {
    const res = await fetch(`${base}&pageNumber=${pageNumber}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => ({}))) as { foods?: Array<Record<string, unknown>> };
    const foods = Array.isArray(data.foods) ? data.foods : [];
    for (const f of foods) {
      const item = mapUsdaSearchFoodToDiscoveryItem(f);
      if (!item?.fdcId || byId.has(item.fdcId)) continue;
      byId.set(item.fdcId, item);
      if (byId.size >= limit) return [...byId.values()];
    }
  }
  return [...byId.values()].slice(0, limit);
}

function dedupeCanonical(items: CanonicalNutritionLookupItem[]): CanonicalNutritionLookupItem[] {
  const out: CanonicalNutritionLookupItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key =
      item.source === "brand-site" && item.catalogId
        ? `c:${item.catalogId}`
        : item.fdcId != null
          ? `f:${item.fdcId}`
          : `l:${item.label.toLowerCase()}|${(item.brand ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Ordine: catalogo fornitore → cache FDC locale → discovery USDA.
 * Nessun OpenFoodFacts: una sola linea dati verificabili.
 */
export async function runCanonicalNutritionLookup(input: {
  db: SupabaseClient;
  q: string;
  usdaApiKey: string | undefined;
  maxResults?: number;
}): Promise<CanonicalNutritionLookupItem[]> {
  const max = Math.min(100, Math.max(10, input.maxResults ?? 80));
  const q = input.q.trim();
  if (q.length < 2) return [];

  const half = Math.max(12, Math.floor(max / 2));
  const [catalogHits, fdcHits] = await Promise.all([
    searchNutritionProductCatalog(input.db, q, half),
    searchNutritionFdcCache(input.db, q, half),
  ]);

  const usdaKey = input.usdaApiKey?.trim();
  const discovery =
    usdaKey && !isFdcCacheOnly() ? await searchUsdaFdcDiscovery(q, usdaKey, max).catch(() => []) : [];

  const merged = dedupeCanonical([...catalogHits, ...fdcHits, ...discovery]);
  return merged.slice(0, max);
}

/** Payload compatibile con client legacy (`usda` / `brand-site` / niente OFF). */
export function toFoodLookupApiItem(item: CanonicalNutritionLookupItem) {
  const source =
    item.source === "usda_fdc_cache" || item.source === "usda_discovery"
      ? ("usda" as const)
      : ("brand-site" as const);
  return {
    source,
    /** Discovery: anteprima macro da search; salvataggio USDA usa sempre import FDC. */
    lookupTier: item.source,
    fdcId: item.fdcId ?? null,
    catalogId: item.catalogId ?? null,
    label: item.label,
    brand: item.brand,
    kcal_100: item.kcal_100,
    carbs_100: item.carbs_100,
    protein_100: item.protein_100,
    fat_100: item.fat_100,
    sodium_mg_100: item.sodium_mg_100,
  };
}
