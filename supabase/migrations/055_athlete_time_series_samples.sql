-- Pro 2 — Campioni time-series canonici per atleta (CGM, lattato, futuri ormoni seriati).
-- Ingest: scrittura solo da adapter / route canonici (nessuna duplicazione logica in moduli UI).
-- Lettura: `loadBioenergeticDayMemorySlice` + `extractMeasuredGluLacFromSlice` (roadmap 3.1–3.2).

create table if not exists public.athlete_time_series_samples (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  observed_at timestamptz not null,
  channel text not null check (
    channel in (
      'glucose_mmol_l',
      'lactate_mmol_l'
    )
  ),
  value double precision not null,
  unit text not null default 'mmol/L',
  quality text null check (
    quality is null
    or quality in ('good', 'questionable', 'artifact', 'unknown')
  ),
  source text not null,
  source_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_athlete_time_series_samples_athlete_observed
  on public.athlete_time_series_samples (athlete_id, observed_at desc);

create index if not exists idx_athlete_time_series_samples_athlete_channel_observed
  on public.athlete_time_series_samples (athlete_id, channel, observed_at desc);

comment on table public.athlete_time_series_samples is
  'Serie dense per atleta (es. CGM). Canale + timestamp + valore; ingest via envelope normalizzato.';

alter table public.athlete_time_series_samples enable row level security;

drop policy if exists "athlete_time_series_samples_access_scoped" on public.athlete_time_series_samples;
create policy "athlete_time_series_samples_access_scoped"
  on public.athlete_time_series_samples
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_time_series_samples.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_time_series_samples.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = athlete_time_series_samples.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_time_series_samples.athlete_id
            )
          )
        )
    )
  );
