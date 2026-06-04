-- Pro 2 — RLS repair: 3 tabelle public ancora senza RLS sul DB condiviso (advisor Supabase).
--
-- Stato rilevato (2026-06):
--   • athlete_profiles — mai abilitato in repo (P0: PII profilo atleta)
--   • load_series, twin_states — definiti in 026 ma migration non applicata su alcuni progetti
--
-- Pattern: atleta proprietario (private + athlete_id) o coach con riga coach_athletes.
-- Scritture twin/load restano via service_role (nessuna policy INSERT/UPDATE authenticated).

-- ========= athlete_profiles =========
alter table public.athlete_profiles enable row level security;

drop policy if exists "athlete_profiles_select_scoped" on public.athlete_profiles;
create policy "athlete_profiles_select_scoped"
  on public.athlete_profiles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_profiles.id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_profiles.id
            )
          )
        )
    )
  );

drop policy if exists "athlete_profiles_insert_private_onboarding" on public.athlete_profiles;
create policy "athlete_profiles_insert_private_onboarding"
  on public.athlete_profiles
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and aup.role = 'private'
    )
  );

drop policy if exists "athlete_profiles_update_scoped" on public.athlete_profiles;
create policy "athlete_profiles_update_scoped"
  on public.athlete_profiles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = athlete_profiles.id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_profiles.id
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
          (aup.role = 'private' and aup.athlete_id = athlete_profiles.id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = athlete_profiles.id
            )
          )
        )
    )
  );

comment on table public.athlete_profiles is
  'Profilo atleta canonico (PII). RLS owner/coach; insert onboarding solo ruolo private.';

-- ========= load_series (idempotente da 026) =========
alter table public.load_series enable row level security;

drop policy if exists "load_series_select_scoped" on public.load_series;
create policy "load_series_select_scoped"
  on public.load_series
  for select
  to authenticated
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

-- ========= twin_states (idempotente da 026) =========
alter table public.twin_states enable row level security;

drop policy if exists "twin_states_select_scoped" on public.twin_states;
create policy "twin_states_select_scoped"
  on public.twin_states
  for select
  to authenticated
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
