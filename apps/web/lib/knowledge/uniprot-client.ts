import type { KnowledgeEntityRef } from "@/lib/empathy/schemas";

const UNIPROT_SEARCH = "https://rest.uniprot.org/uniprotkb/search";

/** Swiss-Prot / TrEMBL accession (pattern sintetica UniProt). */
function looksLikeUniprotAccession(token: string): boolean {
  return /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/.test(token);
}

/**
 * Costruisce una query UniProt default: umano (taxon 9606).
 * - Se sembra un accession → filtro accession.
 * - Se token alfanumerico corto → gene_exact uppercase.
 * - Altrimenti passa il testo tra parentesi (query field-free) + organismo.
 */
export function buildDefaultHumanUniProtQuery(q: string): string {
  const t = q.trim();
  if (!t) return "";
  const single = t.replace(/\s+/g, "");
  if (looksLikeUniprotAccession(single)) {
    return `(accession:${single}) AND (organism_id:9606)`;
  }
  if (/^[A-Za-z0-9.-]{1,24}$/.test(single)) {
    return `(gene_exact:${single.toUpperCase()}) AND (organism_id:9606)`;
  }
  return `(${t}) AND (organism_id:9606)`;
}

function defaultUserAgent(): string {
  const custom = process.env.UNIPROT_USER_AGENT?.trim();
  if (custom) return custom;
  return "empathy-pro-2/1.0 (+https://github.com/d1smario/empathy-pro-2)";
}

type UniProtSearchRow = {
  primaryAccession?: string;
  uniProtkbId?: string;
  proteinDescription?: {
    recommendedName?: { fullName?: { value?: string } };
  };
  genes?: Array<{ geneName?: { value?: string } }>;
  organism?: { scientificName?: string; taxonId?: number };
};

export type UniprotSearchHit = {
  source: "uniprot";
  accession: string;
  uniProtkbId: string | null;
  proteinName: string | null;
  geneSymbol: string | null;
  organismName: string | null;
  taxonId: number | null;
  url: string;
};

export async function searchUniprotHumanProteins(query: string, maxResults = 8): Promise<UniprotSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const bounded = Math.max(1, Math.min(25, Math.trunc(maxResults) || 8));
  const built = buildDefaultHumanUniProtQuery(trimmed);

  const url = new URL(UNIPROT_SEARCH);
  url.searchParams.set("query", built);
  url.searchParams.set("format", "json");
  url.searchParams.set("size", String(bounded));
  url.searchParams.set(
    "fields",
    "accession,id,gene_names,protein_name,organism_name",
  );

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "User-Agent": defaultUserAgent() },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: UniProtSearchRow[] };
  const rows = data.results ?? [];

  return rows
    .map((row) => {
      const accession = typeof row.primaryAccession === "string" ? row.primaryAccession.trim() : "";
      if (!accession) return null;
      const uniProtkbId = typeof row.uniProtkbId === "string" ? row.uniProtkbId.trim() : null;
      const proteinName =
        typeof row.proteinDescription?.recommendedName?.fullName?.value === "string"
          ? row.proteinDescription.recommendedName.fullName.value.trim()
          : null;
      const geneSymbol =
        typeof row.genes?.[0]?.geneName?.value === "string" ? row.genes[0].geneName.value.trim() : null;
      const organismName =
        typeof row.organism?.scientificName === "string" ? row.organism.scientificName.trim() : null;
      const taxonId =
        typeof row.organism?.taxonId === "number" && Number.isFinite(row.organism.taxonId)
          ? row.organism.taxonId
          : null;

      return {
        source: "uniprot" as const,
        accession,
        uniProtkbId,
        proteinName,
        geneSymbol,
        organismName,
        taxonId,
        url: `https://www.uniprot.org/uniprotkb/${encodeURIComponent(accession)}`,
      };
    })
    .filter(Boolean) as UniprotSearchHit[];
}

export function uniprotHitsToKnowledgeEntities(hits: UniprotSearchHit[]): KnowledgeEntityRef[] {
  return hits.map((hit) => {
    const label =
      hit.proteinName ??
      (hit.geneSymbol ? `${hit.geneSymbol} (${hit.accession})` : null) ??
      hit.uniProtkbId ??
      hit.accession;
    const synonyms = [hit.geneSymbol, hit.uniProtkbId].filter((s): s is string => Boolean(s && s !== label));
    return {
      entityType: "protein",
      sourceDb: "uniprot",
      externalId: hit.accession,
      label,
      synonyms: synonyms.length ? Array.from(new Set(synonyms)) : undefined,
    };
  });
}
