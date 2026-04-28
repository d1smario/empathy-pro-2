-- Pro 2 — parita core state V1 per twin/load/event log.
--
-- Fonti V1 (`nextjs-empathy-pro/supabase/migrations/`):
--   - `001_empathy_canonical_schema.sql` — load_series, twin_states, empathy_events.
--
-- Scopo:
--   - rendere Pro 2 autonomo su DB greenfield;
--   - non dipendere implicitamente da una history V1 gia applicata;
--   - sbloccare il loop `reality -> compute -> twin -> adaptation -> event log`.
--
-- Idempotente su DB condivisi V1/Pro 2: usa CREATE IF NOT EXISTS e policy DROP/CREATE.

create extension if not exists "uuid-ossp";

-- ========= load_series (V1 001) =========
create table if not exists public.load_series (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  date date not null,
  load_kind text not null check (load_kind in ('external', 'internal')),
  atl numeric(12, 4),
  ctl numeric(12, 4),
  tsb numeric(12, 4),
  std numeric(12, 4),
  z_score numeric(8, 4),
  created_at timestamptz default now(),
  unique (athlete_id, date, load_kind)
);

create index if not exists idx_load_series_athlete_date
  on public.load_series (athlete_id, date desc);

alter table public.load_series enable row level security;

drop policy if exists "load_series_select_scoped" on public.load_series;
create policy "load_series_select_scoped"
  on public.load_series
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = load_series.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = load_series.athlete_id
            )
          )
        )
    )
  );

-- ========= twin_states (V1 001) =========
create table if not exists public.twin_states (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  as_of timestamptz not null default now(),
  fitness_chronic numeric(10, 4),
  fatigue_acute numeric(10, 4),
  readiness numeric(8, 4),
  recovery_debt numeric(10, 4),
  glycogen_status numeric(8, 4),
  autonomic_strain numeric(8, 4),
  glycolytic_strain numeric(8, 4),
  oxidative_bottleneck numeric(8, 4),
  redox_stress_index numeric(8, 4),
  thermal_stress numeric(8, 4),
  sleep_recovery numeric(8, 4),
  gi_tolerance numeric(8, 4),
  inflammation_risk numeric(8, 4),
  adaptation_score numeric(8, 4),
  expected_adaptation numeric(8, 4),
  real_adaptation numeric(8, 4),
  divergence_score numeric(8, 4),
  intervention_score numeric(8, 4),
  created_at timestamptz default now()
);

create index if not exists idx_twin_states_athlete_as_of
  on public.twin_states (athlete_id, as_of desc);

alter table public.twin_states enable row level security;

drop policy if exists "twin_states_select_scoped" on public.twin_states;
create policy "twin_states_select_scoped"
  on public.twin_states
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = twin_states.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = twin_states.athlete_id
            )
          )
        )
    )
  );

-- ========= empathy_events (V1 001) =========
create table if not exists public.empathy_events (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  athlete_id uuid references public.athlete_profiles (id) on delete set null,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_empathy_events_athlete_type
  on public.empathy_events (athlete_id, event_type, created_at desc);

create index if not exists idx_empathy_events_created
  on public.empathy_events (created_at desc);

alter table public.empathy_events enable row level security;

drop policy if exists "empathy_events_select_scoped" on public.empathy_events;
create policy "empathy_events_select_scoped"
  on public.empathy_events
  for select
  using (
    athlete_id is not null
    and exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = empathy_events.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = empathy_events.athlete_id
            )
          )
        )
    )
  );

