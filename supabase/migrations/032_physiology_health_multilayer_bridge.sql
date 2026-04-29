-- Pro 2 — physiology/health multilayer bridge.
--
-- Scope:
--   - structured lab import jobs for physiology/health ingestion
--   - explicit evidence linkage between lab/panels/systemic snapshots and knowledge hits
--   - minimal parity fields on biomarker_panels for ingest traceability
--
-- Notes:
--   - idempotent for shared V1/Pro 2 DB
--   - service-role writes remain valid; RLS focuses on scoped reads for app users

create extension if not exists pgcrypto;

-- ========= metabolic_lab_import_jobs =========
create table if not exists public.metabolic_lab_import_jobs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  source text not null check (source in ('manual_upload', 'lab_system', 'device_file', 'api', 'other')),
  status text not null check (status in ('queued', 'processing', 'done', 'error')),
  file_name text,
  file_size_bytes bigint,
  payload_checksum text,
  parser_version text,
  parsed_payload jsonb,
  quality_report jsonb,
  imported_metabolic_run_id uuid references public.metabolic_lab_runs (id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_metabolic_lab_import_jobs_athlete_created
  on public.metabolic_lab_import_jobs (athlete_id, created_at desc);

create index if not exists idx_metabolic_lab_import_jobs_status_created
  on public.metabolic_lab_import_jobs (status, created_at desc);

alter table public.metabolic_lab_import_jobs enable row level security;

drop policy if exists "metabolic_lab_import_jobs_select_scoped" on public.metabolic_lab_import_jobs;
create policy "metabolic_lab_import_jobs_select_scoped"
  on public.metabolic_lab_import_jobs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = metabolic_lab_import_jobs.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = metabolic_lab_import_jobs.athlete_id
            )
          )
        )
    )
  );

-- ========= physiology_evidence_links =========
create table if not exists public.physiology_evidence_links (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  metabolic_lab_run_id uuid references public.metabolic_lab_runs (id) on delete cascade,
  biomarker_panel_id uuid references public.biomarker_panels (id) on delete cascade,
  systemic_snapshot_id uuid references public.systemic_modulation_snapshots (id) on delete cascade,
  evidence_hit_id uuid not null references public.knowledge_evidence_hits (id) on delete cascade,
  link_type text not null check (link_type in ('supports', 'contradicts', 'contextual')),
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  rationale text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint physiology_evidence_links_source_ref_check
    check (num_nonnulls(metabolic_lab_run_id, biomarker_panel_id, systemic_snapshot_id) >= 1)
);

create index if not exists idx_physiology_evidence_links_athlete_created
  on public.physiology_evidence_links (athlete_id, created_at desc);

create index if not exists idx_physiology_evidence_links_evidence
  on public.physiology_evidence_links (evidence_hit_id, created_at desc);

create index if not exists idx_physiology_evidence_links_lab
  on public.physiology_evidence_links (metabolic_lab_run_id)
  where metabolic_lab_run_id is not null;

create index if not exists idx_physiology_evidence_links_panel
  on public.physiology_evidence_links (biomarker_panel_id)
  where biomarker_panel_id is not null;

create index if not exists idx_physiology_evidence_links_systemic
  on public.physiology_evidence_links (systemic_snapshot_id)
  where systemic_snapshot_id is not null;

alter table public.physiology_evidence_links enable row level security;

drop policy if exists "physiology_evidence_links_select_scoped" on public.physiology_evidence_links;
create policy "physiology_evidence_links_select_scoped"
  on public.physiology_evidence_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = physiology_evidence_links.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = physiology_evidence_links.athlete_id
            )
          )
        )
    )
  );

-- ========= biomarker_panels traceability extension =========
alter table public.biomarker_panels
  add column if not exists import_job_id uuid references public.metabolic_lab_import_jobs (id) on delete set null,
  add column if not exists evidence_summary jsonb;

create index if not exists idx_biomarker_panels_import_job
  on public.biomarker_panels (import_job_id)
  where import_job_id is not null;
