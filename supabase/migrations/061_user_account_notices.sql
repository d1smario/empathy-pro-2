-- Pro 2 — Notifiche account (grant admin, estensioni prova, messaggi piattaforma).

create table if not exists public.user_account_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('grant_created', 'grant_extended', 'trial_reminder', 'platform')),
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_account_notices_user_unread
  on public.user_account_notices (user_id, created_at desc)
  where read_at is null;

alter table public.user_account_notices enable row level security;

drop policy if exists "user_account_notices_select_own" on public.user_account_notices;
create policy "user_account_notices_select_own"
  on public.user_account_notices
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_account_notices_update_own_read" on public.user_account_notices;
create policy "user_account_notices_update_own_read"
  on public.user_account_notices
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_account_notices is
  'Messaggi in-app per l’utente (es. grant ambassador, mesi gratuiti, tester). Insert solo service_role / admin API.';
