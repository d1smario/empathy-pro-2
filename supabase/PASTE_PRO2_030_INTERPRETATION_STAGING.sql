-- Pro 2 — Interpretation (L2) staging persistence.
--
-- First Pro 2-native schema for multi-level interpretation/orchestration:
-- Application gate -> staging runs -> findings -> explicit commit audit.
--
-- Guardrail: this schema stores proposals and audit only.
-- Canonical training/nutrition/twin numbers remain in deterministic pipelines.

create extension if not exists pgcrypto;

-- ========= interpretation_staging_runs =========
create table if not exists public.interpretation_staging_runs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  domain text not null check (
    domain in ('training', 'nutrition', 'health', 'recovery', 'physiology', 'bioenergetics', 'cross_module')
  ),
  status text not null default 'pending_validation' check (
    status in ('draft', 'ready', 'committed', 'rejected', 'pending_validation', 'archived')
  ),
  trigger_source text,
  source_refs jsonb not null default '[]'::jsonb,
  candidate_bundle jsonb,
  proposed_structured_patches jsonb,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interpretation_staging_runs_athlete_created
  on public.interpretation_staging_runs (athlete_id, created_at desc);

create index if not exists idx_interpretation_staging_runs_status
  on public.interpretation_staging_runs (status, created_at desc);

create index if not exists idx_interpretation_staging_runs_domain
  on public.interpretation_staging_runs (domain, created_at desc);

-- ========= interpretation_staging_findings =========
create table if not exists public.interpretation_staging_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.interpretation_staging_runs (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  topic text not null,
  summary text not null,
  sources jsonb not null default '[]'::jsonb,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_refs jsonb,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_interpretation_staging_findings_run
  on public.interpretation_staging_findings (run_id, created_at asc);

create index if not exists idx_interpretation_staging_findings_athlete_created
  on public.interpretation_staging_findings (athlete_id, created_at desc);

-- ========= interpretation_staging_commits =========
create table if not exists public.interpretation_staging_commits (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.interpretation_staging_runs (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  target text not null check (target in ('athlete_memory_trace', 'evidence', 'profile_audit')),
  target_ids jsonb not null default '[]'::jsonb,
  status text not null check (status in ('committed', 'rejected', 'pending_validation')),
  reason text,
  payload jsonb,
  committed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_interpretation_staging_commits_run
  on public.interpretation_staging_commits (run_id, created_at desc);

create index if not exists idx_interpretation_staging_commits_athlete_created
  on public.interpretation_staging_commits (athlete_id, created_at desc);

create index if not exists idx_interpretation_staging_commits_target_status
  on public.interpretation_staging_commits (target, status, created_at desc);

-- ========= RLS (read scoped owner/coach) =========
alter table public.interpretation_staging_runs enable row level security;
alter table public.interpretation_staging_findings enable row level security;
alter table public.interpretation_staging_commits enable row level security;

drop policy if exists "interpretation_staging_runs_select_scoped" on public.interpretation_staging_runs;
create policy "interpretation_staging_runs_select_scoped"
  on public.interpretation_staging_runs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = interpretation_staging_runs.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = interpretation_staging_runs.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "interpretation_staging_findings_select_scoped" on public.interpretation_staging_findings;
create policy "interpretation_staging_findings_select_scoped"
  on public.interpretation_staging_findings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = interpretation_staging_findings.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = interpretation_staging_findings.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "interpretation_staging_commits_select_scoped" on public.interpretation_staging_commits;
create policy "interpretation_staging_commits_select_scoped"
  on public.interpretation_staging_commits
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = interpretation_staging_commits.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = interpretation_staging_commits.athlete_id
            )
          )
        )
    )
  );

