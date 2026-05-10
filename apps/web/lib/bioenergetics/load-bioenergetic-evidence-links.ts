import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BioenergeticAxisFluidEvidenceLinkV1,
  BioenergeticEvidenceAxisRowV1,
  BioenergeticEvidenceFluidProcessRowV1,
  BioenergeticEvidenceLinkRelationKindV1,
  BioenergeticEvidenceLinkStrengthV1,
  KnowledgeDocumentRef,
  KnowledgeSourceDatabase,
} from "@empathy/contracts";

type LinkRow = {
  id: string;
  axis_id: string;
  fluid_process_id: string;
  relation_kind: string;
  strength: string;
  narrative_it: string;
  ontology_refs: unknown;
  curated_at: string;
};

type AxisRow = {
  id: string;
  code: string;
  label_it: string;
  family: string;
  notes_it: string | null;
};

type FluidRow = {
  id: string;
  code: string;
  label_it: string;
  category: string;
  notes_it: string | null;
};

type DocRow = {
  link_id: string;
  source_db: string;
  external_id: string;
  role: string;
  quote_or_figure_ref: string | null;
};

const SOURCE_DBS = new Set<string>([
  "pubmed",
  "europe_pmc",
  "reactome",
  "uniprot",
  "kegg",
  "hmdb",
  "chebi",
  "chembl",
  "mgnify",
  "encode",
  "ensembl",
  "ncbi_gene",
  "gene_ontology",
  "metacyc",
  "rhea",
  "manual_curation",
]);

function asSourceDb(raw: string): KnowledgeSourceDatabase {
  if (SOURCE_DBS.has(raw)) return raw as KnowledgeSourceDatabase;
  return "manual_curation";
}

function toDocumentRef(row: DocRow): KnowledgeDocumentRef {
  const title =
    typeof row.quote_or_figure_ref === "string" && row.quote_or_figure_ref.trim() !== ""
      ? row.quote_or_figure_ref.trim()
      : row.external_id;
  return {
    sourceDb: asSourceDb(row.source_db),
    externalId: row.external_id,
    title,
  };
}

function parseOntologyRefs(raw: unknown): Array<{ system: string; id: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Array<{ system: string; id: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const system = typeof rec.system === "string" ? rec.system : "";
    const id = typeof rec.id === "string" ? rec.id : "";
    if (system && id) out.push({ system, id });
  }
  return out.length ? out : undefined;
}

function mapAxis(row: AxisRow): BioenergeticEvidenceAxisRowV1 {
  return {
    id: row.id,
    code: row.code,
    labelIt: row.label_it,
    family: row.family as BioenergeticEvidenceAxisRowV1["family"],
    notesIt: row.notes_it,
  };
}

function mapFluid(row: FluidRow): BioenergeticEvidenceFluidProcessRowV1 {
  return {
    id: row.id,
    code: row.code,
    labelIt: row.label_it,
    category: row.category as BioenergeticEvidenceFluidProcessRowV1["category"],
    notesIt: row.notes_it,
  };
}

export type LoadBioenergeticEvidenceLinksResult =
  | { ok: true; links: BioenergeticAxisFluidEvidenceLinkV1[] }
  | { ok: false; links: []; error: string };

/**
 * Carica join curato assi ↔ fluidi ↔ documenti (tabelle 051/052). Thin read-only.
 */
export async function loadBioenergeticEvidenceAxisFluidLinks(
  db: SupabaseClient,
): Promise<LoadBioenergeticEvidenceLinksResult> {
  const [linksRes, axesRes, fluidsRes, docsRes] = await Promise.all([
    db.from("bioenergetic_evidence_axis_fluid_link").select("id, axis_id, fluid_process_id, relation_kind, strength, narrative_it, ontology_refs, curated_at"),
    db.from("bioenergetic_evidence_physiological_axis").select("id, code, label_it, family, notes_it"),
    db.from("bioenergetic_evidence_fluid_process").select("id, code, label_it, category, notes_it"),
    db.from("bioenergetic_evidence_axis_fluid_link_document").select("link_id, source_db, external_id, role, quote_or_figure_ref"),
  ]);

  const err =
    linksRes.error?.message ??
    axesRes.error?.message ??
    fluidsRes.error?.message ??
    docsRes.error?.message ??
    null;
  if (err) {
    return { ok: false, links: [], error: err };
  }

  const axes = new Map<string, AxisRow>();
  for (const row of (axesRes.data ?? []) as AxisRow[]) axes.set(row.id, row);
  const fluids = new Map<string, FluidRow>();
  for (const row of (fluidsRes.data ?? []) as FluidRow[]) fluids.set(row.id, row);

  const docsByLink = new Map<string, DocRow[]>();
  for (const row of (docsRes.data ?? []) as DocRow[]) {
    const list = docsByLink.get(row.link_id) ?? [];
    list.push(row);
    docsByLink.set(row.link_id, list);
  }

  const links: BioenergeticAxisFluidEvidenceLinkV1[] = [];
  for (const row of (linksRes.data ?? []) as LinkRow[]) {
    const ax = axes.get(row.axis_id);
    const fl = fluids.get(row.fluid_process_id);
    if (!ax || !fl) continue;
    const docRows = docsByLink.get(row.id) ?? [];
    const documents = docRows.map(toDocumentRef);
    const ontologyRefs = parseOntologyRefs(row.ontology_refs);
    links.push({
      linkId: row.id,
      relationKind: row.relation_kind as BioenergeticEvidenceLinkRelationKindV1,
      strength: row.strength as BioenergeticEvidenceLinkStrengthV1,
      narrativeIt: row.narrative_it,
      curatedAt: row.curated_at,
      axis: mapAxis(ax),
      fluidProcess: mapFluid(fl),
      documents,
      ontologyRefs,
    });
  }

  return { ok: true, links };
}
