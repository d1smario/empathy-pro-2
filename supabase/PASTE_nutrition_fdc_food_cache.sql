-- Incolla nel Supabase SQL Editor (progetto = NEXT_PUBLIC_SUPABASE_URL dell'app).
-- Crea `nutrition_fdc_foods` + indici metabolici se mancanti.
-- Poi: npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/import-usda-fdc-dump.ts

\ir migrations/025_nutrition_fdc_food_cache.sql
