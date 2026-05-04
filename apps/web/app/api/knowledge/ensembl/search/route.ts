import { NextRequest, NextResponse } from "next/server";
import { ensemblHitsToKnowledgeEntities, searchEnsemblHumanGenes } from "@/lib/knowledge/ensembl-client";

export const runtime = "nodejs";

/**
 * Geni Homo sapiens (GRCh38) via Ensembl REST: simboli separati da spazio/virgola, o `ENSG…` (11 cifre).
 * Opz. `ENSEMBL_USER_AGENT` (consigliato da [Ensembl](https://rest.ensembl.org/documentation/info/public_rate_limit)).
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ hits: [], entities: [] });

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const limitParsed = limitRaw ? Number(limitRaw) : 8;
    const limit = Number.isFinite(limitParsed) ? limitParsed : 8;

    const hits = await searchEnsemblHumanGenes(q, limit);
    const entities = ensemblHitsToKnowledgeEntities(hits);
    return NextResponse.json({ hits, entities });
  } catch (e) {
    return NextResponse.json(
      { hits: [], entities: [], error: e instanceof Error ? e.message : "Ensembl lookup error" },
      { status: 500 },
    );
  }
}
