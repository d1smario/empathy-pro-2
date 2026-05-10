-- Pro 2 — Athlete data source preference
--
-- Permette al cliente di scegliere esplicitamente quale provider è "il padrone"
-- di un dominio canonico. Esempio:
--   - sonno    → WHOOP
--   - HRV/recovery → WHOOP
--   - training (attività eseguite) → Garmin
--
-- Quando una preferenza è impostata, le route di lettura filtrano `device_sync_exports`
-- (per wellness_*) o `executed_workouts.source` (per training_activity) sul provider scelto:
-- niente più mix tra WHOOP/Garmin/Wahoo nella stessa view.
--
-- Default: nessuna riga = nessuna preferenza esplicita → comportamento attuale (legge tutti i provider).
--
-- Il provider è validato in app side, non con CHECK SQL, perché l'elenco evolve
-- (cgm/dexcom/libre/manual/...). Idempotente.

create table if not exists public.athlete_data_source_preference (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  domain text not null check (
    domain in (
      'wellness_sleep',
      'wellness_recovery',
      'training_activity'
    )
  ),
  primary_provider text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_athlete_data_source_preference_unique
  on public.athlete_data_source_preference (athlete_id, domain);

create index if not exists idx_athlete_data_source_preference_athlete
  on public.athlete_data_source_preference (athlete_id);

alter table public.athlete_data_source_preference enable row level security;

drop policy if exists "adsp_access_scoped" on public.athlete_data_source_preference;
create policy "adsp_access_scoped"
  on public.athlete_data_source_preference
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_data_source_preference.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_data_source_preference.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = athlete_data_source_preference.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_data_source_preference.athlete_id
            )
          )
        )
    )
  );

comment on table public.athlete_data_source_preference is
  'Provider canonico scelto dal cliente per ciascun dominio (sonno/recovery/training). Read-side filtra su questo per evitare mix tra device.';
comment on column public.athlete_data_source_preference.domain is
  'wellness_sleep | wellness_recovery | training_activity';
comment on column public.athlete_data_source_preference.primary_provider is
  'whoop | garmin | wahoo | manual | (futuri: cgm, dexcom, libre, …) — validato in app, non in DB.';
