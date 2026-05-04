import { NextRequest, NextResponse } from "next/server";
import { rheaHitsToKnowledgeEntities, searchRheaReactions } from "@/lib/knowledge/rhea-client";

export const runtime = "nodejs";

/** Ricerca reazioni Rhea (equazioni curate). */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ hits: [], entities: [] });

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 8;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 8;

    const hits = await searchRheaReactions(q, limit);
    const entities = rheaHitsToKnowledgeEntities(hits);
    return NextResponse.json({ hits, entities });
  } catch (e) {
    return NextResponse.json(
      { hits: [], entities: [], error: e instanceof Error ? e.message : "Rhea lookup error" },
      { status: 500 },
    );
  }
}
