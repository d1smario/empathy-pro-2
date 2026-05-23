-- Pro 2 — Tracce risposta atleta per archetype seduta (library apply / planned vs executed).
-- Additive: nessun ALTER su planned_workouts / executed_workouts.

create table if not exists public.athlete_workout_archetype_traces (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  library_item_id uuid references public.coach_workout_library_items (id) on delete set null,
  planned_workout_id uuid,
  executed_workout_id uuid,
  archetype_key text not null,
  planned_tss integer not null default 0 check (planned_tss >= 0 and planned_tss <= 999),
  executed_tss integer not null default 0 check (executed_tss >= 0 and executed_tss <= 999),
  adherence_pct numeric(5, 2) not null default 0 check (adherence_pct >= 0 and adherence_pct <= 200),
  response_signal text not null default 'neutral' check (response_signal in ('positive', 'neutral', 'negative')),
  source text not null default 'planned_vs_executed' check (source in ('planned_vs_executed', 'library_apply')),
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_athlete_workout_archetype_traces_athlete_observed
  on public.athlete_workout_archetype_traces (athlete_id, observed_at desc);

create index if not exists idx_athlete_workout_archetype_traces_athlete_archetype
  on public.athlete_workout_archetype_traces (athlete_id, archetype_key, observed_at desc);

alter table public.athlete_workout_archetype_traces enable row level security;

drop policy if exists "athlete_workout_archetype_traces_select_scoped" on public.athlete_workout_archetype_traces;
create policy "athlete_workout_archetype_traces_select_scoped"
  on public.athlete_workout_archetype_traces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_workout_archetype_traces.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_workout_archetype_traces.athlete_id
            )
          )
        )
    )
  );

comment on table public.athlete_workout_archetype_traces is
  'Read spine: risposta atleta per archetype seduta (hash struttura blocchi). Popolamento best-effort post executed.';
