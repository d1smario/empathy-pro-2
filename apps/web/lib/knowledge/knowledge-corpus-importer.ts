import type { KnowledgeCorpusImportInput, KnowledgeCorpusImportResult } from "@/api/knowledge/contracts";
import type { KnowledgeDocumentRef } from "@/lib/empathy/schemas";
import { upsertKnowledgeDocuments } from "@/lib/knowledge/knowledge-library-store";
import {
  normalizeEuropepmcItemsToKnowledgeDocuments,
  searchEuropepmcItems,
} from "@/lib/knowledge/europepmc-client";
import { normalizePubmedItemsToKnowledgeDocuments, searchPubmedItems } from "@/lib/knowledge/pubmed-client";

async function upsertLiteratureCorpus(
  source: "pubmed" | "europe_pmc",
  query: string,
  maxItems: number,
): Promise<KnowledgeDocumentRef[]> {
  if (source === "pubmed") {
    const items = await searchPubmedItems(query, maxItems);
    const normalizedDocuments = normalizePubmedItemsToKnowledgeDocuments(items).map((document) => ({
      ...document,
      payload: {
        ...(document.payload ?? {}),
        ingestedQuery: query,
      },
    }));
    return upsertKnowledgeDocuments(normalizedDocuments);
  }

  const items = await searchEuropepmcItems(query, maxItems);
  const normalizedDocuments = normalizeEuropepmcItemsToKnowledgeDocuments(items).map((document) => ({
    ...document,
    payload: {
      ...(document.payload ?? {}),
      ingestedQuery: query,
    },
  }));
  return upsertKnowledgeDocuments(normalizedDocuments);
}

/** Import letteratura in `knowledge_documents` (PubMed o Europe PMC). */
export async function ingestKnowledgeCorpus(input: KnowledgeCorpusImportInput): Promise<KnowledgeCorpusImportResult> {
  const query = input.q.trim();
  const maxItems = input.maxItems ?? 8;
  if (query.length < 2) {
    return { source: input.source, query, importedCount: 0, documents: [], error: null };
  }
  try {
    const documents = await upsertLiteratureCorpus(input.source, query, maxItems);
    return { source: input.source, query, importedCount: documents.length, documents, error: null };
  } catch (e) {
    return {
      source: input.source,
      query,
      importedCount: 0,
      documents: [],
      error: e instanceof Error ? e.message : "knowledge_corpus_import_failed",
    };
  }
}

export async function ingestPubmedKnowledgeCorpus(input: {
  query: string;
  maxItems?: number;
}): Promise<KnowledgeDocumentRef[]> {
  const query = input.query.trim();
  if (query.length < 2) {
    return [];
  }

  return upsertLiteratureCorpus("pubmed", query, input.maxItems ?? 8);
}

export async function ingestEuropepmcKnowledgeCorpus(input: {
  query: string;
  maxItems?: number;
}): Promise<KnowledgeDocumentRef[]> {
  const query = input.query.trim();
  if (query.length < 2) {
    return [];
  }

  return upsertLiteratureCorpus("europe_pmc", query, input.maxItems ?? 8);
}
