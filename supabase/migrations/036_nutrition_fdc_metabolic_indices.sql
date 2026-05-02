-- Pro 2 nutrition — metabolic indices estimated from USDA macro profile.
-- USDA FDC does not publish glycemic/insulin indices directly; these columns store
-- deterministic estimates with method metadata, separate from raw USDA nutrients.

alter table public.nutrition_fdc_foods
  add column if not exists glycemic_index_estimate numeric(6, 2),
  add column if not exists insulin_index_estimate numeric(6, 2),
  add column if not exists glycemic_load_100g numeric(8, 3),
  add column if not exists insulin_load_100g numeric(8, 3),
  add column if not exists metabolic_indices jsonb not null default '{}'::jsonb;

alter table public.food_diary_entries
  add column if not exists glycemic_index_estimate numeric(6, 2),
  add column if not exists insulin_index_estimate numeric(6, 2),
  add column if not exists glycemic_load numeric(8, 3),
  add column if not exists insulin_load numeric(8, 3),
  add column if not exists metabolic_indices jsonb not null default '{}'::jsonb;

comment on column public.nutrition_fdc_foods.glycemic_index_estimate is
  'Estimated glycemic index derived from USDA macro profile; not a USDA source field and not clinical.';

comment on column public.nutrition_fdc_foods.insulin_index_estimate is
  'Estimated insulin index derived from USDA macro profile; not a USDA source field and not clinical.';

comment on column public.food_diary_entries.glycemic_load is
  'Estimated glycemic load scaled to diary quantity.';

comment on column public.food_diary_entries.insulin_load is
  'Estimated insulin load scaled to diary quantity.';
-- Pro 2 nutrition — metabolic indices estimated from USDA macro profile.
-- USDA FDC does not publish glycemic/insulin indices directly; these columns store
-- deterministic estimates with method metadata, separate from raw USDA nutrients.

alter table public.nutrition_fdc_foods
  add column if not exists glycemic_index_estimate numeric(6, 2),
  add column if not exists insulin_index_estimate numeric(6, 2),
  add column if not exists glycemic_load_100g numeric(8, 3),
  add column if not exists insulin_load_100g numeric(8, 3),
  add column if not exists metabolic_indices jsonb not null default '{}'::jsonb;

alter table public.food_diary_entries
  add column if not exists glycemic_index_estimate numeric(6, 2),
  add column if not exists insulin_index_estimate numeric(6, 2),
  add column if not exists glycemic_load numeric(8, 3),
  add column if not exists insulin_load numeric(8, 3),
  add column if not exists metabolic_indices jsonb not null default '{}'::jsonb;

comment on column public.nutrition_fdc_foods.glycemic_index_estimate is
  'Estimated glycemic index derived from USDA macro profile; not a USDA source field and not clinical.';

comment on column public.nutrition_fdc_foods.insulin_index_estimate is
  'Estimated insulin index derived from USDA macro profile; not a USDA source field and not clinical.';

comment on column public.food_diary_entries.glycemic_load is
  'Estimated glycemic load scaled to diary quantity.';

comment on column public.food_diary_entries.insulin_load is
  'Estimated insulin load scaled to diary quantity.';
