-- =============================================================================
-- 068 — Estensione `vendor_oauth_links` per OAuth Polar AccessLink
-- =============================================================================
-- Prerequisito: `037_vendor_oauth_links.sql` (+ `040_vendor_oauth_strava.sql`).
-- Effetto: il valore `vendor` può essere anche `polar` (oltre a whoop, wahoo, strava).
-- Polar AccessLink usa OAuth2 (access token a lunga durata, nessun refresh): i token
-- restano server-side (service role), RLS senza policy utente come gli altri vendor.
-- `external_user_id` = Polar `x_user_id` / `polar-user-id`.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'vendor_oauth_links'
  ) then
    raise exception '068_vendor_oauth_polar: manca la tabella public.vendor_oauth_links. Esegui prima 037_vendor_oauth_links.sql.';
  end if;
end $$;

alter table public.vendor_oauth_links drop constraint if exists vendor_oauth_links_vendor_check;

alter table public.vendor_oauth_links
  add constraint vendor_oauth_links_vendor_check check (vendor in ('whoop', 'wahoo', 'strava', 'polar'));

comment on table public.vendor_oauth_links is
  'OAuth2 WHOOP / Wahoo / Strava / Polar: token solo server (service role), RLS senza policy utente.';
