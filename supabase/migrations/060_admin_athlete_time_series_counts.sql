-- Pro 2 — conteggi campioni time-series (055) per report admin / adozione Bioenergetics.

create or replace function public.admin_athlete_time_series_counts(p_athlete_ids uuid[])
returns table (
  athlete_id uuid,
  time_series_sample_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.aid as athlete_id,
    coalesce((
      select count(*)::bigint
      from public.athlete_time_series_samples t
      where t.athlete_id = s.aid
    ), 0) as time_series_sample_count
  from (select unnest(p_athlete_ids) as aid) s;
$$;

comment on function public.admin_athlete_time_series_counts(uuid[]) is
  'Solo service_role: conteggio righe athlete_time_series_samples per atleta (proxy uso Bioenergetics).';

revoke all on function public.admin_athlete_time_series_counts(uuid[]) from public;
grant execute on function public.admin_athlete_time_series_counts(uuid[]) to service_role;
