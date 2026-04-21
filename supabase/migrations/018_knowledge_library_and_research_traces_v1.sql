-- Parità V1 → Pro 2 (L4.r knowledge): equivalente a
--   nextjs-empathy-pro/supabase/migrations/019_knowledge_library_foundation.sql
--   nextjs-empathy-pro/supabase/migrations/020_knowledge_research_traces.sql
-- (In questo file 019 è incluso prima di 020, come ordine V1.)

-- EMPATHY 3.0 - knowledge library foundation
-- Global scientific corpus + athlete-scoped bindings/modulations/session packets.

create extension if not exists pgcrypto;

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  source_db text not null check (
    source_db in (
      'pubmed',
      'europe_pmc',
      'reactome',
      'uniprot',
      'kegg',
      'hmdb',
      'chebi',
      'mgnify',
      'encode',
      'ensembl',
      'ncbi_gene',
      'gene_ontology',
      'metacyc',
      'manual_curation'
    )
  ),
  external_id text not null,
  title text not null,
  abstract text,
  url text,
  journal text,
  publication_date date,
  document_kind text,
  license text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_db, external_id)
);

create index if not exists idx_knowledge_documents_source
  on public.knowledge_documents (source_db);

create index if not exists idx_knowledge_documents_title_search
  on public.knowledge_documents using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(abstract, ''))
  );

create table if not exists public.knowledge_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in (
      'gene',
      'protein',
      'pathway',
      'metabolite',
      'microbe',
      'nutrient',
      'biomarker',
      'hormone',
      'phenotype',
      'process'
    )
  ),
  source_db text not null check (
    source_db in (
      'pubmed',
      'europe_pmc',
      'reactome',
      'uniprot',
      'kegg',
      'hmdb',
      'chebi',
      'mgnify',
      'encode',
      'ensembl',
      'ncbi_gene',
      'gene_ontology',
      'metacyc',
      'manual_curation'
    )
  ),
  external_id text not null,
  canonical_name text not null,
  synonyms jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, source_db, external_id)
);

create index if not exists idx_knowledge_entities_type_source
  on public.knowledge_entities (entity_type, source_db);

create index if not exists idx_knowledge_entities_name_search
  on public.knowledge_entities using gin (
    to_tsvector('simple', coalesce(canonical_name, ''))
  );

