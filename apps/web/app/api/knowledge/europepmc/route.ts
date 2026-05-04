import { NextRequest, NextResponse } from "next/server";
import { searchEuropepmcItems } from "@/lib/knowledge/europepmc-client";

export const runtime = "nodejs";

/**
 * Ricerca letteratura via Europe PMC REST (complementare a PubMed).
 * Query: `GET ?q=...&max=8` (max opzionale, default 8, cap 25).
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ items: [] });

    const maxRaw = req.nextUrl.searchParams.get("max");
    const maxParsed = maxRaw ? Number(maxRaw) : 8;
    const max = Number.isFinite(maxParsed) ? maxParsed : 8;

    const items = await searchEuropepmcItems(q, max);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { items: [], error: e instanceof Error ? e.message : "Europe PMC lookup error" },
      { status: 500 },
    );
  }
}
