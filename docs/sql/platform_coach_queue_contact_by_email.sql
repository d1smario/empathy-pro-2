-- Mette un account in coda "richiesta coach" (ruolo coach + platform_coach_status pending).
-- Esegui in Supabase → SQL Editor. Sostituisci l'email se serve.
--
-- Vincolo trigger `024_platform_coach_status_and_admin.sql`: senza JWT service_role,
-- l'UPDATE è consentito se in un solo statement passi da role private a coach con pending.
-- Per altre modifiche (es. approved → pending) usa la console /admin (API service role).

-- 1) Verifica stato attuale
select u.id as user_id,
       u.email,
       u.created_at,
       aup.role,
       aup.platform_coach_status,
       aup.is_platform_admin
from auth.users u
left join public.app_user_profiles aup on aup.user_id = u.id
where lower(u.email) = lower('contact@d1s.ch');

-- 2a) Caso tipico: account ancora "private" → diventa coach in attesa di approvazione
update public.app_user_profiles aup
set role = 'coach',
    platform_coach_status = 'pending'
from auth.users u
where u.id = aup.user_id
  and lower(u.email) = lower('contact@d1s.ch')
  and aup.role = 'private';

-- 2b) Se la riga profilo non esiste (raro se non ha mai aperto l'app dopo signup), creala dopo
-- aver creato athlete_id se richiesto dal vostro flusso — meglio far fare un login + ensure-profile.
