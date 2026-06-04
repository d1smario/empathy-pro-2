-- Tabelle public senza RLS + conteggio policy (Supabase Security Advisor).
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  (
    select count(*)::int
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = c.relname
  ) as policy_count,
  obj_description(c.oid, 'pg_class') as table_comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
order by c.relname;
