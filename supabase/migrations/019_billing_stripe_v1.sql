-- Parità V1 → Pro 2 (L4.r billing): equivalente a
--   nextjs-empathy-pro/supabase/migrations/024_billing_stripe.sql
-- Clienti Stripe, abbonamenti, idempotenza webhook (scritture sensate via service role nelle route).

create table if not exists public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_customer_id text not null,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  base_plan_id text not null,
  coach_addon_id text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_subscriptions_user on public.billing_subscriptions (user_id);
create index if not exists idx_billing_subscriptions_status on public.billing_subscriptions (status);

create table if not exists public.stripe_webhook_events (
  id text primary key,
  received_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "billing_customers_select_own" on public.billing_customers;
create policy "billing_customers_select_own" on public.billing_customers for select using (auth.uid() = user_id);

drop policy if exists "billing_customers_insert_own" on public.billing_customers;
create policy "billing_customers_insert_own" on public.billing_customers for insert with check (auth.uid() = user_id);

drop policy if exists "billing_customers_update_own" on public.billing_customers;
create policy "billing_customers_update_own" on public.billing_customers
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "billing_subscriptions_select_own" on public.billing_subscriptions;
create policy "billing_subscriptions_select_own" on public.billing_subscriptions for select using (auth.uid() = user_id);
