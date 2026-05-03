-- Repair prod: idempotente. Utile se `036` risulta già in `schema_migrations` ma al momento
-- dell'esecuzione `public.nutrition_fdc_foods` non esisteva ancora (nessuna colonna aggiunta).
-- Con 016+025 presenti, questo blocco allinea le colonne metaboliche senza duplicare errori.

do $repair$
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
$repair$;
