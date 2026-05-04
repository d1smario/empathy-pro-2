import type { KnowledgeEntityRef } from "@/lib/empathy/schemas";

const RHEA_SEARCH = "https://www.rhea-db.org/rhea";

function defaultUserAgent(): string {
  const custom = process.env.RHEA_USER_AGENT?.trim();
  if (custom) return custom;
  return "empathy-pro-2/1.0 (+https://github.com/d1smario/empathy-pro-2)";
}

type RheaJsonRow = {
  id?: string | number;
  equation?: string;
  status?: string;
  balanced?: boolean;
  transport?: boolean;
};

type RheaSearchResponse = {
  results?: RheaJsonRow[];
};

export type RheaReactionHit = {
  source: "rhea";
  rheaId: string;
  equation: string;
  status: string | null;
  balanced: boolean | null;
  transport: boolean | null;
  url: string;
};

export async function searchRheaReactions(query: string, maxResults = 8): Promise<RheaReactionHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const bounded = Math.max(1, Math.min(25, Math.trunc(maxResults) || 8));

  const url = new URL(RHEA_SEARCH);
  url.searchParams.set("query", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(bounded));

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "User-Agent": defaultUserAgent(), Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as RheaSearchResponse;
  const rows = data.results ?? [];

  return rows
    .map((row) => {
      const idRaw = row.id;
      const idStr = idRaw === undefined || idRaw === null ? "" : String(idRaw).trim();
      const equation = typeof row.equation === "string" && row.equation.trim() ? row.equation.trim() : "";
      if (!idStr || !equation) return null;
      const status = typeof row.status === "string" && row.status.trim() ? row.status.trim() : null;
      const balanced = typeof row.balanced === "boolean" ? row.balanced : null;
      const transport = typeof row.transport === "boolean" ? row.transport : null;
      const rheaId = `RHEA:${idStr}`;

      return {
        source: "rhea" as const,
        rheaId,
        equation,
        status,
        balanced,
        transport,
        url: `https://www.rhea-db.org/reaction?id=${encodeURIComponent(idStr)}`,
      };
    })
    .filter(Boolean) as RheaReactionHit[];
}

/** Reazione Rhea come “process” biochimico (non c’è tipo `reaction` nello schema EMPATHY). */
export function rheaHitsToKnowledgeEntities(hits: RheaReactionHit[]): KnowledgeEntityRef[] {
  return hits.map((hit) => {
    const label = hit.equation.length > 160 ? `${hit.equation.slice(0, 157)}…` : hit.equation;
    const bits = [hit.status, hit.balanced === true ? "balanced" : null, hit.transport === true ? "transport" : null]
      .filter(Boolean)
      .map(String);
    return {
      entityType: "process",
      sourceDb: "rhea",
      externalId: hit.rheaId,
      label,
      synonyms: bits.length ? bits : undefined,
    };
  });
}
