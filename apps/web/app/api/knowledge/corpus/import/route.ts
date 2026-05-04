import type { KnowledgeCorpusImportInput, KnowledgeCorpusImportResult } from "@/api/knowledge/contracts";
import { RequestAuthError, requireRequestUser } from "@/lib/auth/request-auth";
import { ingestKnowledgeCorpus } from "@/lib/knowledge/knowledge-corpus-importer";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function parseBody(body: unknown): KnowledgeCorpusImportInput | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  const source = rec.source;
  const q = typeof rec.q === "string" ? rec.q.trim() : "";
  const maxItems = rec.maxItems;
  const maxParsed = typeof maxItems === "number" ? maxItems : typeof maxItems === "string" ? Number(maxItems) : undefined;
  const max = maxParsed !== undefined && Number.isFinite(maxParsed) ? maxParsed : undefined;

  if (q.length < 2) return null;
  if (source === "pubmed") return { source: "pubmed", q, maxItems: max };
  if (source === "europe_pmc") return { source: "europe_pmc", q, maxItems: max };
  return null;
}

/**
 * Persiste documenti letteratura in `knowledge_documents` (upsert).
 * Richiede utente autenticato. Body: `{ "source": "pubmed" | "europe_pmc", "q": "...", "maxItems"?: number }`.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRequestUser(req);
    const body = (await req.json().catch(() => null)) as unknown;
    const input = parseBody(body);
    if (!input) {
      return NextResponse.json<KnowledgeCorpusImportResult>(
        {
          source: "pubmed",
          query: "",
          importedCount: 0,
          documents: [],
          error: "Invalid body: expect { source: \"pubmed\" | \"europe_pmc\", q: string (min 2 chars), maxItems? }",
        },
        { status: 400 },
      );
    }

    const result = await ingestKnowledgeCorpus(input);
    const status = result.error ? 500 : 200;
    return NextResponse.json<KnowledgeCorpusImportResult>(result, { status });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json<KnowledgeCorpusImportResult>(
        {
          source: "pubmed",
          query: "",
          importedCount: 0,
          documents: [],
          error: error.message,
        },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "corpus_import_failed";
    return NextResponse.json<KnowledgeCorpusImportResult>(
      {
        source: "pubmed",
        query: "",
        importedCount: 0,
        documents: [],
        error: message,
      },
      { status: 500 },
    );
  }
}
