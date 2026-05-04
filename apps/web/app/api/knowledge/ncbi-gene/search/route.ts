import { NextRequest, NextResponse } from "next/server";
import { ncbiGeneHitsToKnowledgeEntities, searchNcbiHumanGenes } from "@/lib/knowledge/ncbi-gene-client";

export const runtime = "nodejs";

/** Ricerca gene NCBI (Homo sapiens default). `q`: simbolo o testo; `limit` default 8, max 25. */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ hits: [], entities: [] });

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 8;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 8;

    const hits = await searchNcbiHumanGenes(q, limit);
    const entities = ncbiGeneHitsToKnowledgeEntities(hits);
    return NextResponse.json({ hits, entities });
  } catch (e) {
    return NextResponse.json(
      { hits: [], entities: [], error: e instanceof Error ? e.message : "NCBI Gene lookup error" },
      { status: 500 },
    );
  }
}