create table if not exists public.knowledge_assertions (
  id uuid primary key default gen_random_uuid(),
  subject_entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  predicate text not null check (
    predicate in (
      'activates',
      'inhibits',
      'modulates',
      'supports',
      'requires',
      'depletes',
      'produces',
      'consumes',
      'associates_with',
      'correlates_with'
    )
  ),
  object_entity_id uuid references public.knowledge_entities(id) on delete set null,
  context_tags text[] not null default '{}',
  mechanism_tags text[] not null default '{}',
  evidence_level text not null check (evidence_level in ('strong', 'moderate', 'weak', 'exploratory')),
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_assertions_subject
  on public.knowledge_assertions (subject_entity_id);

create index if not exists idx_knowledge_assertions_object
  on public.knowledge_assertions (object_entity_id);

create index if not exists idx_knowledge_assertions_context_tags
  on public.knowledge_assertions using gin (context_tags);

create table if not exists public.knowledge_assertion_documents (
  assertion_id uuid not null references public.knowledge_assertions(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (assertion_id, document_id)
);

create index if not exists idx_knowledge_assertion_documents_document
  on public.knowledge_assertion_documents (document_id);

create table if not exists public.athlete_knowledge_bindings (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  domain text not null check (
    domain in ('training', 'nutrition', 'health', 'recovery', 'physiology', 'bioenergetics', 'cross_module')
  ),
  status text not null check (status in ('candidate', 'active', 'archived')),
  adaptation_target text,
  session_date date,
  planned_workout_id uuid references public.planned_workouts(id) on delete set null,
  triggered_by jsonb,
  context_tags text[] not null default '{}',
  evidence_level text not null check (evidence_level in ('strong', 'moderate', 'weak', 'exploratory')),
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  valid_from date,
  valid_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_athlete_knowledge_bindings_athlete_status
  on public.athlete_knowledge_bindings (athlete_id, status, created_at desc);

create index if not exists idx_athlete_knowledge_bindings_planned
  on public.athlete_knowledge_bindings (planned_workout_id);

create table if not exists public.athlete_knowledge_binding_assertions (
  binding_id uuid not null references public.athlete_knowledge_bindings(id) on delete cascade,
  assertion_id uuid not null references public.knowledge_assertions(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (binding_id, assertion_id)
);

create index if not exists idx_athlete_knowledge_binding_assertions_assertion
  on public.athlete_knowledge_binding_assertions (assertion_id);

create table if not exists public.knowledge_modulation_snapshots (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  domain text not null check (
    domain in ('training', 'nutrition', 'health', 'recovery', 'physiology', 'bioenergetics', 'cross_module')
  ),
  adaptation_target text,
  session_date date,
  planned_workout_id uuid references public.planned_workouts(id) on delete set null,
  constraint_level text not null check (constraint_level in ('hard', 'soft', 'adaptive')),
  hard_constraints text[] not null default '{}',
  soft_constraints text[] not null default '{}',
  adaptive_flags text[] not null default '{}',
  recommended_supports text[] not null default '{}',
  blocked_supports text[] not null default '{}',
  reasoning_summary text,
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  evidence_level text not null check (evidence_level in ('strong', 'moderate', 'weak', 'exploratory')),
  evidence_refs jsonb,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_modulation_snapshots_athlete_created
  on public.knowledge_modulation_snapshots (athlete_id, created_at desc);

create index if not exists idx_knowledge_modulation_snapshots_planned
  on public.knowledge_modulation_snapshots (planned_workout_id);

create table if not exists public.session_knowledge_packets (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  planned_workout_id uuid references public.planned_workouts(id) on delete set null,
  session_date date,
  adaptation_target text,
  physiological_intent text[] not null default '{}',
  primary_mechanisms text[] not null default '{}',
  pathway_entity_ids jsonb,
  gene_entity_ids jsonb,
  protein_entity_ids jsonb,
  metabolite_entity_ids jsonb,
  microbiota_entity_ids jsonb,
  nutrition_supports text[] not null default '{}',
  inhibitors_and_risks text[] not null default '{}',
  modulation_snapshot_id uuid references public.knowledge_modulation_snapshots(id) on delete set null,
  evidence_level text not null check (evidence_level in ('strong', 'moderate', 'weak', 'exploratory')),
  confidence numeric(4,3) not null default 0 check (confidence >= 0 and confidence <= 1),
  evidence_refs jsonb,
  reasoning_policy jsonb,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_session_knowledge_packets_athlete_date
  on public.session_knowledge_packets (athlete_id, session_date desc);

create unique index if not exists uq_session_knowledge_packets_planned
  on public.session_knowledge_packets (planned_workout_id)
  where planned_workout_id is not null;

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_entities enable row level security;
alter table public.knowledge_assertions enable row level security;
alter table public.knowledge_assertion_documents enable row level security;
alter table public.athlete_knowledge_bindings enable row level security;
alter table public.athlete_knowledge_binding_assertions enable row level security;
alter table public.knowledge_modulation_snapshots enable row level security;
alter table public.session_knowledge_packets enable row level security;

drop policy if exists "knowledge_documents_read_auth" on public.knowledge_documents;
create policy "knowledge_documents_read_auth"
  on public.knowledge_documents
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "knowledge_entities_read_auth" on public.knowledge_entities;
create policy "knowledge_entities_read_auth"
  on public.knowledge_entities
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "knowledge_assertions_read_auth" on public.knowledge_assertions;
create policy "knowledge_assertions_read_auth"
  on public.knowledge_assertions
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "knowledge_assertion_documents_read_auth" on public.knowledge_assertion_documents;
create policy "knowledge_assertion_documents_read_auth"
  on public.knowledge_assertion_documents
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "athlete_knowledge_bindings_select_scoped" on public.athlete_knowledge_bindings;
create policy "athlete_knowledge_bindings_select_scoped"
  on public.athlete_knowledge_bindings
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_knowledge_bindings.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = athlete_knowledge_bindings.athlete_id
          ))
        )
    )
  );

drop policy if exists "athlete_knowledge_bindings_insert_scoped" on public.athlete_knowledge_bindings;
create policy "athlete_knowledge_bindings_insert_scoped"
  on public.athlete_knowledge_bindings
  for insert
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_knowledge_bindings.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = athlete_knowledge_bindings.athlete_id
          ))
        )
    )
  );

