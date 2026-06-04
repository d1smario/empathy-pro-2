select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('athlete_profiles', 'load_series', 'twin_states')
order by c.relname;
