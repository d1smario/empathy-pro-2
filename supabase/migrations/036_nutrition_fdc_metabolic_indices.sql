-- Pro 2 nutrition — metabolic indices estimated from USDA macro profile.
-- USDA FDC does not publish glycemic/insulin indices directly; these columns store
-- deterministic estimates with method metadata, separate from raw USDA nutrients.
--
-- Le tabelle provengono da 016 (food_diary_entries) e 025 (nutrition_fdc_foods).
-- Se il DB non ha ancora quelle migrazioni, questo script non fa nulla (no errore).

do $migration$
begin
  if to_regclass('public.nutrition_fdc_foods') is not null then
    alter table public.nutrition_fdc_foods
      add column if not exists glycemic_index_estimate numeric(6, 2),
      add column if not exists insulin_index_estimate numeric(6, 2),
      add column if not exists glycemic_load_100g numeric(8, 3),
      add column if not exists insulin_load_100g numeric(8, 3),
      add column if not exists metabolic_indices jsonb not null default '{}'::jsonb;

    execute format(
      'comment on column public.nutrition_fdc_foods.glycemic_index_estimate is %L',
      'Estimated glycemic index derived from USDA macro profile; not a USDA source field and not clinical.'
    );
    execute format(
      'comment on column public.nutrition_fdc_foods.insulin_index_estimate is %L',
      'Estimated insulin index derived from USDA macro profile; not a USDA source field and not clinical.'
    );
  end if;

  if to_regclass('public.food_diary_entries') is not null then
    alter table public.food_diary_entries
      add column if not exists glycemic_index_estimate numeric(6, 2),
      add column if not exists insulin_index_estimate numeric(6, 2),
      add column if not exists glycemic_load numeric(8, 3),
      add column if not exists insulin_load numeric(8, 3),
      add column if not exists metabolic_indices jsonb not null default '{}'::jsonb;

    execute format(
      'comment on column public.food_diary_entries.glycemic_load is %L',
      'Estimated glycemic load scaled to diary quantity.'
    );
    execute format(
      'comment on column public.food_diary_entries.insulin_load is %L',
      'Estimated insulin load scaled to diary quantity.'
    );
  end if;
end;
$migration$;
