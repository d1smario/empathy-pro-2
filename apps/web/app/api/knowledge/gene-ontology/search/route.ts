import { NextRequest, NextResponse } from "next/server";
import {
  geneOntologyHitsToKnowledgeEntities,
  searchGeneOntologyTerms,
} from "@/lib/knowledge/gene-ontology-client";

export const runtime = "nodejs";

/** Ricerca termini GO (QuickGO). `limit` default 8, max 25. */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ hits: [], entities: [] });

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 8;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 8;

    const hits = await searchGeneOntologyTerms(q, limit);
    const entities = geneOntologyHitsToKnowledgeEntities(hits);
    return NextResponse.json({ hits, entities });
  } catch (e) {
    return NextResponse.json(
      { hits: [], entities: [], error: e instanceof Error ? e.message : "Gene Ontology lookup error" },
      { status: 500 },
    );
  }
}
