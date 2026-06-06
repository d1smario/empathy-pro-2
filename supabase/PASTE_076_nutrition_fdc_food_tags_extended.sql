-- Paste helper: Nutrition V2 — colonne diet_exclude + meal_role (migration 076)
-- Esegui in Supabase SQL Editor DOPO 075_nutrition_fdc_food_tags.sql

alter table public.nutrition_fdc_food_tags
  add column if not exists diet_exclude text[] not null default '{}'::text[],
  add column if not exists meal_role text[] not null default '{}'::text[];

create index if not exists idx_nutrition_fdc_food_tags_diet_exclude
  on public.nutrition_fdc_food_tags using gin (diet_exclude);

create index if not exists idx_nutrition_fdc_food_tags_meal_role
  on public.nutrition_fdc_food_tags using gin (meal_role);

create index if not exists idx_nutrition_fdc_food_tags_food_family
  on public.nutrition_fdc_food_tags using gin (food_family);

create index if not exists idx_nutrition_fdc_food_tags_nutrient_density
  on public.nutrition_fdc_food_tags using gin (nutrient_density);

-- Verifica
select count(*) as tag_rows from public.nutrition_fdc_food_tags;
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'nutrition_fdc_food_tags'
  and column_name in ('diet_exclude', 'meal_role');
