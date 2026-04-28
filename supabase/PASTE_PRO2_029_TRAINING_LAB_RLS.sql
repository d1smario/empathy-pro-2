-- Pro 2 — RLS hardening for training, lab and canonical physiology tables.
--
-- Scope:
--   - planned_workouts
--   - executed_workouts
--   - training_import_jobs
--   - metabolic_lab_runs
--   - physiological_profiles
--
-- Pattern: authenticated private athlete owner or assigned coach.
-- Service-role API routes keep bypassing RLS; these policies make direct authenticated access explicit.

alter table public.planned_workouts enable row level security;
alter table public.executed_workouts enable row level security;
alter table public.training_import_jobs enable row level security;
alter table public.metabolic_lab_runs enable row level security;
alter table public.physiological_profiles enable row level security;

drop policy if exists "planned_workouts_access_scoped" on public.planned_workouts;
create policy "planned_workouts_access_scoped"
  on public.planned_workouts
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = planned_workouts.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = planned_workouts.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = planned_workouts.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = planned_workouts.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "executed_workouts_access_scoped" on public.executed_workouts;
create policy "executed_workouts_access_scoped"
  on public.executed_workouts
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = executed_workouts.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = executed_workouts.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = executed_workouts.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = executed_workouts.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "training_import_jobs_access_scoped" on public.training_import_jobs;
create policy "training_import_jobs_access_scoped"
  on public.training_import_jobs
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = training_import_jobs.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = training_import_jobs.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = training_import_jobs.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = training_import_jobs.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "metabolic_lab_runs_access_scoped" on public.metabolic_lab_runs;
create policy "metabolic_lab_runs_access_scoped"
  on public.metabolic_lab_runs
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = metabolic_lab_runs.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = metabolic_lab_runs.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = metabolic_lab_runs.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = metabolic_lab_runs.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "physiological_profiles_access_scoped" on public.physiological_profiles;
create policy "physiological_profiles_access_scoped"
  on public.physiological_profiles
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = physiological_profiles.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = physiological_profiles.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = physiological_profiles.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = physiological_profiles.athlete_id
            )
          )
        )
    )
  );

