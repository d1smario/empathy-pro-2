import type { KnowledgeEntityRef } from "@/lib/empathy/schemas";

const CHEMBL_MOLECULE_SEARCH = "https://www.ebi.ac.uk/chembl/api/data/molecule/search.json";

function defaultUserAgent(): string {
  const custom = process.env.CHEMBL_USER_AGENT?.trim();
  if (custom) return custom;
  return "empathy-pro-2/1.0 (+https://github.com/d1smario/empathy-pro-2)";
}

type ChemblMoleculeRow = {
  molecule_chembl_id?: string;
  pref_name?: string | null;
  molecule_type?: string | null;
  molecule_properties?: { full_molformula?: string | null; full_mwt?: string | null };
};

type ChemblSearchResponse = {
  molecules?: ChemblMoleculeRow[];
};

export type ChemblMoleculeHit = {
  source: "chembl";
  chemblId: string;
  prefName: string | null;
  moleculeType: string | null;
  formula: string | null;
  molWeight: string | null;
  url: string;
};

export async function searchChemblMolecules(query: string, maxResults = 8): Promise<ChemblMoleculeHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const bounded = Math.max(1, Math.min(25, Math.trunc(maxResults) || 8));

  const url = new URL(CHEMBL_MOLECULE_SEARCH);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(bounded));

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "User-Agent": defaultUserAgent(), Accept: "application/json" },
  });
  if (!res.ok) return [];

  const data = (await res.json()) as ChemblSearchResponse;
  const rows = data.molecules ?? [];

  return rows
    .map((row) => {
      const chemblId =
        typeof row.molecule_chembl_id === "string" && row.molecule_chembl_id.trim()
          ? row.molecule_chembl_id.trim()
          : "";
      if (!chemblId) return null;
      const prefName =
        typeof row.pref_name === "string" && row.pref_name.trim() ? row.pref_name.trim() : null;
      const moleculeType =
        typeof row.molecule_type === "string" && row.molecule_type.trim() ? row.molecule_type.trim() : null;
      const formula =
        typeof row.molecule_properties?.full_molformula === "string" &&
        row.molecule_properties.full_molformula.trim()
          ? row.molecule_properties.full_molformula.trim()
          : null;
      const molWeight =
        typeof row.molecule_properties?.full_mwt === "string" && row.molecule_properties.full_mwt.trim()
          ? row.molecule_properties.full_mwt.trim()
          : null;

      return {
        source: "chembl" as const,
        chemblId,
        prefName,
        moleculeType,
        formula,
        molWeight,
        url: `https://www.ebi.ac.uk/chembl/explore/compound/${encodeURIComponent(chemblId)}`,
      };
    })
    .filter(Boolean) as ChemblMoleculeHit[];
}

/** Mappatura come metabolita/chimico strutturato (ChEMBL non ha tipo "drug" nello schema EMPATHY). */
export function chemblMoleculeHitsToKnowledgeEntities(hits: ChemblMoleculeHit[]): KnowledgeEntityRef[] {
  return hits.map((hit) => {
    const label = hit.prefName ?? hit.chemblId;
    const synonyms = [hit.chemblId, hit.formula, hit.moleculeType].filter(
      (s): s is string => Boolean(s && s !== label),
    );
    return {
      entityType: "metabolite",
      sourceDb: "chembl",
      externalId: hit.chemblId,
      label,
      synonyms: synonyms.length ? Array.from(new Set(synonyms)).slice(0, 6) : undefined,
    };
  });
}
