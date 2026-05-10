-- Pro 2 — Curated evidence: physiological / neuroendocrine axes ↔ fluid processes ↔ documents.
-- Read-only reference for bioenergetic evidence-conditioned layer (no athlete PII).
-- RLS: authenticated SELECT; writes via service_role / migrations only.

create extension if not exists pgcrypto;

-- ========= physiological axes =========
create table if not exists public.bioenergetic_evidence_physiological_axis (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_it text not null,
  family text not null check (
    family in ('endocrine', 'neuroendocrine', 'renal_fluid', 'autonomic', 'other')
  ),
  notes_it text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bioenergetic_evidence_axis_family
  on public.bioenergetic_evidence_physiological_axis (family);

-- ========= fluid processes =========
create table if not exists public.bioenergetic_evidence_fluid_process (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label_it text not null,
  category text not null check (
    category in (
      'plasma_volume',
      'ecw_shift',
      'transcapillary_filtration',
      'gi_water_handling',
      'sweat_loss',
      'other'
    )
  ),
  notes_it text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bioenergetic_evidence_fluid_category
  on public.bioenergetic_evidence_fluid_process (category);

-- ========= axis ↔ fluid link (curated narrative + ontology refs) =========
create table if not exists public.bioenergetic_evidence_axis_fluid_link (
  id uuid primary key default gen_random_uuid(),
  axis_id uuid not null references public.bioenergetic_evidence_physiological_axis (id) on delete cascade,
  fluid_process_id uuid not null references public.bioenergetic_evidence_fluid_process (id) on delete cascade,
  relation_kind text not null check (
    relation_kind in ('promotes', 'inhibits', 'modulates', 'context_dependent')
  ),
  strength text not null check (
    strength in ('hypothesis', 'supported', 'strong_consensus')
  ),
  narrative_it text not null,
  ontology_refs jsonb not null default '[]'::jsonb,
  curated_at timestamptz not null default now(),
  curated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (axis_id, fluid_process_id)
);

create index if not exists idx_bioenergetic_axis_fluid_link_axis
  on public.bioenergetic_evidence_axis_fluid_link (axis_id);

create index if not exists idx_bioenergetic_axis_fluid_link_fluid
  on public.bioenergetic_evidence_axis_fluid_link (fluid_process_id);

-- ========= documents per link (aligned to knowledge_documents source_db) =========
create table if not exists public.bioenergetic_evidence_axis_fluid_link_document (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.bioenergetic_evidence_axis_fluid_link (id) on delete cascade,
  source_db text not null check (
    source_db in (
      'pubmed',
      'europe_pmc',
      'reactome',
      'uniprot',
      'kegg',
      'hmdb',
      'chebi',
      'chembl',
      'mgnify',
      'encode',
      'ensembl',
      'ncbi_gene',
      'gene_ontology',
      'metacyc',
      'rhea',
      'manual_curation'
    )
  ),
  external_id text not null,
  role text not null check (role in ('primary', 'supporting')),
  quote_or_figure_ref text,
  created_at timestamptz not null default now(),
  unique (link_id, source_db, external_id, role)
);

create index if not exists idx_bioenergetic_axis_fluid_link_doc_link
  on public.bioenergetic_evidence_axis_fluid_link_document (link_id);

-- ========= RLS (global read for signed-in users) =========
alter table public.bioenergetic_evidence_physiological_axis enable row level security;
alter table public.bioenergetic_evidence_fluid_process enable row level security;
alter table public.bioenergetic_evidence_axis_fluid_link enable row level security;
alter table public.bioenergetic_evidence_axis_fluid_link_document enable row level security;

drop policy if exists "bioenergetic_evidence_axis_select_auth" on public.bioenergetic_evidence_physiological_axis;
create policy "bioenergetic_evidence_axis_select_auth"
  on public.bioenergetic_evidence_physiological_axis for select to authenticated using (true);

drop policy if exists "bioenergetic_evidence_fluid_select_auth" on public.bioenergetic_evidence_fluid_process;
create policy "bioenergetic_evidence_fluid_select_auth"
  on public.bioenergetic_evidence_fluid_process for select to authenticated using (true);

drop policy if exists "bioenergetic_evidence_link_select_auth" on public.bioenergetic_evidence_axis_fluid_link;
create policy "bioenergetic_evidence_link_select_auth"
  on public.bioenergetic_evidence_axis_fluid_link for select to authenticated using (true);

drop policy if exists "bioenergetic_evidence_link_doc_select_auth" on public.bioenergetic_evidence_axis_fluid_link_document;
create policy "bioenergetic_evidence_link_doc_select_auth"
  on public.bioenergetic_evidence_axis_fluid_link_document for select to authenticated using (true);

grant select on public.bioenergetic_evidence_physiological_axis to authenticated;
grant select on public.bioenergetic_evidence_fluid_process to authenticated;
grant select on public.bioenergetic_evidence_axis_fluid_link to authenticated;
grant select on public.bioenergetic_evidence_axis_fluid_link_document to authenticated;
