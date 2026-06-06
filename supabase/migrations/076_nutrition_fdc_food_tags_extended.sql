-- Nutrition V2 — estensione tassonomia USDA: esclusioni dieta + ruolo menu.
-- Applica DOPO 075_nutrition_fdc_food_tags.sql
-- diet_exclude: tag per funnel (celiaco esclude gluten; vegano esclude animal; paleo esclude grain/legume).
-- meal_role: primo / secondo / contorno / dolce / bevanda / snack (alias menu italiano).

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

comment on column public.nutrition_fdc_food_tags.diet_exclude is
  'Esclusioni: gluten, lactose, animal, grain, legume, high_histamine, nightshade. Usato per filtrare celiaco/vegano/paleo/lactose_free — conteggio emerge dal catalogo, non da soglie fisse.';

comment on column public.nutrition_fdc_food_tags.meal_role is
  'Ruolo menu: primo, secondo, contorno, dolce, bevanda, snack. Complemento a meal_course per branch composer V2.';
