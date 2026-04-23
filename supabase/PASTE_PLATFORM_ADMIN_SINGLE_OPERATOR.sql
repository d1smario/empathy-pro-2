-- Operatore unico console `/admin`: solo m@d1s.ch con `is_platform_admin`.
-- Esegui in Supabase SQL Editor (progetto production). Idempotente.

update public.app_user_profiles aup
set is_platform_admin = false,
    updated_at = now()
where coalesce(aup.is_platform_admin, false) = true
  and aup.user_id not in (
    select u.id
    from auth.users u
    where lower(u.email) = lower('m@d1s.ch')
  );

update public.app_user_profiles aup
set is_platform_admin = true,
    updated_at = now()
from auth.users u
where u.id = aup.user_id
  and lower(u.email) = lower('m@d1s.ch');

-- Verifica
select u.email, aup.is_platform_admin
from public.app_user_profiles aup
join auth.users u on u.id = aup.user_id
where coalesce(aup.is_platform_admin, false) = true;
