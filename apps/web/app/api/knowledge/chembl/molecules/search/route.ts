import { NextRequest, NextResponse } from "next/server";
import { chemblMoleculeHitsToKnowledgeEntities, searchChemblMolecules } from "@/lib/knowledge/chembl-client";

export const runtime = "nodejs";

/** Ricerca molecole ChEMBL (testo libero). `limit` default 8, max 25. */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ hits: [], entities: [] });

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 8;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 8;

    const hits = await searchChemblMolecules(q, limit);
    const entities = chemblMoleculeHitsToKnowledgeEntities(hits);
    return NextResponse.json({ hits, entities });
  } catch (e) {
    return NextResponse.json(
      { hits: [], entities: [], error: e instanceof Error ? e.message : "ChEMBL lookup error" },
      { status: 500 },
    );
  }
}
