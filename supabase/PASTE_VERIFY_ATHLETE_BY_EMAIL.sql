-- Verifica collegamento utente ↔ atleta (dopo seed o se Pro 2 non mostra dati).
-- Modifica l'email se serve. Esegui in Supabase SQL Editor.

select
  u.id as auth_user_id,
  u.email as auth_email,
  aup.role,
  aup.athlete_id as app_user_athlete_id,
  ap.id as profile_id_if_matched,
  ap.first_name,
  ap.last_name,
  ap.email as athlete_profile_email,
  (select count(*)::int from planned_workouts pw where pw.athlete_id = aup.athlete_id) as planned_count,
  (select count(*)::int from executed_workouts ew where ew.athlete_id = aup.athlete_id) as executed_count
from auth.users u
left join app_user_profiles aup on aup.user_id = u.id
left join athlete_profiles ap on ap.id = aup.athlete_id
where lower(u.email) = lower('m@d1s.ch');

-- Se athlete_id è NULL ma esiste una riga in athlete_profiles con la stessa email, vedi PASTE_LINK_APP_USER_ATHLETE.sql
