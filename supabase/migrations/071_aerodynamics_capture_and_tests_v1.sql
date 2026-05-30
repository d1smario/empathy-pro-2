-- =============================================================================
-- 071 — Aerodynamics Engine: capture jobs + test sessions + private bucket
-- =============================================================================
-- Primo schema Pro 2 per Aerodynamics reale.
-- AI/CV/3D reconstruction scrive staging e payload versionati; i numeri canonici
-- (CdA, drag, watt/time savings, score) devono essere prodotti dal domain engine.
-- =============================================================================

create table if not exists public.aero_test_sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  schema_version int not null default 1,
  source text not null check (source in ('smartphone_video', 'gopro_video', 'image', 'manual_test', 'external_aero_import')),
  recorded_at timestamptz not null,
  external_session_id text null,
  position jsonb not null default '{}'::jsonb,
  equipment jsonb not null default '{}'::jsonb,
  geometry jsonb null,
  cda_estimate jsonb not null,
  optimization jsonb null,
  scores jsonb null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_aero_test_sessions_athlete_recorded
  on public.aero_test_sessions (athlete_id, recorded_at desc);

create index if not exists idx_aero_test_sessions_source
  on public.aero_test_sessions (source);

comment on table public.aero_test_sessions is
  'AerodynamicsTestSessionV1 persistito: posizione/equipment/geometry/CdA da test validato, non da UI locale.';

create table if not exists public.aero_capture_jobs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  source text not null default 'smartphone_video'
    check (source in ('smartphone_video', 'gopro_video', 'image', 'manual_test', 'external_aero_import')),
  camera_mode text null check (
    camera_mode is null
    or camera_mode in ('side', 'front', 'rear', 'multi_view', 'three_sixty', 'unknown')
  ),
  media_storage_path text null,
  media_content_type text null,
  error_message text null,
  result_test_session_id uuid null references public.aero_test_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_aero_capture_jobs_athlete_created
  on public.aero_capture_jobs (athlete_id, created_at desc);

create index if not exists idx_aero_capture_jobs_status
  on public.aero_capture_jobs (status) where status in ('pending', 'processing');

comment on table public.aero_capture_jobs is
  'Job cattura Aerodynamics; worker/CV aggiorna status e collega eventuale aero_test_session validata.';

alter table public.aero_test_sessions enable row level security;
alter table public.aero_capture_jobs enable row level security;

drop policy if exists aero_test_sessions_select_own on public.aero_test_sessions;
create policy aero_test_sessions_select_own
  on public.aero_test_sessions for select
  to authenticated
  using (
    athlete_id in (
      select athlete_id from public.app_user_profiles
      where user_id = auth.uid() and athlete_id is not null
    )
  );

drop policy if exists aero_capture_jobs_select_own on public.aero_capture_jobs;
create policy aero_capture_jobs_select_own
  on public.aero_capture_jobs for select
  to authenticated
  using (
    athlete_id in (
      select athlete_id from public.app_user_profiles
      where user_id = auth.uid() and athlete_id is not null
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aero-capture',
  'aero-capture',
  false,
  524288000,
  array['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
