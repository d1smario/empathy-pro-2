import type { KnowledgeDocumentRef } from "@/lib/empathy/schemas";

const EUROPEPMC_SEARCH =
  "https://www.ebi.ac.uk/europepmc/webservices/rest/search";

export type EuropepmcSearchItem = {
  source: "europe_pmc";
  /** Record source from Europe PMC (MED, PMC, PAT, …). */
  recordSource: string;
  /** Europe PMC record id (often equals PMID for MED). */
  recordId: string;
  title: string;
  journal: string | null;
  pubYear: string | null;
  authorString: string | null;
  pmid: string | null;
  doi: string | null;
  url: string;
};

type EpmcResultRow = {
  id?: string;
  source?: string;
  title?: string;
  authorString?: string;
  pmid?: string;
  doi?: string;
  pubYear?: string;
  journalInfo?: { journal?: { title?: string } };
};

function defaultUserAgent(): string {
  const custom = process.env.EUROPEPMC_USER_AGENT?.trim();
  if (custom) return custom;
  return "empathy-pro-2/1.0 (+https://github.com/d1smario/empathy-pro-2)";
}

function journalTitle(row: EpmcResultRow): string | null {
  const t = row.journalInfo?.journal?.title;
  return typeof t === "string" && t.trim() ? t.trim() : null;
}

export async function searchEuropepmcItems(query: string, maxResults = 8): Promise<EuropepmcSearchItem[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];
  const boundedMaxResults = Math.max(1, Math.min(25, Math.trunc(maxResults) || 8));

  const url = new URL(EUROPEPMC_SEARCH);
  url.searchParams.set("query", trimmedQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("resultType", "core");
  url.searchParams.set("pageSize", String(boundedMaxResults));

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "User-Agent": defaultUserAgent() },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { resultList?: { result?: EpmcResultRow[] } };
  const raw = data.resultList?.result ?? [];

  return raw
    .map((row) => {
      const recordSource = typeof row.source === "string" && row.source.trim() ? row.source.trim() : "MED";
      const recordId = typeof row.id === "string" && row.id.trim() ? row.id.trim() : "";
      const title = typeof row.title === "string" && row.title.trim() ? row.title.trim() : "";
      if (!recordId || !title) return null;

      const pmid = typeof row.pmid === "string" && row.pmid.trim() ? row.pmid.trim() : null;
      const doi = typeof row.doi === "string" && row.doi.trim() ? row.doi.trim() : null;
      const pubYear = typeof row.pubYear === "string" && row.pubYear.trim() ? row.pubYear.trim() : null;
      const authorString =
        typeof row.authorString === "string" && row.authorString.trim() ? row.authorString.trim() : null;

      const urlArticle = `https://europepmc.org/article/${encodeURIComponent(recordSource)}/${encodeURIComponent(recordId)}`;

      return {
        source: "europe_pmc" as const,
        recordSource,
        recordId,
        title,
        journal: journalTitle(row),
        pubYear,
        authorString,
        pmid,
        doi,
        url: urlArticle,
      };
    })
    .filter(Boolean) as EuropepmcSearchItem[];
}

export function normalizeEuropepmcItemsToKnowledgeDocuments(
  items: EuropepmcSearchItem[],
): Array<
  KnowledgeDocumentRef & {
    abstract?: string | null;
    documentKind?: string | null;
    license?: string | null;
    payload?: Record<string, unknown> | null;
  }
> {
  return items.map((item) => ({
    sourceDb: "europe_pmc",
    externalId: `${item.recordSource}:${item.recordId}`,
    title: item.title,
    url: item.url,
    journal: item.journal,
    publicationDate: item.pubYear,
    abstract: null,
    documentKind: "article",
    license: null,
    payload: {
      importedFrom: "europe_pmc",
      recordSource: item.recordSource,
      recordId: item.recordId,
      pmid: item.pmid,
      doi: item.doi,
      authorString: item.authorString,
    },
  }));
}
