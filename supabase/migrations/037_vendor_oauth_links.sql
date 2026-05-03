-- OAuth2 WHOOP / Wahoo (server-side tokens). Parità sicurezza con garmin_athlete_links: solo service role.

create table if not exists public.vendor_oauth_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  vendor text not null check (vendor in ('whoop', 'wahoo')),
  external_user_id text,
  oauth_access_token text,
  oauth_refresh_token text,
  token_expires_at timestamptz,
  scope text,
  constraint vendor_oauth_links_athlete_vendor_unique unique (athlete_id, vendor)
);

create index if not exists idx_vendor_oauth_links_athlete
  on public.vendor_oauth_links (athlete_id);

comment on table public.vendor_oauth_links is 'OAuth2 WHOOP/Wahoo: token solo server (service role), RLS senza policy utente.';

alter table public.vendor_oauth_links enable row level security;
