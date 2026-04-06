import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      source: string;
      brand: string | null;
      product_name: string;
      category: string;
      kcal_100g: number | null;
      cho_100g: number | null;
      protein_100g: number | null;
      fat_100g: number | null;
      sodium_mg_100g: number | null;
      metadata: Record<string, unknown>;
    };
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("nutrition_product_catalog").insert(body);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nutrition catalog insert failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

