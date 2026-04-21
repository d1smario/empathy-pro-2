-- Pro 2 — parità schema training / import con V1 (Empathy 3.0 canonical).
--
-- Contesto: le migrazioni Pro 2 in questo repo (000–013) non ricreano le tabelle
-- `planned_workouts`, `executed_workouts`, `training_import_jobs`. Se il progetto
-- Supabase "Empatia-Pro-2.0" è stato bootstrapato solo con quelle, le route
-- `/api/training/import`, `/api/training/import-planned`, `GET planned-window`
-- falliscono o restano vuote senza `SUPABASE_SERVICE_ROLE_KEY` se mancano tabelle
-- o indici attesi dal codice.
--
-- Fonti V1 (nextjs-empathy-pro):
--   • `supabase/migrations/001_empathy_canonical_schema.sql` — planned + executed
--   • `supabase/migrations/016_training_import_jobs.sql`
--   • `supabase/migrations/017_executed_workouts_external_id_unique.sql`
--
-- Prerequisito: `public.athlete_profiles` già esistente (stesso grafo FK V1).

create extension if not exists "uuid-ossp";

-- ========= planned_workouts (V1 001) =========
create table if not exists public.planned_workouts (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  date date not null,
  type text not null,
  duration_minutes int not null,
  tss_target numeric(8, 2) not null,
  kj_target numeric(10, 2),
  kcal_target numeric(10, 2),
  zone_split jsonb,
  adaptive_goal text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_planned_workouts_athlete_date
  on public.planned_workouts (athlete_id, date);

-- ========= executed_workouts (V1 001) =========
create table if not exists public.executed_workouts (
  id uuid primary key default uuid_generate_v4(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  planned_workout_id uuid references public.planned_workouts (id) on delete set null,
  date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes int not null,
  tss numeric(8, 2) not null,
  kj numeric(10, 2),
  kcal numeric(10, 2),
  trace_summary jsonb,
  lactate_mmoll numeric(6, 2),
  glucose_mmol numeric(5, 2),
  smo2 numeric(5, 2),
  subjective_notes text,
  source text default 'manual',
  external_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_executed_workouts_athlete_date
  on public.executed_workouts (athlete_id, date);

-- ========= training_import_jobs (V1 016) =========
create table if not exists public.training_import_jobs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  mode text not null check (mode in ('executed', 'planned')),
  source_format text,
  source_vendor text,
  source_device text,
  parser_engine text,
  parser_version text,
  status text not null check (status in ('pending', 'processing', 'done', 'error')),
  file_name text not null,
  file_size_bytes bigint,
  file_checksum_sha1 text,
  imported_workout_id uuid references public.executed_workouts (id) on delete set null,
  imported_planned_count integer,
  imported_date date,
  quality_status text,
  quality_note text,
  channel_coverage jsonb,
  error_message text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_import_jobs_athlete_created
  on public.training_import_jobs (athlete_id, created_at desc);

create index if not exists idx_training_import_jobs_status
  on public.training_import_jobs (status);

-- ========= dedup + unique partial index (V1 017) =========
with ranked as (
  select
    id,
    row_number() over (
      partition by athlete_id, external_id
      order by created_at desc nulls last, id desc
    ) as rn
  from public.executed_workouts
  where external_id is not null
)
delete from public.executed_workouts e
using ranked r
where e.id = r.id
  and r.rn > 1;

create unique index if not exists idx_executed_workouts_athlete_external_unique
  on public.executed_workouts (athlete_id, external_id)
  where external_id is not null;
