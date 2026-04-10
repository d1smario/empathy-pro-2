-- Collega app_user_profiles.athlete_id al profilo atleta con la stessa email dell'utente auth.
-- Email default: m@d1s.ch. Esegui solo se athlete_id è NULL e esiste athlete_profiles per quell'email.

with pick as (
  select
    u.id as uid,
    ap.id as ap_id
  from auth.users u
  join lateral (
    select id
    from athlete_profiles
    where lower(email) = lower(u.email)
    order by updated_at desc nulls last
    limit 1
  ) ap on true
  where lower(u.email) = lower('m@d1s.ch')
)
update app_user_profiles aup
set
  athlete_id = pick.ap_id,
  updated_at = now()
from pick
where aup.user_id = pick.uid
  and aup.athlete_id is null;