drop policy if exists "athlete_knowledge_bindings_update_scoped" on public.athlete_knowledge_bindings;
create policy "athlete_knowledge_bindings_update_scoped"
  on public.athlete_knowledge_bindings
  for update
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_knowledge_bindings.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = athlete_knowledge_bindings.athlete_id
          ))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_knowledge_bindings.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = athlete_knowledge_bindings.athlete_id
          ))
        )
    )
  );

drop policy if exists "athlete_knowledge_binding_assertions_select_scoped" on public.athlete_knowledge_binding_assertions;
create policy "athlete_knowledge_binding_assertions_select_scoped"
  on public.athlete_knowledge_binding_assertions
  for select
  using (
    exists (
      select 1
      from public.athlete_knowledge_bindings akb
      join public.app_user_profiles aup on true
      where akb.id = athlete_knowledge_binding_assertions.binding_id
        and aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = akb.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = akb.athlete_id
          ))
        )
    )
  );

drop policy if exists "knowledge_modulation_snapshots_select_scoped" on public.knowledge_modulation_snapshots;
create policy "knowledge_modulation_snapshots_select_scoped"
  on public.knowledge_modulation_snapshots
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = knowledge_modulation_snapshots.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = knowledge_modulation_snapshots.athlete_id
          ))
        )
    )
  );

drop policy if exists "knowledge_modulation_snapshots_insert_scoped" on public.knowledge_modulation_snapshots;
create policy "knowledge_modulation_snapshots_insert_scoped"
  on public.knowledge_modulation_snapshots
  for insert
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = knowledge_modulation_snapshots.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = knowledge_modulation_snapshots.athlete_id
          ))
        )
    )
  );

drop policy if exists "session_knowledge_packets_select_scoped" on public.session_knowledge_packets;
create policy "session_knowledge_packets_select_scoped"
  on public.session_knowledge_packets
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = session_knowledge_packets.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = session_knowledge_packets.athlete_id
          ))
        )
    )
  );

drop policy if exists "session_knowledge_packets_insert_scoped" on public.session_knowledge_packets;
create policy "session_knowledge_packets_insert_scoped"
  on public.session_knowledge_packets
  for insert
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = session_knowledge_packets.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = session_knowledge_packets.athlete_id
          ))
        )
    )
  );
-- EMPATHY 3.0 - research planner traces
-- Persist structured multi-hop scientific research plans and their links
-- to the knowledge corpus and mechanism graph.
--
-- PREREQUISITO (ordine migrations): applicare PRIMA
--   019_knowledge_library_foundation.sql
-- che crea public.knowledge_documents e public.knowledge_assertions.
-- Senza 019, la CREATE di knowledge_expansion_trace_hop_documents fallisce (42P01).

