-- Pro 2 - expected vs obtained adaptation deltas.
--
-- Stores deterministic comparison snapshots between plan, execution and internal response.
-- It does not mutate planned sessions directly; adaptations remain staged through L2 interpretation.

create extension if not exists pgcrypto;

create table if not exists public.training_expected_obtained_deltas (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  date date not null,
  planned_workout_ids uuid[] not null default '{}'::uuid[],
  executed_workout_ids uuid[] not null default '{}'::uuid[],
  expected_load jsonb not null default '{}'::jsonb,
  obtained_load jsonb not null default '{}'::jsonb,
  internal_response jsonb not null default '{}'::jsonb,
  delta jsonb not null default '{}'::jsonb,
  readiness jsonb not null default '{}'::jsonb,
  adaptation_hint jsonb not null default '{}'::jsonb,
  status text not null check (status in ('aligned','watch','adapt','recover')),
  source text not null default 'expected_vs_obtained_v1',
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, date)
);

create index if not exists idx_training_expected_obtained_athlete_date
  on public.training_expected_obtained_deltas (athlete_id, date desc);

create index if not exists idx_training_expected_obtained_status
  on public.training_expected_obtained_deltas (athlete_id, status, computed_at desc);

alter table public.training_expected_obtained_deltas enable row level security;

drop policy if exists "training_expected_obtained_select_scoped" on public.training_expected_obtained_deltas;
create policy "training_expected_obtained_select_scoped"
  on public.training_expected_obtained_deltas
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = training_expected_obtained_deltas.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = training_expected_obtained_deltas.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "training_expected_obtained_insert_scoped" on public.training_expected_obtained_deltas;
create policy "training_expected_obtained_insert_scoped"
  on public.training_expected_obtained_deltas
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = training_expected_obtained_deltas.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = training_expected_obtained_deltas.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "training_expected_obtained_update_scoped" on public.training_expected_obtained_deltas;
create policy "training_expected_obtained_update_scoped"
  on public.training_expected_obtained_deltas
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = training_expected_obtained_deltas.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = training_expected_obtained_deltas.athlete_id
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = training_expected_obtained_deltas.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = training_expected_obtained_deltas.athlete_id
            )
          )
        )
    )
  );
