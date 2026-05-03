-- =============================================================================
-- 040 — Estensione `vendor_oauth_links` per OAuth Strava
-- =============================================================================
-- Prerequisito: `037_vendor_oauth_links.sql` (tabella `public.vendor_oauth_links`).
-- Effetto: il valore `vendor` può essere anche `strava` (oltre a `whoop`, `wahoo`).
-- Dopo l’esecuzione su Supabase, se PostgREST mostra ancora "schema cache",
-- attendere ~1 min o da Dashboard: Settings → API → Reload schema (se disponibile).
-- =============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'vendor_oauth_links'
  ) then
    raise exception '040_vendor_oauth_strava: manca la tabella public.vendor_oauth_links. Esegui prima 037_vendor_oauth_links.sql.';
  end if;
end $$;

alter table public.vendor_oauth_links drop constraint if exists vendor_oauth_links_vendor_check;

alter table public.vendor_oauth_links
  add constraint vendor_oauth_links_vendor_check check (vendor in ('whoop', 'wahoo', 'strava'));

comment on table public.vendor_oauth_links is
  'OAuth2 WHOOP / Wahoo / Strava: token solo server (service role), RLS senza policy utente.';
