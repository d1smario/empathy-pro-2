-- Paste in Supabase SQL Editor — Pro 2 028 media assets catalog.
-- Safe to rerun: CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + DROP/CREATE policies.
-- Mirrors: supabase/migrations/028_media_assets_catalog_v1.sql

create extension if not exists pgcrypto;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  domain text not null check (domain in ('nutrition', 'training')),
  entity_type text not null check (entity_type in ('meal', 'exercise', 'fueling')),
  entity_key text not null,
  media_kind text not null check (media_kind in ('image', 'video', 'gif')),
  title text null,
  url text not null,
  thumbnail_url text null,
  provider text null,
  tags text[] default '{}'::text[],
  sort_order int not null default 0,
  active boolean not null default true,
  quality_score smallint not null default 50 check (quality_score between 0 and 100),
  verified boolean not null default false,
  deprecated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.media_assets
  add column if not exists quality_score smallint not null default 50 check (quality_score between 0 and 100),
  add column if not exists verified boolean not null default false,
  add column if not exists deprecated boolean not null default false;

create index if not exists idx_media_assets_lookup
  on public.media_assets (domain, entity_type, entity_key, active, sort_order);

create index if not exists idx_media_assets_verified
  on public.media_assets (domain, entity_type, verified, active, deprecated, sort_order);

alter table public.media_assets enable row level security;

drop policy if exists media_assets_select_all on public.media_assets;
create policy media_assets_select_all
  on public.media_assets
  for select
  using (true);

drop policy if exists media_assets_write_auth on public.media_assets;
create policy media_assets_write_auth
  on public.media_assets
  for all
  to authenticated
  using (true)
  with check (true);

