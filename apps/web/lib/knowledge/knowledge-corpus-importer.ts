import type { KnowledgeDocumentRef } from "@/lib/empathy/schemas";
import { upsertKnowledgeDocuments } from "@/lib/knowledge/knowledge-library-store";
import { normalizePubmedItemsToKnowledgeDocuments, searchPubmedItems } from "@/lib/knowledge/pubmed-client";

export async function ingestPubmedKnowledgeCorpus(input: {
  query: string;
  maxItems?: number;
}): Promise<KnowledgeDocumentRef[]> {
  const query = input.query.trim();
  if (query.length < 2) {
    return [];
  }

  const items = await searchPubmedItems(query, input.maxItems ?? 8);
  const normalizedDocuments = normalizePubmedItemsToKnowledgeDocuments(items).map((document) => ({
    ...document,
    payload: {
      ...(document.payload ?? {}),
      ingestedQuery: query,
    },
  }));

  return upsertKnowledgeDocuments(normalizedDocuments);
}
