-- Parità V1 → Pro 2 (L4.r nutrition): equivalente a
--   nextjs-empathy-pro/supabase/migrations/007_nutrition_product_catalog.sql
--   nextjs-empathy-pro/supabase/migrations/008_nutrition_product_catalog_write_policy.sql
--   nextjs-empathy-pro/supabase/migrations/021_food_diary_entries.sql
-- Contratto pipeline: docs/NUTRITION_FOOD_DIARY_USDA_PIPELINE.md (mirror V1).

-- 007 — catalogo prodotti (condiviso fueling / integrazione USDA ecc.)
create table if not exists nutrition_product_catalog (
  id uuid primary key default uuid_generate_v4(),
  source text not null check (source in ('internal', 'openfoodfacts', 'usda', 'brand-site')),
  brand text,
  product_name text not null,
  category text,
  serving_size_g numeric(8,2),
  kcal_100g numeric(8,2),
  cho_100g numeric(8,2),
  protein_100g numeric(8,2),
  fat_100g numeric(8,2),
  sodium_mg_100g numeric(10,2),
  micronutrients jsonb,
  ingredients jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nutrition_product_catalog_name
  on nutrition_product_catalog using gin (to_tsvector('simple', coalesce(product_name, '') || ' ' || coalesce(brand, '')));

create index if not exists idx_nutrition_product_catalog_source
  on nutrition_product_catalog(source);

alter table nutrition_product_catalog enable row level security;

drop policy if exists "nutrition_product_catalog_read_auth" on nutrition_product_catalog;
create policy "nutrition_product_catalog_read_auth"
  on nutrition_product_catalog
  for select
  using (auth.role() = 'authenticated');

-- 008 — write policy catalogo
drop policy if exists "nutrition_product_catalog_insert_auth" on nutrition_product_catalog;
create policy "nutrition_product_catalog_insert_auth"
  on nutrition_product_catalog
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "nutrition_product_catalog_update_auth" on nutrition_product_catalog;
create policy "nutrition_product_catalog_update_auth"
  on nutrition_product_catalog
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 021 — diario alimentare (USDA FDC + riferimenti scalati)
create table if not exists public.food_diary_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles(id) on delete cascade,
  entry_date date not null,
  entry_time time without time zone,
  meal_slot text not null default 'other'
    check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  provenance text not null
    check (provenance in ('usda_fdc', 'scaled_reference')),
  fdc_id bigint,
  food_label text not null,
  quantity_g numeric(12, 3) not null check (quantity_g > 0),
  kcal numeric(12, 2) not null check (kcal >= 0),
  carbs_g numeric(12, 2) not null check (carbs_g >= 0),
  protein_g numeric(12, 2) not null check (protein_g >= 0),
  fat_g numeric(12, 2) not null check (fat_g >= 0),
  sodium_mg numeric(12, 2),
  micronutrients jsonb not null default '{}'::jsonb,
  reference_source_tag text,
  notes text,
  supplements text,
  user_confirmed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_diary_fdc_check check (
    (provenance = 'usda_fdc' and fdc_id is not null)
    or (provenance = 'scaled_reference')
  )
);

create index if not exists idx_food_diary_entries_athlete_date
  on public.food_diary_entries(athlete_id, entry_date desc);

create index if not exists idx_food_diary_entries_created
  on public.food_diary_entries(athlete_id, created_at desc);

alter table public.food_diary_entries enable row level security;

drop policy if exists "food_diary_entries_select_scoped" on public.food_diary_entries;
create policy "food_diary_entries_select_scoped"
  on public.food_diary_entries
  for select
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = food_diary_entries.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1 from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = food_diary_entries.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "food_diary_entries_insert_scoped" on public.food_diary_entries;
create policy "food_diary_entries_insert_scoped"
  on public.food_diary_entries
  for insert
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = food_diary_entries.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1 from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = food_diary_entries.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "food_diary_entries_update_scoped" on public.food_diary_entries;
create policy "food_diary_entries_update_scoped"
  on public.food_diary_entries
  for update
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = food_diary_entries.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1 from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = food_diary_entries.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "food_diary_entries_delete_scoped" on public.food_diary_entries;
create policy "food_diary_entries_delete_scoped"
  on public.food_diary_entries
  for delete
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = food_diary_entries.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1 from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = food_diary_entries.athlete_id
            )
          )
        )
    )
  );
