import type { KnowledgeDocumentRef } from "@/lib/empathy/schemas";

export type PubmedSearchItem = {
  source: "pubmed";
  pmid: string;
  title: string;
  journal: string | null;
  pub_date: string | null;
  authors: string[];
  url: string;
};

async function esearch(term: string, maxResults: number): Promise<string[]> {
  const url =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` +
    `?db=pubmed&retmode=json&retmax=${encodeURIComponent(String(maxResults))}&term=${encodeURIComponent(term)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { esearchresult?: { idlist?: string[] } };
  return data.esearchresult?.idlist ?? [];
}

async function esummary(ids: string[]): Promise<PubmedSearchItem[]> {
  if (!ids.length) return [];
  const url =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi` +
    `?db=pubmed&retmode=json&id=${encodeURIComponent(ids.join(","))}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    result?: Record<
      string,
      {
        uid?: string;
        title?: string;
        fulljournalname?: string;
        pubdate?: string;
        authors?: Array<{ name?: string }>;
      }
    > & { uids?: string[] };
  };
  const result = data.result ?? {};
  const uids = Array.isArray(result.uids) ? result.uids : [];
  return uids
    .map((id) => {
      const row = result[id];
      if (!row?.uid || !row.title) return null;
      return {
        source: "pubmed" as const,
        pmid: row.uid,
        title: row.title,
        journal: row.fulljournalname ?? null,
        pub_date: row.pubdate ?? null,
        authors: (row.authors ?? []).map((a) => a.name ?? "").filter(Boolean).slice(0, 6),
        url: `https://pubmed.ncbi.nlm.nih.gov/${row.uid}/`,
      };
    })
    .filter(Boolean) as PubmedSearchItem[];
}

export async function searchPubmedItems(query: string, maxResults = 8): Promise<PubmedSearchItem[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];
  const boundedMaxResults = Math.max(1, Math.min(20, Math.trunc(maxResults) || 8));
  const ids = await esearch(trimmedQuery, boundedMaxResults);
  return esummary(ids);
}

export function normalizePubmedItemsToKnowledgeDocuments(items: PubmedSearchItem[]): Array<
  KnowledgeDocumentRef & {
    abstract?: string | null;
    documentKind?: string | null;
    license?: string | null;
    payload?: Record<string, unknown> | null;
  }
> {
  return items.map((item) => ({
    sourceDb: "pubmed",
    externalId: item.pmid,
    title: item.title,
    url: item.url,
    journal: item.journal,
    publicationDate: item.pub_date,
    abstract: null,
    documentKind: "article",
    license: null,
    payload: {
      authors: item.authors,
      importedFrom: "pubmed",
    },
  }));
}
