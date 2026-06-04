-- Pro 2 — aggregati lettura-only per console admin (service_role).
-- Evita N+1 query da Next: un solo round-trip RPC su un array di athlete_id.
-- DROP prima di CREATE: su DB condivisi la firma può già essere quella estesa da 059.

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
  biomarker_last_sample_date date
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
    )
  from (select unnest(p_athlete_ids) as aid) s;
$$;

comment on function public.admin_athlete_activity_rollups(uuid[]) is
  'Solo service_role: conteggi e ultime date per training, diario, pianificato, health panels. Usato dalla console /admin.';

revoke all on function public.admin_athlete_activity_rollups(uuid[]) from public;
grant execute on function public.admin_athlete_activity_rollups(uuid[]) to service_role;
