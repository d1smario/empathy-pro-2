-- Pro 2 — estende `admin_athlete_activity_rollups` con metriche ingest / integrazioni (solo lettura).
-- PG non consente CREATE OR REPLACE con cambio tipo di ritorno: DROP + CREATE.

drop function if exists public.admin_athlete_activity_rollups(uuid[]);

create function public.admin_athlete_activity_rollups(p_athlete_ids uuid[])
returns table (
  athlete_id uuid,
  executed_workouts_count bigint,
  executed_last_date date,
  planned_workouts_count bigint,
  planned_last_date date,
  food_diary_entries_count bigint,
  food_diary_last_entry_date date,
  biomarker_panels_count bigint,
  biomarker_last_sample_date date,
  device_sync_exports_count bigint,
  device_sync_last_at timestamptz,
  garmin_pull_jobs_total bigint,
  garmin_pull_jobs_completed bigint,
  garmin_pull_jobs_failed bigint,
  garmin_pull_jobs_last_at timestamptz,
  garmin_athlete_linked boolean,
  garmin_activity_blobs_count bigint,
  garmin_activity_blobs_last_at timestamptz,
  interpretation_staging_runs_count bigint,
  interpretation_staging_last_at timestamptz,
  training_import_jobs_count bigint,
  training_import_jobs_last_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.aid as athlete_id,
    coalesce((
      select count(*)::bigint from public.executed_workouts ew where ew.athlete_id = s.aid
    ), 0),
    (
      select max(ew.date)::date from public.executed_workouts ew where ew.athlete_id = s.aid
    ),
    coalesce((
      select count(*)::bigint from public.planned_workouts pw where pw.athlete_id = s.aid
    ), 0),
    (
      select max(pw.date)::date from public.planned_workouts pw where pw.athlete_id = s.aid
    ),
    coalesce((
      select count(*)::bigint from public.food_diary_entries f where f.athlete_id = s.aid
    ), 0),
    (
      select max(f.entry_date)::date from public.food_diary_entries f where f.athlete_id = s.aid
    ),
    coalesce((
      select count(*)::bigint from public.biomarker_panels b where b.athlete_id = s.aid
    ), 0),
    (
      select max(b.sample_date)::date from public.biomarker_panels b where b.athlete_id = s.aid
    ),
    coalesce((
      select count(*)::bigint from public.device_sync_exports d where d.athlete_id = s.aid
    ), 0),
    (
      select max(d.created_at) from public.device_sync_exports d where d.athlete_id = s.aid
    ),
    coalesce((
      select count(*)::bigint from public.garmin_pull_jobs g where g.athlete_id = s.aid
    ), 0),
    coalesce((
      select count(*)::bigint from public.garmin_pull_jobs g where g.athlete_id = s.aid and g.status = 'completed'
    ), 0),
    coalesce((
      select count(*)::bigint from public.garmin_pull_jobs g where g.athlete_id = s.aid and g.status = 'failed'
    ), 0),
    (
      select max(g.created_at) from public.garmin_pull_jobs g where g.athlete_id = s.aid
    ),
    exists (
      select 1 from public.garmin_athlete_links gal where gal.athlete_id = s.aid
    ),
    coalesce((
      select count(*)::bigint from public.garmin_pull_binary_objects gbo where gbo.athlete_id = s.aid
    ), 0),
    (
      select max(gbo.created_at) from public.garmin_pull_binary_objects gbo where gbo.athlete_id = s.aid
    ),
    coalesce((
      select count(*)::bigint from public.interpretation_staging_runs isr where isr.athlete_id = s.aid
    ), 0),
    (
      select max(isr.created_at) from public.interpretation_staging_runs isr where isr.athlete_id = s.aid
    ),
    coalesce((
      select count(*)::bigint from public.training_import_jobs tij where tij.athlete_id = s.aid
    ), 0),
    (
      select max(tij.created_at) from public.training_import_jobs tij where tij.athlete_id = s.aid
    )
  from (select unnest(p_athlete_ids) as aid) s;
$$;

comment on function public.admin_athlete_activity_rollups(uuid[]) is
  'Solo service_role: aggregati atleta per console admin / statistiche (training, diario, health, device sync, Garmin pull, staging, import).';

revoke all on function public.admin_athlete_activity_rollups(uuid[]) from public;
grant execute on function public.admin_athlete_activity_rollups(uuid[]) to service_role;
