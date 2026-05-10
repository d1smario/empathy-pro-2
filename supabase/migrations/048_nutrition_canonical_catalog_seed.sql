-- Canonical nutrition catalog: chiave esterna idempotente + seed fueling/fornitore.
-- Lookup e diario convogliano su `nutrition_product_catalog` (brand-site) e `nutrition_fdc_foods` (USDA).
-- Per rigenerare il blocco INSERT: `cd apps/web && npx tsx scripts/gen-nutrition-catalog-seed-sql.ts > ../supabase/migrations/_048_nutrition_seed_generated.sql`

alter table public.nutrition_product_catalog
  add column if not exists external_key text;

create unique index if not exists uq_nutrition_product_catalog_external_key
  on public.nutrition_product_catalog (external_key)
  where external_key is not null;

comment on column public.nutrition_product_catalog.external_key is
  'Chiave stabile (es. fueling:brand__product) per upsert seed e allineamento codice.';
-- Seed fueling / integratori (dichiarazioni fornitore + scaling documentato in metadata)

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:enervit__r2_recovery_drink',
  'brand-site',
  'Enervit',
  'R2 Recovery Drink',
  'recovery',
  40,
  390,
  52,
  32,
  6,
  380,
  '{"kind":"fueling_product","fueling_product_key":"enervit__r2_recovery_drink","supplier_product_url":"https://www.enervit.com/en/wp-recovery-drink.html","logo_domain":"enervit.com","image_url":null,"format":"powder","functional_focus":["recovery","protein","carbo"],"timing":["post"],"fueling_category":"recovery","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:enervit__c2_1pro_gel',
  'brand-site',
  'Enervit',
  'C2:1PRO Gel',
  'gel',
  40,
  313.5,
  75,
  0,
  1.5,
  375,
  '{"kind":"fueling_product","fueling_product_key":"enervit__c2_1pro_gel","supplier_product_url":"https://www.enervit.com/en/products/the-carbo-gel-c-2-1-pro-orange.html","logo_domain":"enervit.com","image_url":null,"format":"gel","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:enervit__isocarb_c2_1pro',
  'brand-site',
  'Enervit',
  'Isocarb C2:1PRO',
  'drink',
  40,
  400,
  100,
  0,
  0,
  450,
  '{"kind":"fueling_product","fueling_product_key":"enervit__isocarb_c2_1pro","supplier_product_url":"https://www.enervit.com/en/products/isocarb-c-2-1-pro.html","logo_domain":"enervit.com","image_url":"https://enervit.kleecks-cdn.com/media/catalog/product/b/u/busta-isocarb-lemon-786x818_con_ombra.jpg","format":"powder","functional_focus":["carbo","electrolyte"],"timing":["pre","intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:enervit__competition_bar',
  'brand-site',
  'Enervit',
  'Competition Bar',
  'bar',
  45,
  464.93,
  84.44,
  0,
  14.13,
  403.32,
  '{"kind":"fueling_product","fueling_product_key":"enervit__competition_bar","supplier_product_url":"https://www.enervit.com/en/competition-bar-orange.html","logo_domain":"enervit.com","image_url":null,"format":"bar","functional_focus":["carbo"],"timing":["pre","intra"],"fueling_category":"bar","carbohydrate_g_per_serving_declared":38,"assumed_serving_g":45,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:enervit__pre_sport',
  'brand-site',
  'Enervit',
  'Pre Sport',
  'drink',
  40,
  180,
  28,
  2,
  0,
  120,
  '{"kind":"fueling_product","fueling_product_key":"enervit__pre_sport","supplier_product_url":"https://www.enervit.com","logo_domain":"enervit.com","image_url":null,"format":"powder","functional_focus":["preworkout","caffeine"],"timing":["pre"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:enervit__whey_protein',
  'brand-site',
  'Enervit',
  'Whey Protein',
  'recovery',
  40,
  390,
  52,
  32,
  6,
  380,
  '{"kind":"fueling_product","fueling_product_key":"enervit__whey_protein","supplier_product_url":"https://www.enervit.com","logo_domain":"enervit.com","image_url":null,"format":"powder","functional_focus":["protein","recovery"],"timing":["post","daily"],"fueling_category":"recovery","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:enervit__eaa_amino_mix',
  'brand-site',
  'Enervit',
  'EAA Amino Mix',
  'drink',
  40,
  258,
  55,
  5,
  2,
  200,
  '{"kind":"fueling_product","fueling_product_key":"enervit__eaa_amino_mix","supplier_product_url":"https://www.enervit.com","logo_domain":"enervit.com","image_url":null,"format":"powder","functional_focus":["eaa","recovery"],"timing":["post","daily"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:enervit__bcaa_2_1_1',
  'brand-site',
  'Enervit',
  'BCAA 2:1:1',
  'chew',
  3,
  258,
  55,
  5,
  2,
  200,
  '{"kind":"fueling_product","fueling_product_key":"enervit__bcaa_2_1_1","supplier_product_url":"https://www.enervit.com","logo_domain":"enervit.com","image_url":null,"format":"tablet","functional_focus":["bcaa","recovery"],"timing":["pre","post","daily"],"fueling_category":"chew","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":3,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:maurten__drink_mix_160',
  'brand-site',
  'Maurten',
  'Drink Mix 160',
  'drink',
  40,
  390,
  97.5,
  0,
  0,
  442.5,
  '{"kind":"fueling_product","fueling_product_key":"maurten__drink_mix_160","supplier_product_url":"https://www.maurten.com/products/drink-mix-160-box","logo_domain":"maurten.com","image_url":null,"format":"powder","functional_focus":["carbo"],"timing":["pre","intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":39,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:maurten__gel_100',
  'brand-site',
  'Maurten',
  'Gel 100',
  'gel',
  40,
  261.25,
  62.5,
  0,
  1.25,
  337.5,
  '{"kind":"fueling_product","fueling_product_key":"maurten__gel_100","supplier_product_url":"https://www.maurten.com/products/hr/gel-100-box","logo_domain":"maurten.com","image_url":null,"format":"gel","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":25,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:maurten__gel_100_caf_100',
  'brand-site',
  'Maurten',
  'Gel 100 Caf 100',
  'chew',
  40,
  261.25,
  62.5,
  0,
  1.25,
  337.5,
  '{"kind":"fueling_product","fueling_product_key":"maurten__gel_100_caf_100","supplier_product_url":"https://www.maurten.com/products/hr/gel-100-caf-100-box","logo_domain":"maurten.com","image_url":null,"format":"gel","functional_focus":["carbo","caffeine"],"timing":["pre","intra"],"fueling_category":"chew","carbohydrate_g_per_serving_declared":25,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:maurten__drink_mix_320',
  'brand-site',
  'Maurten',
  'Drink Mix 320',
  'drink',
  40,
  400,
  100,
  0,
  0,
  450,
  '{"kind":"fueling_product","fueling_product_key":"maurten__drink_mix_320","supplier_product_url":"https://www.maurten.com","logo_domain":"maurten.com","image_url":null,"format":"powder","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:maurten__solid_160',
  'brand-site',
  'Maurten',
  'Solid 160',
  'bar',
  45,
  487.59,
  88.89,
  0,
  14.67,
  416.67,
  '{"kind":"fueling_product","fueling_product_key":"maurten__solid_160","supplier_product_url":"https://www.maurten.com","logo_domain":"maurten.com","image_url":null,"format":"bar","functional_focus":["carbo"],"timing":["pre","intra"],"fueling_category":"bar","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":45,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:sis__rego_rapid_recovery',
  'brand-site',
  'SiS',
  'REGO Rapid Recovery',
  'recovery',
  40,
  390,
  52,
  32,
  6,
  380,
  '{"kind":"fueling_product","fueling_product_key":"sis__rego_rapid_recovery","supplier_product_url":"https://www.scienceinsport.com/shop-sis/rego-range/rapid-recovery-1kg","logo_domain":"scienceinsport.com","image_url":null,"format":"powder","functional_focus":["recovery","protein","carbo"],"timing":["post"],"fueling_category":"recovery","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:sis__go_isotonic_gel',
  'brand-site',
  'SiS',
  'GO Isotonic Gel',
  'gel',
  40,
  229.9,
  55,
  0,
  1.1,
  315,
  '{"kind":"fueling_product","fueling_product_key":"sis__go_isotonic_gel","supplier_product_url":"https://www.scienceinsport.com/shop-sis/go-range/go-isotonic-energy-gel","logo_domain":"scienceinsport.com","image_url":null,"format":"gel","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":22,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:sis__beta_fuel_drink',
  'brand-site',
  'SiS',
  'Beta Fuel Drink',
  'drink',
  40,
  400,
  100,
  0,
  0,
  450,
  '{"kind":"fueling_product","fueling_product_key":"sis__beta_fuel_drink","supplier_product_url":"https://www.scienceinsport.com/shop-sis/beta-fuel-range/beta-fuel-energy-drink","logo_domain":"scienceinsport.com","image_url":null,"format":"powder","functional_focus":["carbo","electrolyte"],"timing":["intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:sis__go_energy_bar',
  'brand-site',
  'SiS',
  'GO Energy Bar',
  'bar',
  45,
  487.59,
  88.89,
  0,
  14.67,
  416.67,
  '{"kind":"fueling_product","fueling_product_key":"sis__go_energy_bar","supplier_product_url":"https://www.scienceinsport.com/shop-sis/go-range/go-energy-bar","logo_domain":"scienceinsport.com","image_url":null,"format":"bar","functional_focus":["carbo"],"timing":["pre","intra"],"fueling_category":"bar","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":45,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:sis__go_electrolyte',
  'brand-site',
  'SiS',
  'GO Electrolyte',
  'drink',
  40,
  360,
  90,
  0,
  0,
  420,
  '{"kind":"fueling_product","fueling_product_key":"sis__go_electrolyte","supplier_product_url":"https://www.scienceinsport.com","logo_domain":"scienceinsport.com","image_url":null,"format":"powder","functional_focus":["carbo","electrolyte"],"timing":["pre","intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":36,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:sis__go_caffeine_gel',
  'brand-site',
  'SiS',
  'GO Caffeine Gel',
  'gel',
  40,
  229.9,
  55,
  0,
  1.1,
  315,
  '{"kind":"fueling_product","fueling_product_key":"sis__go_caffeine_gel","supplier_product_url":"https://www.scienceinsport.com","logo_domain":"scienceinsport.com","image_url":null,"format":"gel","functional_focus":["carbo","caffeine"],"timing":["pre","intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":22,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:sis__beta_fuel_chew',
  'brand-site',
  'SiS',
  'Beta Fuel Chew',
  'chew',
  50,
  368,
  92,
  0,
  0,
  426,
  '{"kind":"fueling_product","fueling_product_key":"sis__beta_fuel_chew","supplier_product_url":"https://www.scienceinsport.com","logo_domain":"scienceinsport.com","image_url":null,"format":"chew","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"chew","carbohydrate_g_per_serving_declared":46,"assumed_serving_g":50,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:sis__bcaa_performance',
  'brand-site',
  'SiS',
  'BCAA Performance',
  'drink',
  40,
  258,
  55,
  5,
  2,
  200,
  '{"kind":"fueling_product","fueling_product_key":"sis__bcaa_performance","supplier_product_url":"https://www.scienceinsport.com","logo_domain":"scienceinsport.com","image_url":null,"format":"powder","functional_focus":["bcaa","recovery"],"timing":["post","daily"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:watt__r_m_pump_recovery_mix',
  'brand-site',
  '+Watt',
  'R.M. Pump Recovery Mix',
  'recovery',
  40,
  390,
  52,
  32,
  6,
  380,
  '{"kind":"fueling_product","fueling_product_key":"watt__r_m_pump_recovery_mix","supplier_product_url":"https://watt.it/en/post-workout-en/r-m-pump-recovery-mix/","logo_domain":"watt.it","image_url":null,"format":"powder","functional_focus":["recovery","protein","carbo"],"timing":["post"],"fueling_category":"recovery","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:watt__energy_gel',
  'brand-site',
  '+Watt',
  'Energy Gel',
  'gel',
  40,
  313.5,
  75,
  0,
  1.5,
  375,
  '{"kind":"fueling_product","fueling_product_key":"watt__energy_gel","supplier_product_url":"https://watt.it","logo_domain":"watt.it","image_url":null,"format":"gel","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:watt__carbo_drink',
  'brand-site',
  '+Watt',
  'Carbo Drink',
  'drink',
  40,
  400,
  100,
  0,
  0,
  450,
  '{"kind":"fueling_product","fueling_product_key":"watt__carbo_drink","supplier_product_url":"https://watt.it","logo_domain":"watt.it","image_url":null,"format":"powder","functional_focus":["carbo","electrolyte"],"timing":["pre","intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:watt__pre_workout_nitro_pump',
  'brand-site',
  '+Watt',
  'Pre Workout Nitro Pump',
  'drink',
  40,
  160,
  22,
  3,
  0,
  80,
  '{"kind":"fueling_product","fueling_product_key":"watt__pre_workout_nitro_pump","supplier_product_url":"https://watt.it","logo_domain":"watt.it","image_url":null,"format":"powder","functional_focus":["preworkout","caffeine"],"timing":["pre"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:watt__whey_isolate',
  'brand-site',
  '+Watt',
  'Whey Isolate',
  'recovery',
  40,
  390,
  52,
  32,
  6,
  380,
  '{"kind":"fueling_product","fueling_product_key":"watt__whey_isolate","supplier_product_url":"https://watt.it","logo_domain":"watt.it","image_url":null,"format":"powder","functional_focus":["protein","recovery"],"timing":["post","daily"],"fueling_category":"recovery","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:watt__eaa_zero',
  'brand-site',
  '+Watt',
  'EAA Zero',
  'drink',
  40,
  258,
  55,
  5,
  2,
  200,
  '{"kind":"fueling_product","fueling_product_key":"watt__eaa_zero","supplier_product_url":"https://watt.it","logo_domain":"watt.it","image_url":null,"format":"powder","functional_focus":["eaa","recovery"],"timing":["post","daily"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:watt__bcaa_4_1_1',
  'brand-site',
  '+Watt',
  'BCAA 4:1:1',
  'chew',
  3,
  258,
  55,
  5,
  2,
  200,
  '{"kind":"fueling_product","fueling_product_key":"watt__bcaa_4_1_1","supplier_product_url":"https://watt.it","logo_domain":"watt.it","image_url":null,"format":"tablet","functional_focus":["bcaa"],"timing":["pre","post","daily"],"fueling_category":"chew","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":3,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:watt__creatine_powder',
  'brand-site',
  '+Watt',
  'Creatine Powder',
  'drink',
  40,
  258,
  55,
  5,
  2,
  200,
  '{"kind":"fueling_product","fueling_product_key":"watt__creatine_powder","supplier_product_url":"https://watt.it","logo_domain":"watt.it","image_url":null,"format":"powder","functional_focus":["creatine"],"timing":["daily","post"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:powerbar__recovery_max',
  'brand-site',
  'Powerbar',
  'Recovery Max',
  'recovery',
  40,
  390,
  52,
  32,
  6,
  380,
  '{"kind":"fueling_product","fueling_product_key":"powerbar__recovery_max","supplier_product_url":"https://www.powerbar.com/en-gb/products/recovery-max-regeneration-whey-drink-with-carbohydrates","logo_domain":"powerbar.com","image_url":null,"format":"powder","functional_focus":["recovery","protein","carbo"],"timing":["post"],"fueling_category":"recovery","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:powerbar__powergel_hydro',
  'brand-site',
  'Powerbar',
  'PowerGel Hydro',
  'gel',
  40,
  282.15,
  67.5,
  0,
  1.35,
  352.5,
  '{"kind":"fueling_product","fueling_product_key":"powerbar__powergel_hydro","supplier_product_url":"https://www.powerbar.com","logo_domain":"powerbar.com","image_url":null,"format":"gel","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":27,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:powerbar__isoactive_drink',
  'brand-site',
  'Powerbar',
  'IsoActive Drink',
  'drink',
  40,
  330,
  82.5,
  0,
  0,
  397.5,
  '{"kind":"fueling_product","fueling_product_key":"powerbar__isoactive_drink","supplier_product_url":"https://www.powerbar.com/en-gb/products/isoactive-isotonic-sports-drink","logo_domain":"powerbar.com","image_url":null,"format":"powder","functional_focus":["carbo","electrolyte"],"timing":["pre","intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":33,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:powerbar__energize_original',
  'brand-site',
  'Powerbar',
  'Energize Original',
  'bar',
  45,
  487.59,
  88.89,
  0,
  14.67,
  416.67,
  '{"kind":"fueling_product","fueling_product_key":"powerbar__energize_original","supplier_product_url":"https://www.powerbar.com","logo_domain":"powerbar.com","image_url":null,"format":"bar","functional_focus":["carbo"],"timing":["pre","intra"],"fueling_category":"bar","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":45,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:powerbar__black_line_pre_workout',
  'brand-site',
  'Powerbar',
  'Black Line Pre-Workout',
  'drink',
  40,
  170,
  24,
  4,
  0,
  90,
  '{"kind":"fueling_product","fueling_product_key":"powerbar__black_line_pre_workout","supplier_product_url":"https://www.powerbar.com","logo_domain":"powerbar.com","image_url":null,"format":"powder","functional_focus":["preworkout","caffeine"],"timing":["pre"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:powerbar__protein_plus',
  'brand-site',
  'Powerbar',
  'Protein Plus',
  'recovery',
  45,
  390,
  52,
  32,
  6,
  380,
  '{"kind":"fueling_product","fueling_product_key":"powerbar__protein_plus","supplier_product_url":"https://www.powerbar.com","logo_domain":"powerbar.com","image_url":null,"format":"bar","functional_focus":["protein","recovery"],"timing":["post","daily"],"fueling_category":"recovery","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":45,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:precision_fuel_hydration__pf_30_gel',
  'brand-site',
  'Precision Fuel & Hydration',
  'PF 30 Gel',
  'gel',
  40,
  313.5,
  75,
  0,
  1.5,
  375,
  '{"kind":"fueling_product","fueling_product_key":"precision_fuel_hydration__pf_30_gel","supplier_product_url":"https://www.precisionhydration.com","logo_domain":"precisionhydration.com","image_url":null,"format":"gel","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:precision_fuel_hydration__carb_electrolyte_drink_mix',
  'brand-site',
  'Precision Fuel & Hydration',
  'Carb & Electrolyte Drink Mix',
  'drink',
  40,
  400,
  100,
  0,
  0,
  450,
  '{"kind":"fueling_product","fueling_product_key":"precision_fuel_hydration__carb_electrolyte_drink_mix","supplier_product_url":"https://www.precisionhydration.com","logo_domain":"precisionhydration.com","image_url":null,"format":"powder","functional_focus":["carbo","electrolyte"],"timing":["pre","intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:precision_fuel_hydration__ph_1000',
  'brand-site',
  'Precision Fuel & Hydration',
  'PH 1000',
  'drink',
  3,
  12,
  2,
  0,
  0,
  2500,
  '{"kind":"fueling_product","fueling_product_key":"precision_fuel_hydration__ph_1000","supplier_product_url":"https://www.precisionhydration.com","logo_domain":"precisionhydration.com","image_url":null,"format":"tablet","functional_focus":["electrolyte"],"timing":["pre","intra","daily"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":3,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:precision_fuel_hydration__pf_chew',
  'brand-site',
  'Precision Fuel & Hydration',
  'PF Chew',
  'chew',
  50,
  240,
  60,
  0,
  0,
  330,
  '{"kind":"fueling_product","fueling_product_key":"precision_fuel_hydration__pf_chew","supplier_product_url":"https://www.precisionhydration.com","logo_domain":"precisionhydration.com","image_url":null,"format":"chew","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"chew","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":50,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:named_sport__race_fuel',
  'brand-site',
  'Named Sport',
  'Race Fuel',
  'drink',
  40,
  400,
  100,
  0,
  0,
  450,
  '{"kind":"fueling_product","fueling_product_key":"named_sport__race_fuel","supplier_product_url":"https://www.namedsport.com","logo_domain":"namedsport.com","image_url":null,"format":"powder","functional_focus":["carbo","electrolyte"],"timing":["pre","intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":40,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:named_sport__total_energy_hydro_gel',
  'brand-site',
  'Named Sport',
  'Total Energy Hydro Gel',
  'gel',
  40,
  313.5,
  75,
  0,
  1.5,
  375,
  '{"kind":"fueling_product","fueling_product_key":"named_sport__total_energy_hydro_gel","supplier_product_url":"https://www.namedsport.com","logo_domain":"namedsport.com","image_url":null,"format":"gel","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:named_sport__whey_isolate',
  'brand-site',
  'Named Sport',
  'Whey Isolate',
  'recovery',
  40,
  390,
  52,
  32,
  6,
  380,
  '{"kind":"fueling_product","fueling_product_key":"named_sport__whey_isolate","supplier_product_url":"https://www.namedsport.com","logo_domain":"namedsport.com","image_url":null,"format":"powder","functional_focus":["protein","recovery"],"timing":["post","daily"],"fueling_category":"recovery","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:named_sport__bcaa_powder',
  'brand-site',
  'Named Sport',
  'BCAA Powder',
  'drink',
  40,
  258,
  55,
  5,
  2,
  200,
  '{"kind":"fueling_product","fueling_product_key":"named_sport__bcaa_powder","supplier_product_url":"https://www.namedsport.com","logo_domain":"namedsport.com","image_url":null,"format":"powder","functional_focus":["bcaa"],"timing":["pre","post","daily"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:named_sport__eaa_amino_tabs',
  'brand-site',
  'Named Sport',
  'EAA Amino Tabs',
  'chew',
  3,
  258,
  55,
  5,
  2,
  200,
  '{"kind":"fueling_product","fueling_product_key":"named_sport__eaa_amino_tabs","supplier_product_url":"https://www.namedsport.com","logo_domain":"namedsport.com","image_url":null,"format":"tablet","functional_focus":["eaa"],"timing":["post","daily"],"fueling_category":"chew","carbohydrate_g_per_serving_declared":null,"assumed_serving_g":3,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:neversecond__c30_fuel_drink',
  'brand-site',
  'Neversecond',
  'C30 Fuel Drink',
  'drink',
  40,
  300,
  75,
  0,
  0,
  375,
  '{"kind":"fueling_product","fueling_product_key":"neversecond__c30_fuel_drink","supplier_product_url":"https://www.neversecond.com","logo_domain":"neversecond.com","image_url":null,"format":"powder","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"drink","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:neversecond__c30_fuel_gel',
  'brand-site',
  'Neversecond',
  'C30 Fuel Gel',
  'gel',
  40,
  313.5,
  75,
  0,
  1.5,
  375,
  '{"kind":"fueling_product","fueling_product_key":"neversecond__c30_fuel_gel","supplier_product_url":"https://www.neversecond.com","logo_domain":"neversecond.com","image_url":null,"format":"gel","functional_focus":["carbo"],"timing":["intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:neversecond__c30_fuel_bar',
  'brand-site',
  'Neversecond',
  'C30 Fuel Bar',
  'bar',
  45,
  374.68,
  66.67,
  0,
  12,
  350.01,
  '{"kind":"fueling_product","fueling_product_key":"neversecond__c30_fuel_bar","supplier_product_url":"https://www.neversecond.com","logo_domain":"neversecond.com","image_url":null,"format":"bar","functional_focus":["carbo"],"timing":["pre","intra"],"fueling_category":"bar","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":45,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

insert into public.nutrition_product_catalog (
  external_key, source, brand, product_name, category, serving_size_g,
  kcal_100g, cho_100g, protein_100g, fat_100g, sodium_mg_100g, metadata
) values (
  'fueling:neversecond__c30_caffeine_gel',
  'brand-site',
  'Neversecond',
  'C30+ Caffeine Gel',
  'gel',
  40,
  313.5,
  75,
  0,
  1.5,
  375,
  '{"kind":"fueling_product","fueling_product_key":"neversecond__c30_caffeine_gel","supplier_product_url":"https://www.neversecond.com","logo_domain":"neversecond.com","image_url":null,"format":"gel","functional_focus":["carbo","caffeine"],"timing":["pre","intra"],"fueling_category":"gel","carbohydrate_g_per_serving_declared":30,"assumed_serving_g":40,"macro_method":"supplier_declaration_scaled_v1"}'::jsonb
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

