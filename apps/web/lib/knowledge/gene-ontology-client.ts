import type { KnowledgeEntityRef } from "@/lib/empathy/schemas";

const QUICKGO_SEARCH = "https://www.ebi.ac.uk/QuickGO/services/ontology/go/search";

function defaultUserAgent(): string {
  const custom = process.env.QUICKGO_USER_AGENT?.trim();
  if (custom) return custom;
  return "empathy-pro-2/1.0 (+https://github.com/d1smario/empathy-pro-2)";
}

type QuickGoHit = {
  id?: string;
  name?: string;
  isObsolete?: boolean;
  aspect?: string;
};

type QuickGoSearchResponse = {
  results?: QuickGoHit[];
};

export type GeneOntologyTermHit = {
  source: "gene_ontology";
  goId: string;
  name: string;
  aspect: string | null;
  url: string;
};

export async function searchGeneOntologyTerms(query: string, maxResults = 8): Promise<GeneOntologyTermHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const bounded = Math.max(1, Math.min(25, Math.trunc(maxResults) || 8));

  const url = new URL(QUICKGO_SEARCH);
  url.searchParams.set("query", q);
  url.searchParams.set("limit", String(bounded));
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "User-Agent": defaultUserAgent(), Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as QuickGoSearchResponse;
  const rows = data.results ?? [];

  return rows
    .filter((row) => row.isObsolete !== true)
    .map((row) => {
      const goId = typeof row.id === "string" && row.id.trim() ? row.id.trim() : "";
      const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "";
      if (!goId || !name) return null;
      const aspect = typeof row.aspect === "string" && row.aspect.trim() ? row.aspect.trim() : null;
      return {
        source: "gene_ontology" as const,
        goId,
        name,
        aspect,
        url: `https://www.ebi.ac.uk/QuickGO/term/${encodeURIComponent(goId)}`,
      };
    })
    .filter(Boolean) as GeneOntologyTermHit[];
}

/** Termini GO come entità “process” (BP/MF/CC sono distinti in `synonyms`/aspect nel payload UI). */
export function geneOntologyHitsToKnowledgeEntities(hits: GeneOntologyTermHit[]): KnowledgeEntityRef[] {
  return hits.map((hit) => ({
    entityType: "process",
    sourceDb: "gene_ontology",
    externalId: hit.goId,
    label: hit.name,
    synonyms: hit.aspect ? [hit.aspect] : undefined,
  }));
}
