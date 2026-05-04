import type { KnowledgeEntityRef } from "@/lib/empathy/schemas";

const OLS_CHEBI_SEARCH = "https://www.ebi.ac.uk/ols/api/search";

function defaultUserAgent(): string {
  const custom = process.env.OLS_USER_AGENT?.trim();
  if (custom) return custom;
  return "empathy-pro-2/1.0 (+https://github.com/d1smario/empathy-pro-2)";
}

type OlsChebiDoc = {
  obo_id?: string;
  label?: string;
  description?: string[];
  iri?: string;
  exact_synonyms?: string[];
  related_synonyms?: string[];
};

type OlsSearchResponse = {
  response?: { docs?: OlsChebiDoc[] };
};

export type ChebiSearchHit = {
  source: "chebi";
  chebiId: string;
  label: string;
  description: string | null;
  synonymHints: string[];
  url: string;
};

export async function searchChebiTerms(query: string, maxResults = 8): Promise<ChebiSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const bounded = Math.max(1, Math.min(25, Math.trunc(maxResults) || 8));

  const url = new URL(OLS_CHEBI_SEARCH);
  url.searchParams.set("q", q);
  url.searchParams.set("ontology", "chebi");
  url.searchParams.set("rows", String(bounded));

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "User-Agent": defaultUserAgent(), Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as OlsSearchResponse;
  const docs = data.response?.docs ?? [];

  return docs
    .map((doc) => {
      const chebiId = typeof doc.obo_id === "string" && doc.obo_id.trim() ? doc.obo_id.trim() : "";
      const label = typeof doc.label === "string" && doc.label.trim() ? doc.label.trim() : "";
      if (!chebiId || !label) return null;
      const description =
        Array.isArray(doc.description) && typeof doc.description[0] === "string"
          ? doc.description[0].trim().slice(0, 500)
          : null;
      const alt = [
        ...(Array.isArray(doc.exact_synonyms) ? doc.exact_synonyms : []),
        ...(Array.isArray(doc.related_synonyms) ? doc.related_synonyms : []),
      ]
        .map((s) => String(s ?? "").trim())
        .filter(Boolean);

      return {
        source: "chebi" as const,
        chebiId,
        label,
        description,
        synonymHints: Array.from(new Set(alt)).slice(0, 6),
        url: `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${encodeURIComponent(chebiId)}`,
      };
    })
    .filter(Boolean) as ChebiSearchHit[];
}

export function chebiHitsToKnowledgeEntities(hits: ChebiSearchHit[]): KnowledgeEntityRef[] {
  return hits.map((hit) => {
    const syn = hit.synonymHints.filter((s) => s.toLowerCase() !== hit.label.toLowerCase());
    return {
      entityType: "metabolite",
      sourceDb: "chebi",
      externalId: hit.chebiId,
      label: hit.label,
      synonyms: syn.length ? syn : undefined,
    };
  });
}
