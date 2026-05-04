import { NextRequest, NextResponse } from "next/server";
import {
  reactomePathwayHitsToKnowledgeEntities,
  searchReactomePathways,
} from "@/lib/knowledge/reactome-client";

export const runtime = "nodejs";

/**
 * Ricerca pathway Reactome (Homo sapiens default taxon 9606).
 * Parametri: `q`, opz. `species` (taxon id), `limit` (default 8, max 25).
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ hits: [], entities: [] });

    const speciesRaw = req.nextUrl.searchParams.get("species");
    const speciesParsed = speciesRaw ? Number(speciesRaw) : 9606;
    const speciesTaxId = Number.isFinite(speciesParsed) ? speciesParsed : 9606;

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 8;
    const maxResults = Number.isFinite(limitParsed) ? limitParsed : 8;

    const hits = await searchReactomePathways(q, { speciesTaxId, maxResults });
    const entities = reactomePathwayHitsToKnowledgeEntities(hits);
    return NextResponse.json({ hits, entities });
  } catch (e) {
    return NextResponse.json(
      { hits: [], entities: [], error: e instanceof Error ? e.message : "Reactome lookup error" },
      { status: 500 },
    );
  }
}
