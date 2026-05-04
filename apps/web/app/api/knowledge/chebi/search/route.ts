import { NextRequest, NextResponse } from "next/server";
import { chebiHitsToKnowledgeEntities, searchChebiTerms } from "@/lib/knowledge/chebi-client";

export const runtime = "nodejs";

/** Ricerca entità ChEBI via [OLS](https://www.ebi.ac.uk/ols/index) (ontology `chebi`). */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ hits: [], entities: [] });

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 8;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 8;

    const hits = await searchChebiTerms(q, limit);
    const entities = chebiHitsToKnowledgeEntities(hits);
    return NextResponse.json({ hits, entities });
  } catch (e) {
    return NextResponse.json(
      { hits: [], entities: [], error: e instanceof Error ? e.message : "ChEBI lookup error" },
      { status: 500 },
    );
  }
}