DO $prereq$
BEGIN
  IF to_regclass('public.knowledge_documents') IS NULL THEN
    RAISE EXCEPTION
      'Migration 020 richiede 019: eseguire prima supabase/migrations/019_knowledge_library_foundation.sql (manca public.knowledge_documents).';
  END IF;
  IF to_regclass('public.knowledge_assertions') IS NULL THEN
    RAISE EXCEPTION
      'Migration 020 richiede 019: eseguire prima supabase/migrations/019_knowledge_library_foundation.sql (manca public.knowledge_assertions).';
  END IF;
END
$prereq$;

create table if not exists public.knowledge_expansion_traces (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athlete_profiles(id) on delete cascade,
  planned_workout_id uuid references public.planned_workouts(id) on delete set null,
  trigger_kind text not null check (
    trigger_kind in (
      'adaptation_target',
      'session_stimulus',
      'mechanism_entity',
      'modulation_followup',
      'downstream_projection'
    )
  ),
  module text check (
    module in ('training', 'nutrition', 'health', 'recovery', 'physiology', 'bioenergetics', 'cross_module')
  ),
  adaptation_target text,
  stimulus_label text,
  entity_label text,
  session_date date,
  status text not null check (status in ('draft', 'ready', 'running', 'complete')),
  intents jsonb not null default '[]'::jsonb,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_expansion_traces_athlete_created
  on public.knowledge_expansion_traces (athlete_id, created_at desc);

create index if not exists idx_knowledge_expansion_traces_planned
  on public.knowledge_expansion_traces (planned_workout_id);

create table if not exists public.knowledge_expansion_trace_hops (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.knowledge_expansion_traces(id) on delete cascade,
  hop_id text not null,
  intent_id text not null,
  hop_kind text not null check (
    hop_kind in (
      'literature_search',
      'entity_lookup',
      'pathway_lookup',
      'reaction_lookup',
      'projection_review'
    )
  ),
  status text not null default 'planned' check (status in ('planned', 'running', 'complete')),
  question text not null,
  source_dbs text[] not null default '{}',
  expected_entity_types text[] not null default '{}',
  context_tags text[] not null default '{}',
  result_summary text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trace_id, hop_id)
);

create index if not exists idx_knowledge_expansion_trace_hops_trace
  on public.knowledge_expansion_trace_hops (trace_id, created_at asc);

create table if not exists public.knowledge_expansion_trace_hop_documents (
  trace_hop_id uuid not null references public.knowledge_expansion_trace_hops(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trace_hop_id, document_id)
);

create index if not exists idx_knowledge_expansion_trace_hop_documents_document
  on public.knowledge_expansion_trace_hop_documents (document_id);

create table if not exists public.knowledge_expansion_trace_hop_assertions (
  trace_hop_id uuid not null references public.knowledge_expansion_trace_hops(id) on delete cascade,
  assertion_id uuid not null references public.knowledge_assertions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trace_hop_id, assertion_id)
);

create index if not exists idx_knowledge_expansion_trace_hop_assertions_assertion
  on public.knowledge_expansion_trace_hop_assertions (assertion_id);

alter table public.knowledge_expansion_traces enable row level security;
alter table public.knowledge_expansion_trace_hops enable row level security;
alter table public.knowledge_expansion_trace_hop_documents enable row level security;
alter table public.knowledge_expansion_trace_hop_assertions enable row level security;

drop policy if exists "knowledge_expansion_traces_select_scoped" on public.knowledge_expansion_traces;
create policy "knowledge_expansion_traces_select_scoped"
  on public.knowledge_expansion_traces
  for select
  using (
    athlete_id is null
    or exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = knowledge_expansion_traces.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = knowledge_expansion_traces.athlete_id
          ))
        )
    )
  );

drop policy if exists "knowledge_expansion_traces_insert_scoped" on public.knowledge_expansion_traces;
create policy "knowledge_expansion_traces_insert_scoped"
  on public.knowledge_expansion_traces
  for insert
  with check (
    athlete_id is null
    or exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = knowledge_expansion_traces.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = knowledge_expansion_traces.athlete_id
          ))
        )
    )
  );

