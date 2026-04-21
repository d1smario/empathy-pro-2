-- Parità V1 → Pro 2 (L4.r health / ops): equivalente a
--   nextjs-empathy-pro/supabase/migrations/014_manual_actions_queue.sql
--   nextjs-empathy-pro/supabase/migrations/015_athlete_update_locks.sql
-- (Nomi V1 `015_*` ≠ Pro 2 `015_read_spine_*`: questa migrazione è solo coda manual actions + lock.)

create table if not exists public.manual_actions (
  id uuid primary key,
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('coach', 'private')),
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected', 'superseded')),
  reason text null,
  created_at timestamptz not null default now(),
  applied_at timestamptz null
);

create index if not exists idx_manual_actions_athlete_created
  on public.manual_actions (athlete_id, created_at desc);

create index if not exists idx_manual_actions_status_created
  on public.manual_actions (status, created_at desc);

alter table public.manual_actions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'manual_actions'
      and policyname = 'manual_actions_select_owner_or_coach'
  ) then
    create policy manual_actions_select_owner_or_coach
      on public.manual_actions
      for select
      using (
        created_by_user_id = auth.uid()
        or exists (
          select 1
          from public.coach_athletes ca
          where ca.coach_user_id = auth.uid()
            and ca.athlete_id = manual_actions.athlete_id
        )
      );
  end if;
end $$;

create table if not exists public.athlete_update_locks (
  id uuid primary key,
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  scope text not null,
  locked_by_user_id uuid not null references auth.users(id) on delete cascade,
  reason text null,
  locked_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index if not exists uq_athlete_update_locks_active_scope
  on public.athlete_update_locks (athlete_id, scope);

create index if not exists idx_athlete_update_locks_expires
  on public.athlete_update_locks (expires_at);

alter table public.athlete_update_locks enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'athlete_update_locks'
      and policyname = 'athlete_update_locks_select_owner_or_coach'
  ) then
    create policy athlete_update_locks_select_owner_or_coach
      on public.athlete_update_locks
      for select
      using (
        locked_by_user_id = auth.uid()
        or exists (
          select 1
          from public.coach_athletes ca
          where ca.coach_user_id = auth.uid()
            and ca.athlete_id = athlete_update_locks.athlete_id
        )
      );
  end if;
end $$;
