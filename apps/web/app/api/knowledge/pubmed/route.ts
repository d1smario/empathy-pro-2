import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { augmentPubmedQueryWithAthleteMemory } from "@/lib/knowledge/pubmed-query-from-memory";
import { searchPubmedItems } from "@/lib/knowledge/pubmed-client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ items: [] as const, resolvedQuery: q });

    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    let searchQ = q;
    if (athleteId) {
      await requireAthleteReadContext(req, athleteId);
      searchQ = await augmentPubmedQueryWithAthleteMemory(q, athleteId);
    }

    const items = await searchPubmedItems(searchQ, 8);
    return NextResponse.json({
      items,
      ...(athleteId ? { resolvedQuery: searchQ } : {}),
    });
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json(
        { items: [] as const, error: e.message },
        { status: e.status },
      );
    }
    return NextResponse.json(
      { items: [] as const, error: e instanceof Error ? e.message : "PubMed lookup error" },
      { status: 500 },
    );
  }
}