drop policy if exists "knowledge_expansion_traces_update_scoped" on public.knowledge_expansion_traces;
create policy "knowledge_expansion_traces_update_scoped"
  on public.knowledge_expansion_traces
  for update
  using (
    athlete_id is null
    or exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = knowledge_expansion_traces.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = knowledge_expansion_traces.athlete_id
          ))
        )
    )
  )
  with check (
    athlete_id is null
    or exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = knowledge_expansion_traces.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = knowledge_expansion_traces.athlete_id
          ))
        )
    )
  );

drop policy if exists "knowledge_expansion_trace_hops_select_scoped" on public.knowledge_expansion_trace_hops;
create policy "knowledge_expansion_trace_hops_select_scoped"
  on public.knowledge_expansion_trace_hops
  for select
  using (
    exists (
      select 1
      from public.knowledge_expansion_traces ket
      where ket.id = knowledge_expansion_trace_hops.trace_id
        and (
          ket.athlete_id is null
          or exists (
            select 1
            from public.app_user_profiles aup
            where aup.user_id = auth.uid()
              and (
                (aup.role = 'private' and aup.athlete_id = ket.athlete_id)
                or
                (aup.role = 'coach' and exists (
                  select 1 from public.coach_athletes ca
                  where ca.coach_user_id = auth.uid()
                    and ca.athlete_id = ket.athlete_id
                ))
              )
          )
        )
    )
  );

drop policy if exists "knowledge_expansion_trace_hops_insert_scoped" on public.knowledge_expansion_trace_hops;
create policy "knowledge_expansion_trace_hops_insert_scoped"
  on public.knowledge_expansion_trace_hops
  for insert
  with check (
    exists (
      select 1
      from public.knowledge_expansion_traces ket
      where ket.id = knowledge_expansion_trace_hops.trace_id
        and (
          ket.athlete_id is null
          or exists (
            select 1
            from public.app_user_profiles aup
            where aup.user_id = auth.uid()
              and (
                (aup.role = 'private' and aup.athlete_id = ket.athlete_id)
                or
                (aup.role = 'coach' and exists (
                  select 1 from public.coach_athletes ca
                  where ca.coach_user_id = auth.uid()
                    and ca.athlete_id = ket.athlete_id
                ))
              )
          )
        )
    )
  );

