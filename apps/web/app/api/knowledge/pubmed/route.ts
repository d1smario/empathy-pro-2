import { NextRequest, NextResponse } from "next/server";
import { searchPubmedItems } from "@/lib/knowledge/pubmed-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ items: [] });
    const items = await searchPubmedItems(q, 8);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { items: [], error: e instanceof Error ? e.message : "PubMed lookup error" },
      { status: 500 },
    );
  }
}
