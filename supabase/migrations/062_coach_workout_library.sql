-- Pro 2 — Libreria sedute coach (template Pro2BuilderSessionContract riusabili).
-- Additive: nessuna modifica a planned_workouts / executed_workouts.

create table if not exists public.coach_workout_library_folders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete restrict,
  coach_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_coach_workout_library_folders_coach
  on public.coach_workout_library_folders (coach_user_id, sort_order);

create table if not exists public.coach_workout_library_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete restrict,
  coach_user_id uuid not null references auth.users (id) on delete cascade,
  folder_id uuid references public.coach_workout_library_folders (id) on delete set null,
  title text not null,
  description text not null default '',
  family text not null check (family in ('aerobic', 'strength', 'technical', 'lifestyle')),
  discipline text not null default '',
  sport_tags text[] not null default '{}'::text[],
  duration_minutes integer not null default 0 check (duration_minutes >= 0 and duration_minutes <= 360),
  tss_target integer not null default 0 check (tss_target >= 0 and tss_target <= 999),
  contract_json jsonb not null,
  source_planned_workout_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_coach_workout_library_items_coach_folder
  on public.coach_workout_library_items (coach_user_id, folder_id);

create index if not exists idx_coach_workout_library_items_family_duration
  on public.coach_workout_library_items (coach_user_id, family, duration_minutes, tss_target);

create index if not exists idx_coach_workout_library_items_metadata
  on public.coach_workout_library_items using gin (metadata);

alter table public.coach_workout_library_folders enable row level security;
alter table public.coach_workout_library_items enable row level security;

drop policy if exists "coach_workout_library_folders_own" on public.coach_workout_library_folders;
create policy "coach_workout_library_folders_own"
  on public.coach_workout_library_folders
  for all
  to authenticated
  using (auth.uid() = coach_user_id)
  with check (auth.uid() = coach_user_id);

drop policy if exists "coach_workout_library_items_own" on public.coach_workout_library_items;
create policy "coach_workout_library_items_own"
  on public.coach_workout_library_items
  for all
  to authenticated
  using (auth.uid() = coach_user_id)
  with check (auth.uid() = coach_user_id);

comment on table public.coach_workout_library_folders is
  'Cartelle libreria sedute coach (owner = coach_user_id).';

comment on table public.coach_workout_library_items is
  'Template seduta Pro 2 (contract_json = Pro2BuilderSessionContract v1). Apply → planned_workouts via API.';
