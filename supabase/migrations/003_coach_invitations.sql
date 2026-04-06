-- Inviti coach → atleta (Pro 2). Leggi/scrive solo il backend con service role (RLS senza policy = blocco client).
-- Prerequisiti: `000_pro2_orgs.sql` e, sullo stesso DB di V1, `002_coach_athletes_org_multitenant.sql`.

create table if not exists public.coach_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  inviting_coach_user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coach_invitations_token on public.coach_invitations (token);
create index if not exists idx_coach_invitations_org on public.coach_invitations (org_id);
create index if not exists idx_coach_invitations_inviting_coach on public.coach_invitations (inviting_coach_user_id);

alter table public.coach_invitations enable row level security;
