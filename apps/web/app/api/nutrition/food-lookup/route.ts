import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { runCanonicalNutritionLookup, toFoodLookupApiItem } from "@/lib/nutrition/canonical-nutrition-lookup";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const brandsParam = req.nextUrl.searchParams.get("brands") ?? "";
    const brands = brandsParam.split(",").map((b) => b.trim().toLowerCase()).filter(Boolean);
    if (q.length < 2) {
      return NextResponse.json({ items: [] });
    }

    const db = createServerSupabaseClient();
    const canonical = await runCanonicalNutritionLookup({
      db,
      q,
      usdaApiKey: process.env.USDA_API_KEY,
      maxResults: 80,
    });

    let items = canonical.map(toFoodLookupApiItem).filter((i) => i.label && i.label !== "Unnamed product");

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
