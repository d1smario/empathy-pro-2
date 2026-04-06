import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("media_assets")
      .select("entity_type, entity_key, media_kind, url, active, sort_order")
      .eq("domain", "nutrition")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) return NextResponse.json({ error: error.message, rows: [] }, { status: 500 });
    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nutrition media fetch failed";
    return NextResponse.json({ error: message, rows: [] }, { status: 500 });
  }
}

