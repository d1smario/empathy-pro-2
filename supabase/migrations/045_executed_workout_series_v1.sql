-- Pro 2 — Fase 3 device→UI: serie HD per sessione eseguita.
--
-- Persiste, separate dal `trace_summary`, le serie temporali downsampled per canale
-- (power/HR/speed/cadence/altitude/temperature) della singola `executed_workout`.
-- Sorgenti reali: parsing file FIT/GPX/TCX (`apps/web/lib/training/import-parser.ts`).
-- I provider cloud (Garmin Activity API / Strava / Wahoo) **non** popolano questa
-- tabella oggi: i loro summary non espongono stream HD gestibili in modo affidabile.
--
-- Vincoli:
--   - una riga per (executed_workout_id, channel, version)
--   - cancellazione cascade quando viene cancellato l'eseguito
--   - RLS coerente con `executed_workouts` (atleta proprietario o coach assegnato)
--
-- Idempotente: tutte le DDL usano `if not exists` / `drop policy if exists`.

create table if not exists public.executed_workout_series (
  id uuid primary key default gen_random_uuid(),
  executed_workout_id uuid not null references public.executed_workouts (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  channel text not null check (
    channel in ('power', 'hr', 'speed', 'cadence', 'altitude', 'temperature')
  ),
  unit text not null,
  sample_count integer not null check (sample_count >= 0),
  samples jsonb not null,
  source text not null default 'file_import',
  parser_engine text,
  parser_version text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_executed_workout_series_unique_channel
  on public.executed_workout_series (executed_workout_id, channel, version);

create index if not exists idx_executed_workout_series_athlete_channel
  on public.executed_workout_series (athlete_id, channel);

alter table public.executed_workout_series enable row level security;

drop policy if exists "executed_workout_series_access_scoped" on public.executed_workout_series;
create policy "executed_workout_series_access_scoped"
  on public.executed_workout_series
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = executed_workout_series.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = executed_workout_series.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = executed_workout_series.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = executed_workout_series.athlete_id
            )
          )
        )
    )
  );
