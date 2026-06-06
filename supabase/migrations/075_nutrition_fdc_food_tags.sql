-- Nutrition V2 — tassonomia multi-asse per selezione efficiente da catalogo USDA.
-- Assi: meal_course, food_family, macro_dominant, slot_fit, diet_profile, amino_profile, nutrient_density.

create table if not exists public.nutrition_fdc_food_tags (
  fdc_id bigint primary key references public.nutrition_fdc_foods (fdc_id) on delete cascade,
  meal_course text[] not null default '{}'::text[],
  food_family text[] not null default '{}'::text[],
  macro_dominant text[] not null default '{}'::text[],
  slot_fit text[] not null default '{}'::text[],
  diet_profile text[] not null default '{}'::text[],
  amino_profile text[] not null default '{}'::text[],
  nutrient_density text[] not null default '{}'::text[],
  classifier_version text not null default 'empathy_v2_rules_v1',
  classified_at timestamptz not null default now()
);

create index if not exists idx_nutrition_fdc_food_tags_diet_profile
  on public.nutrition_fdc_food_tags using gin (diet_profile);

create index if not exists idx_nutrition_fdc_food_tags_slot_fit
  on public.nutrition_fdc_food_tags using gin (slot_fit);

create index if not exists idx_nutrition_fdc_food_tags_meal_course
  on public.nutrition_fdc_food_tags using gin (meal_course);

create index if not exists idx_nutrition_fdc_food_tags_amino_profile
  on public.nutrition_fdc_food_tags using gin (amino_profile);

alter table public.nutrition_fdc_food_tags enable row level security;

drop policy if exists "nutrition_fdc_food_tags_read_auth" on public.nutrition_fdc_food_tags;
create policy "nutrition_fdc_food_tags_read_auth"
  on public.nutrition_fdc_food_tags
  for select
  using (auth.role() = 'authenticated');

comment on table public.nutrition_fdc_food_tags is
  'Tassonomia Empathy V2 per nutrition_fdc_foods: corsi pasto, famiglia, macro, slot, profilo dieta (mediterranean/vegan/celiac/…), profili aminoacidi (glutamine/leucine/histamine), densità micronutrienti.';
