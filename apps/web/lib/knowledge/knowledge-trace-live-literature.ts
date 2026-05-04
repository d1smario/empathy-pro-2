import type { ResearchHopTrace } from "@/lib/empathy/schemas";
import {
  normalizeEuropepmcItemsToKnowledgeDocuments,
  searchEuropepmcItems,
} from "@/lib/knowledge/europepmc-client";
import {
  searchKnowledgeCorpusDocumentLinks,
  upsertKnowledgeDocuments,
} from "@/lib/knowledge/knowledge-library-store";
import { normalizePubmedItemsToKnowledgeDocuments, searchPubmedItems } from "@/lib/knowledge/pubmed-client";

const LIT = new Set<string>(["pubmed", "europe_pmc"]);

function hopUsesLiveLiterature(hop: ResearchHopTrace): boolean {
  return hop.sourceDbs.some((db) => LIT.has(db));
}

type LiveLitOpts = {
  wantsPubmed: boolean;
  wantsEpmc: boolean;
  documentLimit: number;
  perQueryItems: number;
  maxQueries: number;
};

async function upsertLiveLiteratureFromQueries(
  queries: string[],
  opts: LiveLitOpts,
  documentsById: Map<string, string>,
): Promise<number> {
  const startSize = documentsById.size;

  for (const q of queries.slice(0, opts.maxQueries)) {
    if (documentsById.size >= opts.documentLimit) break;
    const qt = q.trim();
    if (qt.length < 3) continue;

    try {
      if (opts.wantsPubmed) {
        const items = await searchPubmedItems(qt, opts.perQueryItems);
        const rows = normalizePubmedItemsToKnowledgeDocuments(items).map((d) => ({
          ...d,
          payload: { ...(d.payload ?? {}), ingestedFromTraceLive: true, traceQuery: qt.slice(0, 200) },
        }));
        const saved = await upsertKnowledgeDocuments(rows);
        for (const d of saved) {
          documentsById.set(d.id, d.title);
          if (documentsById.size >= opts.documentLimit) break;
        }
      }

      if (opts.wantsEpmc && documentsById.size < opts.documentLimit) {
        const items = await searchEuropepmcItems(qt, opts.perQueryItems);
        const rows = normalizeEuropepmcItemsToKnowledgeDocuments(items).map((d) => ({
          ...d,
          payload: { ...(d.payload ?? {}), ingestedFromTraceLive: true, traceQuery: qt.slice(0, 200) },
        }));
        const saved = await upsertKnowledgeDocuments(rows);
        for (const d of saved) {
          documentsById.set(d.id, d.title);
          if (documentsById.size >= opts.documentLimit) break;
        }
      }
    } catch {
      /* non bloccare */
    }
  }

  return documentsById.size - startSize;
}

/**
 * Se l’hop dichiara `pubmed` / `europe_pmc` e il corpus locale non basta,
 * recupera pochi record esterni, fa upsert in `knowledge_documents` e aggiunge gli id alla mappa.
 */
export async function enrichTraceHopDocumentsFromLiveLiterature(input: {
  hop: ResearchHopTrace;
  queries: string[];
  documentsById: Map<string, string>;
  documentLimit: number;
}): Promise<number> {
  const { hop, queries, documentsById, documentLimit } = input;
  if (!hopUsesLiveLiterature(hop)) return 0;

  return upsertLiveLiteratureFromQueries(
    queries,
    {
      wantsPubmed: hop.sourceDbs.includes("pubmed"),
      wantsEpmc: hop.sourceDbs.includes("europe_pmc"),
      documentLimit,
      perQueryItems: 2,
      maxQueries: 2,
    },
    documentsById,
  );
}

/**
 * Query corpus “libera”: se pochi match locali, tenta ingest PubMed + Europe PMC sulla stessa stringa.
 * Usato da `resolveKnowledgeCorpusQuery` (UI / strumenti).
 */
export async function backfillKnowledgeCorpusIfSparse(query: string): Promise<number> {
  const q = query.trim();
  if (q.length < 3) return 0;
  const existing = await searchKnowledgeCorpusDocumentLinks(q, 2);
  if (existing.length >= 2) return 0;

  const documentsById = new Map<string, string>(existing.map((m) => [m.id, m.title]));
  return upsertLiveLiteratureFromQueries(
    [q],
    {
      wantsPubmed: true,
      wantsEpmc: true,
      documentLimit: 8,
      perQueryItems: 4,
      maxQueries: 1,
    },
    documentsById,
  );
}
