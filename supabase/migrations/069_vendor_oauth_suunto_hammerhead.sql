-- =============================================================================
-- 069 — Estensione `vendor_oauth_links` per OAuth Suunto + Hammerhead (Karoo)
-- =============================================================================
-- Prerequisito: `037_vendor_oauth_links.sql` (+ 040 strava, + 068 polar).
-- Effetto: `vendor` può essere anche `suunto` e `hammerhead` (Karoo).
-- Entrambi OAuth2 Authorization Code con refresh token (come WHOOP):
--   - Suunto: token JWT ~24h; ogni chiamata API richiede anche Ocp-Apim-Subscription-Key (env, non in tabella).
--             `external_user_id` = claim `user` del JWT (username Suunto).
--   - Hammerhead (Karoo): provider reality canonico = `hammerhead`; env/route usano il brand `karoo`.
-- Token solo server (service role), RLS senza policy utente come gli altri vendor.
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'vendor_oauth_links'
  ) then
    raise exception '069_vendor_oauth_suunto_hammerhead: manca la tabella public.vendor_oauth_links. Esegui prima 037_vendor_oauth_links.sql.';
  end if;
end $$;

alter table public.vendor_oauth_links drop constraint if exists vendor_oauth_links_vendor_check;

alter table public.vendor_oauth_links
  add constraint vendor_oauth_links_vendor_check
  check (vendor in ('whoop', 'wahoo', 'strava', 'polar', 'suunto', 'hammerhead'));

comment on table public.vendor_oauth_links is
  'OAuth2 WHOOP / Wahoo / Strava / Polar / Suunto / Hammerhead(Karoo): token solo server (service role), RLS senza policy utente.';
