-- =============================================================================
-- EMPATHY Pro 2.0 — Bootstrap demo micronutrienti per meal plan
-- =============================================================================
-- Popola `nutrition_fdc_foods` con un set base ad alta densita micronutrienti
-- (vitamine/minerali) cosi la demo meal plan non resta vuota senza warmup USDA.
-- Idempotente tramite upsert su fdc_id.
-- =============================================================================

insert into public.nutrition_fdc_foods (
  fdc_id,
  description,
  data_type,
  publication_date,
  food_category,
  kcal_100g,
  carbs_100g,
  protein_100g,
  fat_100g,
  fiber_100g,
  sugars_100g,
  sodium_mg_100g,
  vitamins,
  minerals,
  amino_acids,
  fatty_acids,
  other_nutrients,
  nutrients_raw,
  source_payload,
  refreshed_at
)
values
  (
    10001, 'Spinach, raw (demo)', 'Foundation', '2024-01-01', 'Vegetables',
    23, 3.6, 2.9, 0.4, 2.2, 0.4, 79,
    jsonb_build_array(
      jsonb_build_object('nutrientId', 11090, 'name', 'Vitamin C', 'amountPer100g', 28.1, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1179, 'name', 'Folate, DFE', 'amountPer100g', 194, 'unit', 'µg'),
      jsonb_build_object('nutrientId', 11006, 'name', 'Vitamin A, RAE', 'amountPer100g', 469, 'unit', 'µg')
    ),
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1087, 'name', 'Calcium', 'amountPer100g', 99, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1089, 'name', 'Iron', 'amountPer100g', 2.7, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1090, 'name', 'Magnesium', 'amountPer100g', 79, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1092, 'name', 'Potassium', 'amountPer100g', 558, 'unit', 'mg')
    ),
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    jsonb_build_object('seed', 'demo_micros_bootstrap_v1', 'origin', 'manual_curated'),
    now()
  ),
  (
    10002, 'Salmon, Atlantic, cooked (demo)', 'Foundation', '2024-01-01', 'Fish',
    206, 0, 22, 12, 0, 0, 59,
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1114, 'name', 'Vitamin D', 'amountPer100g', 10.9, 'unit', 'µg'),
      jsonb_build_object('nutrientId', 1178, 'name', 'Vitamin B12', 'amountPer100g', 3.2, 'unit', 'µg')
    ),
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1092, 'name', 'Potassium', 'amountPer100g', 363, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1103, 'name', 'Selenium', 'amountPer100g', 36.5, 'unit', 'µg')
    ),
    '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('nutrientId', 1258, 'name', 'EPA+DHA', 'amountPer100g', 1.8, 'unit', 'g')),
    '[]'::jsonb, '[]'::jsonb,
    jsonb_build_object('seed', 'demo_micros_bootstrap_v1', 'origin', 'manual_curated'),
    now()
  ),
  (
    10003, 'Lentils, boiled (demo)', 'Foundation', '2024-01-01', 'Legumes',
    116, 20.1, 9.0, 0.4, 7.9, 1.8, 2,
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1179, 'name', 'Folate, DFE', 'amountPer100g', 181, 'unit', 'µg'),
      jsonb_build_object('nutrientId', 1162, 'name', 'Thiamin', 'amountPer100g', 0.17, 'unit', 'mg')
    ),
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1089, 'name', 'Iron', 'amountPer100g', 3.3, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1090, 'name', 'Magnesium', 'amountPer100g', 36, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1092, 'name', 'Potassium', 'amountPer100g', 369, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1095, 'name', 'Zinc', 'amountPer100g', 1.3, 'unit', 'mg')
    ),
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    jsonb_build_object('seed', 'demo_micros_bootstrap_v1', 'origin', 'manual_curated'),
    now()
  ),
  (
    10004, 'Blueberries, raw (demo)', 'Foundation', '2024-01-01', 'Fruits',
    57, 14.5, 0.7, 0.3, 2.4, 10.0, 1,
    jsonb_build_array(
      jsonb_build_object('nutrientId', 11090, 'name', 'Vitamin C', 'amountPer100g', 9.7, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1185, 'name', 'Vitamin K', 'amountPer100g', 19.3, 'unit', 'µg')
    ),
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1092, 'name', 'Potassium', 'amountPer100g', 77, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1090, 'name', 'Magnesium', 'amountPer100g', 6, 'unit', 'mg')
    ),
    '[]'::jsonb, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('nutrientId', 20001, 'name', 'Polyphenols (estimate)', 'amountPer100g', 250, 'unit', 'mg')),
    '[]'::jsonb,
    jsonb_build_object('seed', 'demo_micros_bootstrap_v1', 'origin', 'manual_curated'),
    now()
  ),
  (
    10005, 'Greek yogurt plain (demo)', 'Foundation', '2024-01-01', 'Dairy',
    97, 3.9, 9.0, 5.0, 0.0, 3.6, 36,
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1178, 'name', 'Vitamin B12', 'amountPer100g', 0.75, 'unit', 'µg'),
      jsonb_build_object('nutrientId', 1114, 'name', 'Vitamin D', 'amountPer100g', 0.2, 'unit', 'µg')
    ),
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1087, 'name', 'Calcium', 'amountPer100g', 110, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1092, 'name', 'Potassium', 'amountPer100g', 141, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1101, 'name', 'Phosphorus', 'amountPer100g', 135, 'unit', 'mg')
    ),
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    jsonb_build_object('seed', 'demo_micros_bootstrap_v1', 'origin', 'manual_curated'),
    now()
  ),
  (
    10006, 'Almonds, raw (demo)', 'Foundation', '2024-01-01', 'Nuts and seeds',
    579, 21.6, 21.1, 49.9, 12.5, 4.4, 1,
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1109, 'name', 'Vitamin E', 'amountPer100g', 25.6, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1185, 'name', 'Vitamin K', 'amountPer100g', 0.0, 'unit', 'µg')
    ),
    jsonb_build_array(
      jsonb_build_object('nutrientId', 1090, 'name', 'Magnesium', 'amountPer100g', 270, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1092, 'name', 'Potassium', 'amountPer100g', 733, 'unit', 'mg'),
      jsonb_build_object('nutrientId', 1095, 'name', 'Zinc', 'amountPer100g', 3.1, 'unit', 'mg')
    ),
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    jsonb_build_object('seed', 'demo_micros_bootstrap_v1', 'origin', 'manual_curated'),
    now()
  )
on conflict (fdc_id) do update set
  description = excluded.description,
  data_type = excluded.data_type,
  publication_date = excluded.publication_date,
  food_category = excluded.food_category,
  kcal_100g = excluded.kcal_100g,
  carbs_100g = excluded.carbs_100g,
  protein_100g = excluded.protein_100g,
  fat_100g = excluded.fat_100g,
  fiber_100g = excluded.fiber_100g,
  sugars_100g = excluded.sugars_100g,
  sodium_mg_100g = excluded.sodium_mg_100g,
  vitamins = excluded.vitamins,
  minerals = excluded.minerals,
  amino_acids = excluded.amino_acids,
  fatty_acids = excluded.fatty_acids,
  other_nutrients = excluded.other_nutrients,
  nutrients_raw = excluded.nutrients_raw,
  source_payload = excluded.source_payload,
  refreshed_at = now();

select
  count(*)::int as seeded_foods,
  min(fdc_id) as min_fdc_id,
  max(fdc_id) as max_fdc_id
from public.nutrition_fdc_foods
where fdc_id between 10001 and 10006;
