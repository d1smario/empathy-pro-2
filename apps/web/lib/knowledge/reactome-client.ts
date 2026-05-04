import type { KnowledgeEntityRef } from "@/lib/empathy/schemas";

const REACTOME_SEARCH_QUERY = "https://reactome.org/ContentService/search/query";

function stripHighlightHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function defaultUserAgent(): string {
  const custom = process.env.REACTOME_USER_AGENT?.trim();
  if (custom) return custom;
  return "empathy-pro-2/1.0 (+https://github.com/d1smario/empathy-pro-2)";
}

type ReactomeSearchEntry = {
  stId?: string;
  id?: string;
  name?: string;
  type?: string;
  species?: string[];
};

type ReactomeSearchResponse = {
  results?: Array<{ entries?: ReactomeSearchEntry[] }>;
};

export type ReactomePathwayHit = {
  source: "reactome";
  stableId: string;
  name: string;
  type: string | null;
  species: string[];
  url: string;
}

export async function searchReactomePathways(
  query: string,
  options?: { speciesTaxId?: number; maxResults?: number },
): Promise<ReactomePathwayHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const speciesTaxId = options?.speciesTaxId ?? 9606;
  const maxResults = Math.max(1, Math.min(25, Math.trunc(options?.maxResults ?? 8) || 8));

  const url = new URL(REACTOME_SEARCH_QUERY);
  url.searchParams.set("query", q);
  url.searchParams.set("species", String(speciesTaxId));
  url.searchParams.set("types", "Pathway");
  url.searchParams.set("cluster", "true");

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "User-Agent": defaultUserAgent(), Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as ReactomeSearchResponse;
  const hits: ReactomePathwayHit[] = [];

  for (const bucket of data.results ?? []) {
    for (const entry of bucket.entries ?? []) {
      const stableId = typeof entry.stId === "string" && entry.stId.trim() ? entry.stId.trim() : "";
      if (!stableId) continue;
      const rawName = typeof entry.name === "string" ? entry.name : "";
      const name = stripHighlightHtml(rawName) || stableId;
      const type = typeof entry.type === "string" && entry.type.trim() ? entry.type.trim() : null;
      const species = Array.isArray(entry.species)
        ? entry.species.map((s) => String(s ?? "").trim()).filter(Boolean)
        : [];

      hits.push({
        source: "reactome",
        stableId,
        name,
        type,
        species,
        url: `https://reactome.org/PathwayBrowser/#/${encodeURIComponent(stableId)}`,
      });
      if (hits.length >= maxResults) return hits;
    }
  }

  return hits;
}

export function reactomePathwayHitsToKnowledgeEntities(hits: ReactomePathwayHit[]): KnowledgeEntityRef[] {
  return hits.map((hit) => ({
    entityType: "pathway",
    sourceDb: "reactome",
    externalId: hit.stableId,
    label: hit.name,
    synonyms: hit.species.length ? hit.species.slice(0, 3) : undefined,
  }));
}
