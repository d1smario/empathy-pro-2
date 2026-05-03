-- Policy ingest per atleta + provider: quali stream (sleep, workout, …) possono essere persistiti.
-- Gate per anti-doppione training e per estendere nuovi vendor senza fork del loop operativo.

create table if not exists public.athlete_device_ingest_policy (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  provider text not null,
  streams jsonb not null default '{}'::jsonb,
  constraint athlete_device_ingest_policy_athlete_provider_unique unique (athlete_id, provider),
  constraint athlete_device_ingest_policy_provider_nonempty check (char_length(trim(provider)) > 0)
);

create index if not exists idx_athlete_device_ingest_policy_athlete
  on public.athlete_device_ingest_policy (athlete_id);

comment on table public.athlete_device_ingest_policy is
  'Chiavi stream (es. whoop_workout) → abilitazione ingest; merge con default applicativo.';

alter table public.athlete_device_ingest_policy enable row level security;

drop policy if exists "athlete_device_ingest_policy_access_scoped" on public.athlete_device_ingest_policy;
create policy "athlete_device_ingest_policy_access_scoped"
  on public.athlete_device_ingest_policy
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_device_ingest_policy.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_device_ingest_policy.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = athlete_device_ingest_policy.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_device_ingest_policy.athlete_id
            )
          )
        )
    )
  );
