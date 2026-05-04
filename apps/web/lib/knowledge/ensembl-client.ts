import type { KnowledgeEntityRef } from "@/lib/empathy/schemas";

const ENSEMBL_REST = "https://rest.ensembl.org";

function defaultUserAgent(): string {
  const custom = process.env.ENSEMBL_USER_AGENT?.trim();
  if (custom) return custom;
  return "empathy-pro-2/1.0 (+https://github.com/d1smario/empathy-pro-2)";
}

function ensemblHeadersJson(): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": defaultUserAgent(),
  };
}

function ensemblHeadersGet(): HeadersInit {
  return { Accept: "application/json", "User-Agent": defaultUserAgent() };
}

/** Token: simbolo HGNC o gene id `ENSG` + 11 cifre. */
function parseGeneQueryTokens(q: string, maxSymbols: number): string[] {
  const raw = q
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const t of raw) {
    const ensg = t.match(/^ENSG(\d{11})$/i);
    if (ensg) {
      out.push(`ENSG${ensg[1]}`);
    } else if (/^[A-Za-z][A-Za-z0-9.-]{0,19}$/.test(t)) {
      out.push(t.toUpperCase());
    }
    if (out.length >= maxSymbols) break;
  }
  return Array.from(new Set(out)).slice(0, maxSymbols);
}

type EnsemblGenePayload = {
  id?: string;
  display_name?: string;
  biotype?: string;
  description?: string;
  seq_region_name?: string;
  start?: number;
  end?: number;
  strand?: number;
  object_type?: string;
};

export type EnsemblGeneHit = {
  source: "ensembl";
  ensemblId: string;
  displayName: string;
  biotype: string | null;
  description: string | null;
  locus: string | null;
  url: string;
};

async function lookupById(ensemblId: string): Promise<EnsemblGeneHit | null> {
  const url = `${ENSEMBL_REST}/lookup/id/${encodeURIComponent(ensemblId)}?content-type=application/json`;
  const res = await fetch(url, { cache: "no-store", headers: ensemblHeadersGet() });
  if (!res.ok) return null;
  const row = (await res.json()) as EnsemblGenePayload;
  if (row.object_type && row.object_type !== "Gene") return null;
  return mapRow(row);
}

function mapRow(row: EnsemblGenePayload): EnsemblGeneHit | null {
  const ensemblId = typeof row.id === "string" && row.id.trim() ? row.id.trim() : "";
  const displayName =
    typeof row.display_name === "string" && row.display_name.trim()
      ? row.display_name.trim()
      : ensemblId;
  if (!ensemblId) return null;
  const biotype = typeof row.biotype === "string" && row.biotype.trim() ? row.biotype.trim() : null;
  const description = typeof row.description === "string" && row.description.trim() ? row.description.trim() : null;
  const chr = typeof row.seq_region_name === "string" && row.seq_region_name.trim() ? row.seq_region_name.trim() : "";
  const locus =
    chr && typeof row.start === "number" && typeof row.end === "number"
      ? `chr${chr}:${row.start}-${row.end}${typeof row.strand === "number" ? ` strand ${row.strand}` : ""}`
      : null;

  return {
    source: "ensembl",
    ensemblId,
    displayName,
    biotype,
    description: description ? description.slice(0, 400) : null,
    locus,
    url: `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${encodeURIComponent(ensemblId)}`,
  };
}

async function lookupSymbolsBatch(symbols: string[]): Promise<EnsemblGeneHit[]> {
  if (!symbols.length) return [];
  const url = `${ENSEMBL_REST}/lookup/symbol/homo_sapiens`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: ensemblHeadersJson(),
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, EnsemblGenePayload | { error?: string }>;
  const hits: EnsemblGeneHit[] = [];
  for (const sym of symbols) {
    const row = data[sym];
    if (!row || typeof row !== "object" || "error" in row) continue;
    const mapped = mapRow(row as EnsemblGenePayload);
    if (mapped) hits.push(mapped);
  }
  return hits;
}

/**
 * Risolve geni Homo sapiens (GRCh38): simboli HGNC separati da spazio/virgola, o id ENSG…
 * (un solo id per richiesta se misto a simboli: i token ENSG vengono risolti via GET /lookup/id).
 */
export async function searchEnsemblHumanGenes(query: string, maxResults = 8): Promise<EnsemblGeneHit[]> {
  const bounded = Math.max(1, Math.min(25, Math.trunc(maxResults) || 8));
  const tokens = parseGeneQueryTokens(query, bounded);
  if (!tokens.length) return [];

  const ids = tokens.filter((t) => /^ENSG\d{11}$/.test(t));
  const symbols = tokens.filter((t) => !/^ENSG\d{11}$/.test(t));

  const out: EnsemblGeneHit[] = [];

  for (const id of ids) {
    const hit = await lookupById(id);
    if (hit) out.push(hit);
    if (out.length >= bounded) return out;
  }

  if (symbols.length) {
    const batch = await lookupSymbolsBatch(symbols);
    for (const h of batch) {
      out.push(h);
      if (out.length >= bounded) break;
    }
  }

  return out.slice(0, bounded);
}

export function ensemblHitsToKnowledgeEntities(hits: EnsemblGeneHit[]): KnowledgeEntityRef[] {
  return hits.map((hit) => {
    const syn = [hit.biotype, hit.locus, hit.description?.slice(0, 120)].filter(
      (s): s is string => Boolean(s && s !== hit.displayName),
    );
    return {
      entityType: "gene",
      sourceDb: "ensembl",
      externalId: hit.ensemblId,
      label: hit.displayName,
      synonyms: syn.length ? Array.from(new Set(syn)).slice(0, 5) : undefined,
    };
  });
}
