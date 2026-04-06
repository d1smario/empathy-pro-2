import { NextRequest, NextResponse } from "next/server";
import { summarizePer100gFromFdcNutrientRows } from "@/lib/nutrition/usda-fdc-food-detail";

export const runtime = "nodejs";

type LookupItem = {
  source: "internal" | "openfoodfacts" | "usda";
  /** Presente per source=usda — per aggiunta diario FDC deterministica. */
  fdcId?: number | null;
  label: string;
  brand: string | null;
  kcal_100: number | null;
  carbs_100: number | null;
  protein_100: number | null;
  fat_100: number | null;
  sodium_mg_100: number | null;
};

const INTERNAL_SUPPLEMENTS: LookupItem[] = [
  { source: "internal", label: "Gel 2:1 40g", brand: "Maurten", kcal_100: 250, carbs_100: 62, protein_100: 0, fat_100: 0, sodium_mg_100: 200 },
  { source: "internal", label: "Drink Mix 320", brand: "Maurten", kcal_100: 400, carbs_100: 99, protein_100: 0, fat_100: 0, sodium_mg_100: 260 },
  { source: "internal", label: "Gel Beta Fuel", brand: "SIS", kcal_100: 245, carbs_100: 60, protein_100: 0, fat_100: 0, sodium_mg_100: 230 },
  { source: "internal", label: "Flow Gel", brand: "Santa Madre", kcal_100: 260, carbs_100: 64, protein_100: 0, fat_100: 0, sodium_mg_100: 240 },
  { source: "internal", label: "Carbo Fuel Drink", brand: "Enervit", kcal_100: 390, carbs_100: 95, protein_100: 0, fat_100: 0, sodium_mg_100: 320 },
  { source: "internal", label: "Hydration 1500", brand: "Precision Fuel & Hydration", kcal_100: 50, carbs_100: 6, protein_100: 0, fat_100: 0, sodium_mg_100: 1500 },
  { source: "internal", label: "Recovery 50g", brand: "Named Sport", kcal_100: 360, carbs_100: 58, protein_100: 30, fat_100: 4, sodium_mg_100: 290 },
  { source: "internal", label: "Carbo Hydrogel 2:1", brand: "Neversecond", kcal_100: 250, carbs_100: 63, protein_100: 0, fat_100: 0, sodium_mg_100: 180 },
];

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeText(input: string): string {
  return input.toLowerCase().trim();
}

async function lookupOpenFoodFacts(q: string): Promise<LookupItem[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12`;
  const res = await fetch(url, { headers: { "User-Agent": "EMPATHY/3.0 nutrition lookup" }, cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { products?: Array<Record<string, unknown>> };
  const products = Array.isArray(data.products) ? data.products : [];
  return products.map((p) => {
    const nutr = (p.nutriments as Record<string, unknown>) ?? {};
    const salt100 = toNumber(nutr.salt_100g);
    return {
      source: "openfoodfacts",
      label: String(p.product_name ?? p.generic_name ?? "Unnamed product"),
      brand: p.brands ? String(p.brands).split(",")[0].trim() : null,
      kcal_100: toNumber(nutr["energy-kcal_100g"] ?? nutr.energy_kcal_100g),
      carbs_100: toNumber(nutr.carbohydrates_100g),
      protein_100: toNumber(nutr.proteins_100g),
      fat_100: toNumber(nutr.fat_100g),
      sodium_mg_100: toNumber(nutr.sodium_100g) != null ? Math.round((toNumber(nutr.sodium_100g) as number) * 1000) : salt100 != null ? Math.round(salt100 * 400) : null,
    };
  });
}

function mapUsdaFoodToLookupItem(f: Record<string, unknown>): LookupItem | null {
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
  return {
    source: "usda" as const,
    fdcId: Math.round(fdcId),
    label: String(f.description ?? "USDA product"),
    brand: f.brandOwner ? String(f.brandOwner) : null,
    kcal_100: s.kcalPer100g,
    carbs_100: s.carbsPer100g,
    protein_100: s.proteinPer100g,
    fat_100: s.fatPer100g,
    sodium_mg_100: s.sodiumMgPer100g,
  };
}

/** Più pagine + tipi dati FDC per copertura ampia (Foundation, legacy, survey, branded). */
async function lookupUsda(q: string, apiKey: string): Promise<LookupItem[]> {
  const enc = encodeURIComponent(apiKey);
  const query = encodeURIComponent(q);
  const dataTypes = ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"];
  const typeQs = dataTypes.map((t) => `&dataType=${encodeURIComponent(t)}`).join("");
  const base = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${enc}&query=${query}${typeQs}&pageSize=50`;

  const pages = [0, 1, 2];
  const responses = await Promise.all(
    pages.map((pageNumber) =>
      fetch(`${base}&pageNumber=${pageNumber}`, { cache: "no-store" }).catch(() => null),
    ),
  );

  const byId = new Map<number, LookupItem>();
  for (const res of responses) {
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => ({}))) as { foods?: Array<Record<string, unknown>> };
    const foods = Array.isArray(data.foods) ? data.foods : [];
    for (const f of foods) {
      const item = mapUsdaFoodToLookupItem(f);
      if (!item?.fdcId || byId.has(item.fdcId)) continue;
      byId.set(item.fdcId, item);
    }
  }
  return [...byId.values()];
}

function dedupe(items: LookupItem[]): LookupItem[] {
  const out: LookupItem[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${normalizeText(item.label)}|${normalizeText(item.brand ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const brandsParam = req.nextUrl.searchParams.get("brands") ?? "";
    const brands = brandsParam.split(",").map((b) => b.trim().toLowerCase()).filter(Boolean);
    if (q.length < 2) {
      return NextResponse.json({ items: [] });
    }

    const qNorm = normalizeText(q);
    const internal = INTERNAL_SUPPLEMENTS.filter((item) => {
      const text = `${item.label} ${item.brand ?? ""}`.toLowerCase();
      return text.includes(qNorm);
    });

    const [off, usda] = await Promise.all([
      lookupOpenFoodFacts(q).catch(() => []),
      process.env.USDA_API_KEY ? lookupUsda(q, process.env.USDA_API_KEY).catch(() => []) : Promise.resolve([] as LookupItem[]),
    ]);

    let items = dedupe([...internal, ...off, ...usda]).filter((i) => i.label && i.label !== "Unnamed product");
    if (brands.length) {
      items = items.sort((a, b) => {
        const aHit = a.brand ? brands.some((br) => a.brand!.toLowerCase().includes(br)) : false;
        const bHit = b.brand ? brands.some((br) => b.brand!.toLowerCase().includes(br)) : false;
        return Number(bHit) - Number(aHit);
      });
    }
    return NextResponse.json({ items: items.slice(0, 80) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown lookup error";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}

