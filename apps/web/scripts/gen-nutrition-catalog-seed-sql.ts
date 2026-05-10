/**
 * Genera SQL idempotente per `nutrition_product_catalog` da `FUELING_PRODUCT_CATALOG`.
 * Esecuzione: da `apps/web`: `npx tsx scripts/gen-nutrition-catalog-seed-sql.ts`
 * Incollare l'output in `supabase/migrations/048_nutrition_canonical_catalog_seed.sql` (sezione seed).
 */
import { FUELING_PRODUCT_CATALOG } from "../lib/nutrition/fueling-product-catalog";
import { fuelingProductToCatalogRow } from "../lib/nutrition/fueling-product-to-catalog-row";

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function sqlJson(obj: Record<string, unknown>): string {
  return sqlString(JSON.stringify(obj));
}

const rows = FUELING_PRODUCT_CATALOG.map(fuelingProductToCatalogRow);

console.log("-- Seed fueling / integratori (dichiarazioni fornitore + scaling documentato in metadata)\n");

for (const r of rows) {
  const meta = sqlJson(r.metadata as Record<string, unknown>);
  console.log(`insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  ${sqlString(r.external_key)},
  ${sqlString(r.source)},
  ${sqlString(r.brand)},
  ${sqlString(r.product_name)},
  ${sqlString(r.category)},
  ${r.serving_size_g != null ? String(r.serving_size_g) : "null"},
  ${String(r.kcal_100g)},
  ${String(r.cho_100g)},
  ${String(r.protein_100g)},
  ${String(r.fat_100g)},
  ${r.sodium_mg_100g != null ? String(r.sodium_mg_100g) : "null"},
  ${meta}::jsonb
)
on conflict (external_key) where external_key is not null do update set
  brand = excluded.brand,
  product_name = excluded.product_name,
  category = excluded.category,
  serving_size_g = excluded.serving_size_g,
  kcal_100g = excluded.kcal_100g,
  cho_100g = excluded.cho_100g,
  protein_100g = excluded.protein_100g,
  fat_100g = excluded.fat_100g,
  sodium_mg_100g = excluded.sodium_mg_100g,
  metadata = excluded.metadata,
  updated_at = now();
`);
}
