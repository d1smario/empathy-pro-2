-- Parità V1 → Pro 2 (L4.r biomech): equivalente a
--   nextjs-empathy-pro/supabase/migrations/022_biomech_remote_capture.sql
-- Import sessione + coda job cattura (allineato a lib/biomechanics/import-contract-v1 in V1).

create table if not exists public.biomech_session_imports (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  schema_version int not null default 1,
  source text not null,
  recorded_at timestamptz not null,
  external_session_id text null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_biomech_session_imports_athlete_recorded
  on public.biomech_session_imports (athlete_id, recorded_at desc);

create index if not exists idx_biomech_session_imports_source
  on public.biomech_session_imports (source);

comment on table public.biomech_session_imports is 'BiomechSessionImportV1 persistito (pose manuale, Kinovea, remote_pose_* futuro).';

create table if not exists public.biomech_capture_jobs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  modality text null check (modality is null or modality in ('gym', 'running', 'cycling', 'field_sport', 'other')),
  stated_exercise_id text null,
  camera_plane text null check (
    camera_plane is null
    or camera_plane in ('sagittal', 'frontal', 'oblique', 'multiview', 'unknown')
  ),
  media_storage_path text null,
  media_content_type text null,
  error_message text null,
  result_import_id uuid null references public.biomech_session_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_biomech_capture_jobs_athlete_created
  on public.biomech_capture_jobs (athlete_id, created_at desc);

create index if not exists idx_biomech_capture_jobs_status
  on public.biomech_capture_jobs (status) where status in ('pending', 'processing');

comment on table public.biomech_capture_jobs is 'Job cattura remota; worker aggiorna status e opzionalmente result_import_id.';

alter table public.biomech_session_imports enable row level security;
alter table public.biomech_capture_jobs enable row level security;

drop policy if exists biomech_session_imports_select_own on public.biomech_session_imports;
create policy biomech_session_imports_select_own
  on public.biomech_session_imports for select
  to authenticated
  using (
    athlete_id in (
      select athlete_id from public.app_user_profiles
      where user_id = auth.uid() and athlete_id is not null
    )
  );

drop policy if exists biomech_capture_jobs_select_own on public.biomech_capture_jobs;
create policy biomech_capture_jobs_select_own
  on public.biomech_capture_jobs for select
  to authenticated
  using (
    athlete_id in (
      select athlete_id from public.app_user_profiles
      where user_id = auth.uid() and athlete_id is not null
    )
  );
