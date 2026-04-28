-- Paste in Supabase SQL Editor — Pro 2 027 nutrition plan compatibility.
-- Safe to rerun: CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + DROP/CREATE policies.
-- Mirrors: supabase/migrations/027_v1_nutrition_plan_compat.sql

create extension if not exists "uuid-ossp";

create table if not exists public.nutrition_constraints (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade unique,
  diet_type text,
  intolerances text[],
  allergies text[],
  excluded_foods text[],
  excluded_supplements text[],
  preferred_foods text[],
  preferred_meal_count int,
  timing_constraints text[],
  updated_at timestamptz default now()
);

alter table public.nutrition_constraints
  add column if not exists diet_type text,
  add column if not exists intolerances text[],
  add column if not exists allergies text[],
  add column if not exists excluded_foods text[],
  add column if not exists excluded_supplements text[],
  add column if not exists preferred_foods text[],
  add column if not exists preferred_meal_count int,
  add column if not exists timing_constraints text[],
  add column if not exists updated_at timestamptz default now();

create unique index if not exists idx_nutrition_constraints_athlete_unique
  on public.nutrition_constraints (athlete_id);

alter table public.nutrition_constraints enable row level security;

drop policy if exists "nutrition_constraints_select_scoped" on public.nutrition_constraints;
create policy "nutrition_constraints_select_scoped"
  on public.nutrition_constraints
  for select
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
  );

create table if not exists public.nutrition_plans (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  from_date date not null,
  to_date date,
  date date,
  goal text,
  constraints_snapshot jsonb,
  kcal_target numeric(10, 2),
  carbs_g_target numeric(10, 2),
  proteins_g_target numeric(10, 2),
  fats_g_target numeric(10, 2),
  hydration_ml_target numeric(10, 2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.nutrition_plans
  add column if not exists from_date date,
  add column if not exists to_date date,
  add column if not exists date date,
  add column if not exists goal text,
  add column if not exists constraints_snapshot jsonb,
  add column if not exists kcal_target numeric(10, 2),
  add column if not exists carbs_g_target numeric(10, 2),
  add column if not exists proteins_g_target numeric(10, 2),
  add column if not exists fats_g_target numeric(10, 2),
  add column if not exists hydration_ml_target numeric(10, 2),
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.nutrition_plans
set date = coalesce(date, from_date)
where date is null
  and from_date is not null;

create index if not exists idx_nutrition_plans_athlete_from_date
  on public.nutrition_plans (athlete_id, from_date desc);

create index if not exists idx_nutrition_plans_athlete_date
  on public.nutrition_plans (athlete_id, date desc);

alter table public.nutrition_plans enable row level security;

drop policy if exists "nutrition_plans_select_scoped" on public.nutrition_plans;
create policy "nutrition_plans_select_scoped"
  on public.nutrition_plans
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = nutrition_plans.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = nutrition_plans.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "nutrition_plans_write_scoped" on public.nutrition_plans;
create policy "nutrition_plans_write_scoped"
  on public.nutrition_plans
  for all
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = nutrition_plans.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = nutrition_plans.athlete_id
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
          (aup.role = 'private' and aup.athlete_id = nutrition_plans.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = nutrition_plans.athlete_id
            )
          )
        )
    )
  );

create table if not exists public.meals (
  id uuid primary key default uuid_generate_v4(),
  nutrition_plan_id uuid not null references public.nutrition_plans (id) on delete cascade,
  date date not null,
  time time,
  type text not null,
  carbs_g numeric(8, 2),
  protein_g numeric(8, 2),
  fat_g numeric(8, 2),
  kcal numeric(8, 2),
  foods jsonb,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_meals_plan_date
  on public.meals (nutrition_plan_id, date);

alter table public.meals enable row level security;

drop policy if exists "meals_select_scoped" on public.meals;
create policy "meals_select_scoped"
  on public.meals
  for select
  using (
    exists (
      select 1
      from public.nutrition_plans np
      join public.app_user_profiles aup on aup.user_id = auth.uid()
      where np.id = meals.nutrition_plan_id
        and (
          (aup.role = 'private' and aup.athlete_id = np.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = np.athlete_id
            )
          )
        )
    )
  );
