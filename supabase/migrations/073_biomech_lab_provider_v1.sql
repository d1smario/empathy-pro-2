-- Biomech lab provider metadata on capture jobs (OpenCap, SIMI, THEIA3D routing).

alter table public.biomech_capture_jobs
  add column if not exists source text null,
  add column if not exists provider text null,
  add column if not exists external_session_id text null;

create index if not exists idx_biomech_capture_jobs_external_session
  on public.biomech_capture_jobs (athlete_id, external_session_id)
  where external_session_id is not null;

create unique index if not exists idx_biomech_session_imports_athlete_external
  on public.biomech_session_imports (athlete_id, external_session_id)
  where external_session_id is not null;

comment on column public.biomech_capture_jobs.source is 'BiomechanicsCaptureSource contract value.';
comment on column public.biomech_capture_jobs.provider is 'Lab provider registry id: generic_cv, opencap, lab_file, etc.';
