-- Pro 2 — 056: Seed grant 'beta' 12 mesi per gli utenti già esistenti.
--
-- Razionale: l'enforcement del paywall (gate server-side che blocca
-- l'accesso ai moduli prodotto se manca subscription/grant) verrà attivato
-- via env flag `EMPATHY_PAYWALL_ENFORCED=true`. Senza questa migration, al
-- momento dell'attivazione TUTTI gli utenti correnti sarebbero bloccati e
-- mandati a /pricing — anche athleti già operativi che usano la beta privata.
--
-- Soluzione: assegnare un grant 'beta' di 12 mesi a ogni `auth.users` che:
--   - non è platform admin (admin ha override interno),
--   - non ha già una billing_subscription attiva (paid),
--   - non ha già un grant attivo (idempotenza),
--   - non ha l'email del seed admin canonico.
--
-- Il grant è revocabile in qualsiasi momento dalla console admin.
-- granted_by_email = 'system:migration_056' permette di filtrarli in futuro.
--
-- Idempotente: ri-eseguibile senza creare duplicati.

insert into public.subscription_grants (
  user_id, kind, starts_at, ends_at, note, granted_by_email
)
select
  u.id,
  'beta'::text,
  now(),
  now() + interval '12 months',
  'Auto-grant migration 056 (utenti pre-paywall).',
  'system:migration_056'
from auth.users u
left join public.app_user_profiles aup on aup.user_id = u.id
where coalesce(aup.is_platform_admin, false) = false
  and not exists (
    select 1 from public.billing_subscriptions bs
    where bs.user_id = u.id
      and bs.status in ('active', 'trialing')
  )
  and not exists (
    select 1 from public.subscription_grants sg
    where sg.user_id = u.id
      and sg.revoked_at is null
      and sg.ends_at > now()
  );

comment on table public.subscription_grants is
  'Accessi gratuiti concessi dal platform admin. Auto-popolata in 056 con grant beta 12m per utenti pre-paywall.';
