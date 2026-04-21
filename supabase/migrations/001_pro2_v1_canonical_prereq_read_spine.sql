-- Pro 2 — prerequisito **canonico V1** prima di `002_coach_athletes_org_multitenant.sql`.
--
-- Problema risolto: `002` faceva ALTER su `coach_athletes` senza che il repo Pro 2 creasse mai
-- la tabella (in V1 nasce da `004_auth_user_context.sql`). Inoltre `005_device_sync_exports_provider_ecosystem.sql`
-- altera `device_sync_exports`, che in V1 è creata da `009_device_sync_exports.sql` — deve esistere prima del file `005`.
--
-- Fonti V1 (`nextjs-empathy-pro/supabase/migrations/`):
--   • `001_empathy_canonical_schema.sql` — estratti: athlete_profiles, connected_devices, physiological_profiles, biomarker_panels
--   • `004_auth_user_context.sql` — app_user_profiles, coach_athletes, RLS
--   • `009_device_sync_exports.sql` — tabella + RLS (check provider stretto; `005` Pro 2 allarga i provider)
--
-- Idempotente: `CREATE TABLE IF NOT EXISTS`, policy `DROP IF EXISTS` + `CREATE`.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ========= athlete_profiles (V1 001) =========
create table if not exists public.athlete_profiles (
  id uuid primary key default uuid_generate_v4(),
  first_name text,
  last_name text,
  email text,
  birth_date date,
  sex text check (sex in ('male', 'female', 'other')),
  timezone text,
  activity_level text,
  height_cm numeric(5, 2),
  weight_kg numeric(5, 2),
  body_fat_pct numeric(5, 2),
  muscle_mass_kg numeric(6, 2),
  resting_hr_bpm int,
  max_hr_bpm int,
  threshold_hr_bpm int,
  goals text[],
  diet_type text,
  intolerances text[],
  allergies text[],
  food_preferences text[],
  food_exclusions text[],
  supplements text[],
  preferred_meal_count int,
  routine_summary text,
  routine_config jsonb,
  nutrition_config jsonb,
  supplement_config jsonb,
  training_days_per_week int,
  training_max_session_minutes int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========= connected_devices (V1 001) =========
create table if not exists public.connected_devices (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  provider text not null,
  external_id text,
  last_sync_at timestamptz,
  enabled boolean default true,
  created_at timestamptz default now()
);

-- ========= physiological_profiles (V1 001) =========
create table if not exists public.physiological_profiles (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  ftp_watts numeric(8, 2),
  cp_watts numeric(8, 2),
  lt1_watts numeric(8, 2),
  lt1_heart_rate int,
  lt2_watts numeric(8, 2),
  lt2_heart_rate int,
  v_lamax numeric(10, 4),
  vo2max_ml_min_kg numeric(8, 2),
  economy numeric(10, 4),
  baseline_hrv_ms numeric(10, 2),
  baseline_hrv_std numeric(10, 2),
  baseline_temp_c numeric(4, 2),
  baseline_glucose_mmol numeric(5, 2),
  valid_from date,
  valid_to date,
  updated_at timestamptz default now(),
  unique (athlete_id)
);

-- ========= biomarker_panels (V1 001) =========
create table if not exists public.biomarker_panels (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  type text not null,
  sample_date date,
  reported_at timestamptz,
  values jsonb not null,
  flags text[],
  source text,
  attachment_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========= auth contest (V1 004) =========
create table if not exists public.app_user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('private', 'coach')),
  athlete_id uuid null references public.athlete_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_athletes (
  coach_user_id uuid not null references auth.users (id) on delete cascade,
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coach_user_id, athlete_id)
);

create index if not exists idx_app_user_profiles_role on public.app_user_profiles (role);
create index if not exists idx_app_user_profiles_athlete on public.app_user_profiles (athlete_id);
create index if not exists idx_coach_athletes_athlete on public.coach_athletes (athlete_id);

alter table public.app_user_profiles enable row level security;
alter table public.coach_athletes enable row level security;

drop policy if exists "app_user_profiles_select_own" on public.app_user_profiles;
create policy "app_user_profiles_select_own" on public.app_user_profiles for select using (auth.uid() = user_id);

drop policy if exists "app_user_profiles_insert_own" on public.app_user_profiles;
create policy "app_user_profiles_insert_own" on public.app_user_profiles for insert with check (auth.uid() = user_id);

drop policy if exists "app_user_profiles_update_own" on public.app_user_profiles;
create policy "app_user_profiles_update_own"
  on public.app_user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "coach_athletes_select_own" on public.coach_athletes;
create policy "coach_athletes_select_own" on public.coach_athletes for select using (auth.uid() = coach_user_id);

drop policy if exists "coach_athletes_insert_own" on public.coach_athletes;
create policy "coach_athletes_insert_own" on public.coach_athletes for insert with check (auth.uid() = coach_user_id);

drop policy if exists "coach_athletes_delete_own" on public.coach_athletes;
create policy "coach_athletes_delete_own" on public.coach_athletes for delete using (auth.uid() = coach_user_id);

-- ========= device_sync_exports (V1 009) — obbligatoria prima di migration Pro 2 `005_*` =========
create table if not exists public.device_sync_exports (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  provider text not null check (provider in ('garmin_connectiq', 'wahoo', 'coros', 'polar', 'other')),
  payload jsonb not null,
  status text not null default 'created' check (status in ('created', 'sent', 'failed')),
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_device_sync_exports_athlete_provider
  on public.device_sync_exports (athlete_id, provider, created_at desc);

alter table public.device_sync_exports enable row level security;

drop policy if exists "device_sync_exports_select_scoped" on public.device_sync_exports;
create policy "device_sync_exports_select_scoped"
  on public.device_sync_exports
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = device_sync_exports.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = device_sync_exports.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "device_sync_exports_insert_scoped" on public.device_sync_exports;
create policy "device_sync_exports_insert_scoped"
  on public.device_sync_exports
  for insert
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = device_sync_exports.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = device_sync_exports.athlete_id
            )
          )
        )
    )
  );
