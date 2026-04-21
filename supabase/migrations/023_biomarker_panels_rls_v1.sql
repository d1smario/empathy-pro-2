-- Parità V1 → Pro 2 (L4.r health): equivalente a
--   nextjs-empathy-pro/supabase/migrations/006_secure_biomarker_panels_rls.sql
-- RLS su biomarker_panels (tabella da `001_pro2_v1_canonical_prereq_read_spine`).

alter table if exists public.biomarker_panels enable row level security;

drop policy if exists "biomarker_panels_select_scoped" on public.biomarker_panels;
create policy "biomarker_panels_select_scoped"
  on public.biomarker_panels
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = biomarker_panels.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1
            from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = biomarker_panels.athlete_id
          ))
        )
    )
  );

drop policy if exists "biomarker_panels_insert_scoped" on public.biomarker_panels;
create policy "biomarker_panels_insert_scoped"
  on public.biomarker_panels
  for insert
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = biomarker_panels.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1
            from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = biomarker_panels.athlete_id
          ))
        )
    )
  );

drop policy if exists "biomarker_panels_update_scoped" on public.biomarker_panels;
create policy "biomarker_panels_update_scoped"
  on public.biomarker_panels
  for update
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = biomarker_panels.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1
            from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = biomarker_panels.athlete_id
          ))
        )
    )
  )
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = biomarker_panels.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1
            from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = biomarker_panels.athlete_id
          ))
        )
    )
  );

drop policy if exists "biomarker_panels_delete_scoped" on public.biomarker_panels;
create policy "biomarker_panels_delete_scoped"
  on public.biomarker_panels
  for delete
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = biomarker_panels.athlete_id)
          or
          (aup.role = 'coach' and exists (
            select 1
            from public.coach_athletes ca
            where ca.coach_user_id = auth.uid()
              and ca.athlete_id = biomarker_panels.athlete_id
          ))
        )
    )
  );
