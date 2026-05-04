import type { KnowledgeEntityRef } from "@/lib/empathy/schemas";

const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

function ncbiKeyParam(): string {
  const key = process.env.NCBI_API_KEY?.trim();
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

function buildHumanGeneSearchTerm(q: string): string {
  const t = q.trim();
  if (!t) return "";
  const compact = t.replace(/\s+/g, "");
  if (/^[A-Za-z0-9.-]{1,20}$/.test(compact)) {
    return `${compact}[Gene Name] AND 9606[Taxonomy ID]`;
  }
  return `(${t}) AND 9606[Taxonomy ID]`;
}

async function geneEsearch(term: string, maxResults: number): Promise<string[]> {
  const url =
    `${ESEARCH}?db=gene&retmode=json&retmax=${encodeURIComponent(String(maxResults))}&term=${encodeURIComponent(term)}` +
    ncbiKeyParam();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { esearchresult?: { idlist?: string[] } };
  return data.esearchresult?.idlist ?? [];
}

type GeneSummaryRow = {
  uid?: string;
  name?: string;
  description?: string;
  nomenclaturesymbol?: string;
  nomenclaturename?: string;
  organism?: { scientificname?: string; taxid?: number };
};

async function geneEsummary(ids: string[]): Promise<GeneSummaryRow[]> {
  if (!ids.length) return [];
  const url =
    `${ESUMMARY}?db=gene&retmode=json&id=${encodeURIComponent(ids.join(","))}` + ncbiKeyParam();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    result?: Record<string, GeneSummaryRow | string[] | undefined> & { uids?: string[] };
  };
  const result = data.result ?? {};
  const uids = Array.isArray(result.uids) ? result.uids : [];
  return uids
    .map((id) => {
      const row = result[id];
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      return { ...row, uid: id };
    })
    .filter(Boolean) as GeneSummaryRow[];
}

export type NcbiGeneHit = {
  source: "ncbi_gene";
  geneId: string;
  symbol: string | null;
  description: string | null;
  organismName: string | null;
  taxId: number | null;
  url: string;
};

export async function searchNcbiHumanGenes(query: string, maxResults = 8): Promise<NcbiGeneHit[]> {
  const term = buildHumanGeneSearchTerm(query);
  if (!term) return [];
  const bounded = Math.max(1, Math.min(25, Math.trunc(maxResults) || 8));
  const ids = await geneEsearch(term, bounded);
  const rows = await geneEsummary(ids);

  return rows.map((row) => {
    const geneId = String(row.uid ?? "").trim();
    const symbol =
      typeof row.nomenclaturesymbol === "string" && row.nomenclaturesymbol.trim()
        ? row.nomenclaturesymbol.trim()
        : typeof row.name === "string" && row.name.trim()
          ? row.name.trim()
          : null;
    const description =
      typeof row.description === "string" && row.description.trim()
        ? row.description.trim()
        : typeof row.nomenclaturename === "string" && row.nomenclaturename.trim()
          ? row.nomenclaturename.trim()
          : null;
    const organismName =
      typeof row.organism?.scientificname === "string" && row.organism.scientificname.trim()
        ? row.organism.scientificname.trim()
        : null;
    const taxId =
      typeof row.organism?.taxid === "number" && Number.isFinite(row.organism.taxid)
        ? row.organism.taxid
        : null;

    return {
      source: "ncbi_gene" as const,
      geneId,
      symbol,
      description,
      organismName,
      taxId,
      url: `https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(geneId)}`,
    };
  });
}

export function ncbiGeneHitsToKnowledgeEntities(hits: NcbiGeneHit[]): KnowledgeEntityRef[] {
  return hits
    .filter((h) => h.geneId)
    .map((hit) => {
      const label = hit.symbol ?? hit.description ?? `Gene ${hit.geneId}`;
      const synonyms = [hit.symbol, hit.description].filter(
        (s): s is string => Boolean(s && s !== label),
      );
      return {
        entityType: "gene",
        sourceDb: "ncbi_gene",
        externalId: hit.geneId,
        label,
        synonyms: synonyms.length ? Array.from(new Set(synonyms)).slice(0, 6) : undefined,
      };
    });
}
