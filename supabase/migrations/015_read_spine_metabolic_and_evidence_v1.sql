-- Pro 2 — resto read-spine atteso da `resolveAthleteMemory` / fisiologia (V1).
-- Richiede: `001_pro2_v1_canonical_prereq_read_spine.sql` (athlete_profiles) e preferibilmente `014_*` (training).
--
-- Fonti V1 (`nextjs-empathy-pro/supabase/migrations/`):
--   • `005_metabolic_lab_runs.sql`
--   • `010_knowledge_evidence_hits.sql`

-- ========= metabolic_lab_runs (V1 005) =========
create table if not exists public.metabolic_lab_runs (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  section text not null check (section in ('metabolic_profile', 'lactate_analysis', 'max_oxidate')),
  model_version text not null default 'v0.1',
  input_payload jsonb not null,
  output_payload jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_metabolic_lab_runs_athlete_created
  on public.metabolic_lab_runs (athlete_id, created_at desc);

create index if not exists idx_metabolic_lab_runs_section_created
  on public.metabolic_lab_runs (section, created_at desc);

-- ========= knowledge_evidence_hits (V1 010) =========
create extension if not exists "pgcrypto";

create table if not exists public.knowledge_evidence_hits (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  source text not null check (source in ('pubmed', 'mygene', 'uniprot', 'kegg')),
  query text not null,
  external_id text,
  title text not null,
  summary text,
  url text,
  relevance_score numeric(6, 2),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_evidence_hits_athlete_created
  on public.knowledge_evidence_hits (athlete_id, created_at desc);

create index if not exists idx_knowledge_evidence_hits_source on public.knowledge_evidence_hits (source);

alter table public.knowledge_evidence_hits enable row level security;

drop policy if exists "knowledge_evidence_hits_select_scoped" on public.knowledge_evidence_hits;
create policy "knowledge_evidence_hits_select_scoped"
  on public.knowledge_evidence_hits
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = knowledge_evidence_hits.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = knowledge_evidence_hits.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "knowledge_evidence_hits_insert_scoped" on public.knowledge_evidence_hits;
create policy "knowledge_evidence_hits_insert_scoped"
  on public.knowledge_evidence_hits
  for insert
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = knowledge_evidence_hits.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = knowledge_evidence_hits.athlete_id
            )
          )
        )
    )
  );
