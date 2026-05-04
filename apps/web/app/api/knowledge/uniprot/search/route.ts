import { NextRequest, NextResponse } from "next/server";
import { searchUniprotHumanProteins, uniprotHitsToKnowledgeEntities } from "@/lib/knowledge/uniprot-client";

export const runtime = "nodejs";

/**
 * Ricerca proteine UniProtKB (Homo sapiens di default).
 * `q`: gene symbol, accession, o frammento query UniProt (con spazi → query avanzata + taxon).
 * `limit`: opzionale, default 8, max 25.
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 1) return NextResponse.json({ hits: [], entities: [] });

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 8;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 8;

    const hits = await searchUniprotHumanProteins(q, limit);
    const entities = uniprotHitsToKnowledgeEntities(hits);
    return NextResponse.json({ hits, entities });
  } catch (e) {
    return NextResponse.json(
      { hits: [], entities: [], error: e instanceof Error ? e.message : "UniProt lookup error" },
      { status: 500 },
    );
  }
}
