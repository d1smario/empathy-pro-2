-- Pro 2 — nutrition adherence opt-in toggle (planned vs logged in adaptation dials)
alter table public.nutrition_constraints
  add column if not exists adaptation_adherence_opt_in boolean not null default false;

drop policy if exists "nutrition_constraints_write_scoped" on public.nutrition_constraints;
create policy "nutrition_constraints_write_scoped"
  on public.nutrition_constraints
  for all
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = nutrition_constraints.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = nutrition_constraints.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = nutrition_constraints.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = nutrition_constraints.athlete_id
            )
          )
        )
    )
  );