drop policy if exists "knowledge_expansion_trace_hops_update_scoped" on public.knowledge_expansion_trace_hops;
create policy "knowledge_expansion_trace_hops_update_scoped"
  on public.knowledge_expansion_trace_hops
  for update
  using (
    exists (
      select 1
      from public.knowledge_expansion_traces ket
      where ket.id = knowledge_expansion_trace_hops.trace_id
        and (
          ket.athlete_id is null
          or exists (
            select 1
            from public.app_user_profiles aup
            where aup.user_id = auth.uid()
              and (
                (aup.role = 'private' and aup.athlete_id = ket.athlete_id)
                or
                (aup.role = 'coach' and exists (
                  select 1 from public.coach_athletes ca
                  where ca.coach_user_id = auth.uid()
                    and ca.athlete_id = ket.athlete_id
                ))
              )
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.knowledge_expansion_traces ket
      where ket.id = knowledge_expansion_trace_hops.trace_id
        and (
          ket.athlete_id is null
          or exists (
            select 1
            from public.app_user_profiles aup
            where aup.user_id = auth.uid()
              and (
                (aup.role = 'private' and aup.athlete_id = ket.athlete_id)
                or
                (aup.role = 'coach' and exists (
                  select 1 from public.coach_athletes ca
                  where ca.coach_user_id = auth.uid()
                    and ca.athlete_id = ket.athlete_id
                ))
              )
          )
        )
    )
  );

drop policy if exists "knowledge_expansion_trace_hop_documents_select_scoped" on public.knowledge_expansion_trace_hop_documents;
create policy "knowledge_expansion_trace_hop_documents_select_scoped"
  on public.knowledge_expansion_trace_hop_documents
  for select
  using (
    exists (
      select 1
      from public.knowledge_expansion_trace_hops keh
      join public.knowledge_expansion_traces ket on ket.id = keh.trace_id
      where keh.id = knowledge_expansion_trace_hop_documents.trace_hop_id
        and (
          ket.athlete_id is null
          or exists (
            select 1
            from public.app_user_profiles aup
            where aup.user_id = auth.uid()
              and (
                (aup.role = 'private' and aup.athlete_id = ket.athlete_id)
                or
                (aup.role = 'coach' and exists (
                  select 1 from public.coach_athletes ca
                  where ca.coach_user_id = auth.uid()
                    and ca.athlete_id = ket.athlete_id
                ))
              )
          )
        )
    )
  );

drop policy if exists "knowledge_expansion_trace_hop_documents_insert_scoped" on public.knowledge_expansion_trace_hop_documents;
create policy "knowledge_expansion_trace_hop_documents_insert_scoped"
  on public.knowledge_expansion_trace_hop_documents
  for insert
  with check (
    exists (
      select 1
      from public.knowledge_expansion_trace_hops keh
      join public.knowledge_expansion_traces ket on ket.id = keh.trace_id
      where keh.id = knowledge_expansion_trace_hop_documents.trace_hop_id
        and (
          ket.athlete_id is null
          or exists (
            select 1
            from public.app_user_profiles aup
            where aup.user_id = auth.uid()
              and (
                (aup.role = 'private' and aup.athlete_id = ket.athlete_id)
                or
                (aup.role = 'coach' and exists (
                  select 1 from public.coach_athletes ca
                  where ca.coach_user_id = auth.uid()
                    and ca.athlete_id = ket.athlete_id
                ))
              )
          )
        )
    )
  );

drop policy if exists "knowledge_expansion_trace_hop_assertions_select_scoped" on public.knowledge_expansion_trace_hop_assertions;
create policy "knowledge_expansion_trace_hop_assertions_select_scoped"
  on public.knowledge_expansion_trace_hop_assertions
  for select
  using (
    exists (
      select 1
      from public.knowledge_expansion_trace_hops keh
      join public.knowledge_expansion_traces ket on ket.id = keh.trace_id
      where keh.id = knowledge_expansion_trace_hop_assertions.trace_hop_id
        and (
          ket.athlete_id is null
          or exists (
            select 1
            from public.app_user_profiles aup
            where aup.user_id = auth.uid()
              and (
                (aup.role = 'private' and aup.athlete_id = ket.athlete_id)
                or
                (aup.role = 'coach' and exists (
                  select 1 from public.coach_athletes ca
                  where ca.coach_user_id = auth.uid()
                    and ca.athlete_id = ket.athlete_id
                ))
              )
          )
        )
    )
  );

drop policy if exists "knowledge_expansion_trace_hop_assertions_insert_scoped" on public.knowledge_expansion_trace_hop_assertions;
create policy "knowledge_expansion_trace_hop_assertions_insert_scoped"
  on public.knowledge_expansion_trace_hop_assertions
  for insert
  with check (
    exists (
      select 1
      from public.knowledge_expansion_trace_hops keh
      join public.knowledge_expansion_traces ket on ket.id = keh.trace_id
      where keh.id = knowledge_expansion_trace_hop_assertions.trace_hop_id
        and (
          ket.athlete_id is null
          or exists (
            select 1
            from public.app_user_profiles aup
            where aup.user_id = auth.uid()
              and (
                (aup.role = 'private' and aup.athlete_id = ket.athlete_id)
                or
                (aup.role = 'coach' and exists (
                  select 1 from public.coach_athletes ca
                  where ca.coach_user_id = auth.uid()
                    and ca.athlete_id = ket.athlete_id
                ))
              )
          )
        )
    )
  );
