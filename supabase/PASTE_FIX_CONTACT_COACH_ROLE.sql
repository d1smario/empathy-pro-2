-- Diagnostica + fix ruolo coach per contact@d1s.ch (e verifica coach_user_id sui link roster).
-- Nota app (2026-05): il login «Atleta» non deve più azzerare role=coach (fix in resolve-bootstrap-role + use-active-athlete).
-- Esegui in SQL Editor Supabase (service role / postgres). Adatta email se serve.

-- 1) Stato profilo + roster come coach
select
  u.id as user_id,
  u.email,
  p.role,
  p.platform_coach_status,
  p.athlete_id,
  (select count(*) from public.coach_athletes ca where ca.coach_user_id = u.id) as roster_as_coach_count
from auth.users u
left join public.app_user_profiles p on p.user_id = u.id
where lower(u.email) = lower('contact@d1s.ch');

-- 2) Tutti i link roster con email coach e atleta
select
  ca.org_id,
  ca.coach_user_id,
  uc.email as coach_email,
  pc.role as coach_role,
  pc.platform_coach_status,
  ca.athlete_id,
  ap.email as athlete_email,
  ap.first_name,
  ap.last_name
from public.coach_athletes ca
join auth.users uc on uc.id = ca.coach_user_id
left join public.app_user_profiles pc on pc.user_id = ca.coach_user_id
join public.athlete_profiles ap on ap.id = ca.athlete_id
order by uc.email, ap.email;

-- 3) Attiva contact@d1s.ch come coach approvato (console roster + KPI admin)
update public.app_user_profiles p
set
  role = 'coach',
  platform_coach_status = 'approved',
  updated_at = now()
from auth.users u
where p.user_id = u.id
  and lower(u.email) = lower('contact@d1s.ch');

-- 4) Se i link puntano a un altro user_id, riallinea (solo dopo aver verificato il passo 2):
-- update public.coach_athletes ca
-- set coach_user_id = (select id from auth.users where lower(email) = lower('contact@d1s.ch'))
-- where ca.coach_user_id = '<vecchio_uuid_coach>';
