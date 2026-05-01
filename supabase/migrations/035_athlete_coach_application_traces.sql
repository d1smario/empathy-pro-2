-- Pro 2 — persistent trace when coach applies a manual_action (intelligent loop → athlete memory read path).
-- RLS aligned to manual_actions / knowledge_evidence_hits patterns.

create extension if not exists pgcrypto;

create table if not exists public.athlete_coach_application_traces (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  manual_action_id uuid not null references public.manual_actions (id) on delete cascade,
  action_type text not null,
  payload_snapshot jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_athlete_coach_application_traces_manual_action unique (manual_action_id)
);

create index if not exists idx_athlete_coach_app_traces_athlete_created
  on public.athlete_coach_application_traces (athlete_id, created_at desc);

alter table public.athlete_coach_application_traces enable row level security;

drop policy if exists "athlete_coach_app_traces_select_scoped" on public.athlete_coach_application_traces;
create policy "athlete_coach_app_traces_select_scoped"
  on public.athlete_coach_application_traces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_coach_application_traces.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_coach_application_traces.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "athlete_coach_app_traces_insert_scoped" on public.athlete_coach_application_traces;
create policy "athlete_coach_app_traces_insert_scoped"
  on public.athlete_coach_application_traces
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_coach_application_traces.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_coach_application_traces.athlete_id
            )
          )
        )
    )
  );
