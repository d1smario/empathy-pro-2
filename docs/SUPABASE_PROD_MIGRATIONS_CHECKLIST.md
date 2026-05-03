# Allineamento Supabase produzione (Pro 2)

## Principio

Le migrazioni in `supabase/migrations/` vanno applicate **in ordine lessicografico del nome file** (numerazione `000`–`038`). In locale/CI: `supabase link` + `supabase db push`. In SQL Editor: incollare **solo** le migrazioni mancanti, nello stesso ordine.

## Ordine canonico (file)

| # | File |
|---|------|
| 000 | `000_pro2_orgs.sql` |
| 001 | `001_pro2_v1_canonical_prereq_read_spine.sql` |
| 002 | `002_coach_athletes_org_multitenant.sql` |
| 003 | `003_coach_invitations.sql` |
| 004 | `004_health_uploads_bucket.sql` |
| 005 | `005_device_sync_exports_provider_ecosystem.sql` |
| 006 | `006_garmin_push_receipts.sql` |
| 007 | `007_garmin_pull_jobs.sql` |
| 008 | `008_garmin_athlete_links.sql` |
| 009 | `009_athlete_profiles_email_normalized_unique.sql` |
| 010 | `010_athlete_profiles_email_normalized_unique_index.sql` |
| 011 | `011_systemic_modulation_snapshots.sql` |
| 012 | `012_garmin_oauth2_refresh_pull_fallback.sql` |
| 013 | `013_garmin_athlete_links_user_permissions.sql` |
| 014 | `014_training_planned_executed_import_jobs_v1.sql` |
| 015 | `015_read_spine_metabolic_and_evidence_v1.sql` |
| **016** | **`016_nutrition_catalog_and_food_diary_v1.sql`** → crea `food_diary_entries` |
| 017 | `017_manual_actions_and_athlete_update_locks_v1.sql` |
| 018 | `018_knowledge_library_and_research_traces_v1.sql` |
| 019 | `019_billing_stripe_v1.sql` |
| 020 | `020_biomech_session_imports_and_capture_jobs_v1.sql` |
| 021 | `021_biomech_capture_storage_bucket_v1.sql` |
| 022 | `022_metabolic_lab_vo2max_section_v1.sql` |
| 023 | `023_biomarker_panels_rls_v1.sql` |
| 024 | `024_platform_coach_status_and_admin.sql` |
| **025** | **`025_nutrition_fdc_food_cache.sql`** → crea `nutrition_fdc_foods` |
| 026 | `026_v1_remaining_core_state_tables.sql` |
| 027 | `027_v1_nutrition_plan_compat.sql` |
| 028 | `028_media_assets_catalog_v1.sql` |
| 029 | `029_training_and_lab_rls_hardening.sql` |
| 030 | `030_interpretation_staging.sql` |
| 031 | `031_device_ecosystem_parity.sql` |
| 032 | `032_physiology_health_multilayer_bridge.sql` |
| 033 | `033_health_omics_causal_graph.sql` |
| 034 | `034_training_expected_obtained_adaptation.sql` |
| 035 | `035_athlete_coach_application_traces.sql` |
| 036 | `036_nutrition_fdc_metabolic_indices.sql` |
| 037 | `037_vendor_oauth_links.sql` |
| 038 | `038_nutrition_metabolic_indices_repair.sql` (repair idempotente colonne 036) |

## Verifica rapida su prod (prima o dopo push)

Esegui nel SQL Editor del **progetto Supabase corretto** (stesso usato da Vercel):

```sql
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('nutrition_fdc_foods', 'food_diary_entries')
order by 1;
```

Atteso: **due righe** (`food_diary_entries`, `nutrition_fdc_foods`). Se `nutrition_fdc_foods` manca, la **025** non è mai stata applicata su quel database (oppure schema diverso): applica `025_nutrition_fdc_food_cache.sql` dal repo, poi **036** o la **038** di repair.

Colonne metaboliche dopo 036/038:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('nutrition_fdc_foods', 'food_diary_entries')
  and column_name in ('glycemic_index_estimate', 'metabolic_indices')
order by table_name, column_name;
```

## Nota sulla 036

`036_nutrition_fdc_metabolic_indices.sql` è **difensiva**: se una tabella non esiste, salta quella parte senza errore. Su prod con **016** e **025** già applicate, al primo `db push` le colonne vengono aggiunte normalmente.

Se in passato la **036** è stata registrata come applicata **prima** che esistesse `nutrition_fdc_foods`, Supabase **non** rieseguirà la 036: usa la migrazione **038** (repair idempotente) oppure gli `ALTER` manuali nel file `038`.

## OAuth WHOOP/Wahoo

Dopo **037**: tabella `public.vendor_oauth_links` (solo service role; nessuna policy utente).
