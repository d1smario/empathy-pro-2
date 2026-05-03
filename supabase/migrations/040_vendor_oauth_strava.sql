-- Estende vendor_oauth_links per OAuth Strava (stesso modello WHOOP/Wahoo).

alter table public.vendor_oauth_links drop constraint if exists vendor_oauth_links_vendor_check;

alter table public.vendor_oauth_links
  add constraint vendor_oauth_links_vendor_check check (vendor in ('whoop', 'wahoo', 'strava'));

comment on table public.vendor_oauth_links is 'OAuth2 WHOOP / Wahoo / Strava: token solo server (service role), RLS senza policy utente.';
