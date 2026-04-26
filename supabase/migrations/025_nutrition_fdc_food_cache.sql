-- Pro 2 nutrition — canonical USDA FoodData Central cache.
-- Keeps USDA whole-food facts separate from branded/product catalog entries.

create table if not exists public.nutrition_fdc_foods (
  fdc_id bigint primary key,
  description text not null,
  data_type text,
  publication_date text,
  food_category text,
  kcal_100g numeric(12, 4) not null default 0 check (kcal_100g >= 0),
  carbs_100g numeric(12, 4) not null default 0 check (carbs_100g >= 0),
  protein_100g numeric(12, 4) not null default 0 check (protein_100g >= 0),
  fat_100g numeric(12, 4) not null default 0 check (fat_100g >= 0),
  fiber_100g numeric(12, 4),
  sugars_100g numeric(12, 4),
  sodium_mg_100g numeric(12, 4),
  vitamins jsonb not null default '[]'::jsonb,
  minerals jsonb not null default '[]'::jsonb,
  amino_acids jsonb not null default '[]'::jsonb,
  fatty_acids jsonb not null default '[]'::jsonb,
  other_nutrients jsonb not null default '[]'::jsonb,
  nutrients_raw jsonb not null default '[]'::jsonb,
  source_payload jsonb,
  imported_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

create index if not exists idx_nutrition_fdc_foods_description
  on public.nutrition_fdc_foods using gin (to_tsvector('simple', coalesce(description, '')));

create index if not exists idx_nutrition_fdc_foods_data_type
  on public.nutrition_fdc_foods (data_type);

alter table public.nutrition_fdc_foods enable row level security;

drop policy if exists "nutrition_fdc_foods_read_auth" on public.nutrition_fdc_foods;
create policy "nutrition_fdc_foods_read_auth"
  on public.nutrition_fdc_foods
  for select
  using (auth.role() = 'authenticated');

comment on table public.nutrition_fdc_foods is
  'Canonical local cache for USDA FoodData Central foods. Imported once by server routes, then reused by diary and meal plan without live USDA reads.';
