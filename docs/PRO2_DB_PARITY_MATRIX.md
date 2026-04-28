# Pro 2 DB Parity Matrix

Obiettivo: rendere Empathy Pro 2 avviabile su un Supabase pulito senza dipendere implicitamente dalla history V1, mantenendo compatibilita con il DB condiviso quando V1 e Pro 2 usano lo stesso progetto.

Repo riferimento:

- V1: `nextjs-empathy-pro`
- Pro 2: `empathy-pro-2-cursor`

Regola operativa: non copiare tutto V1. Portare in Pro 2 solo le tabelle che sono gia usate dal codice Pro 2, che sono parte del read spine canonico, o che servono al sistema multilivello completo.

## Stato Sintetico

Pro 2 ha gia assorbito una parte importante della piattaforma V1:

- access/org/auth: `orgs`, `app_user_profiles`, `coach_athletes`, `coach_invitations`
- athlete/read spine base: `athlete_profiles`, `connected_devices`, `physiological_profiles`, `biomarker_panels`
- training base: `planned_workouts`, `executed_workouts`, `training_import_jobs`
- devices/Garmin: `device_sync_exports`, `garmin_push_receipts`, `garmin_pull_jobs`, `garmin_athlete_links`
- nutrition nuova: `nutrition_product_catalog`, `food_diary_entries`, `nutrition_fdc_foods`
- knowledge/evidence: `knowledge_evidence_hits`, `knowledge_*`, `athlete_knowledge_*`, `session_knowledge_packets`, `knowledge_expansion_*`
- ops/billing/biomech: `manual_actions`, `athlete_update_locks`, `billing_*`, `stripe_webhook_events`, `biomech_*`
- interpretation staging (Pro 2 native): `interpretation_staging_runs`, `interpretation_staging_findings`, `interpretation_staging_commits`

Restano pero dipendenze reali del codice Pro 2 non coperte da migration Pro 2 pulite.

## P0 - Da Portare Prima

Queste tabelle sono priorita perche il codice Pro 2 le usa o le dichiara come fonte canonica.

| Tabella | Fonte V1 | Stato Pro 2 | Uso Pro 2 | Azione |
|---|---|---|---|---|
| `twin_states` | `supabase/migrations/001_empathy_canonical_schema.sql` | manca migration Pro 2 dedicata | `apps/web/app/api/training/engine/generate/route.ts`, twin/readiness dichiarato in UI builder | creare migration Pro 2 idempotente con indici e RLS owner/coach |
| `nutrition_plans` | `001_empathy_canonical_schema.sql` | manca migration Pro 2 dedicata | `apps/web/app/api/nutrition/route.ts`, `apps/web/app/api/nutrition/athlete-summary/route.ts`, dashboard hub | creare migration Pro 2 idempotente o sostituire uso con nuovo solver persistito |
| `nutrition_constraints` | `001_empathy_canonical_schema.sql` | manca migration Pro 2 dedicata | `apps/web/app/api/nutrition/athlete-summary/route.ts`, `apps/web/app/api/dashboard/athlete-hub/route.ts` | creare migration Pro 2 idempotente, poi allineare con `athlete_profiles.nutrition_config` |
| `media_assets` | `012_media_assets_catalog.sql`, `013_media_assets_quality_ops.sql` | manca migration Pro 2 dedicata | `apps/web/app/api/nutrition/media/route.ts`, fueling/packshot media | creare migration Pro 2 idempotente con campi quality ops e policy read/write |
| `load_series` | `001_empathy_canonical_schema.sql` | manca migration Pro 2 dedicata | necessario per storico carico interno/esterno e trend twin | creare migration Pro 2 solo se viene agganciato al read spine; altrimenti segnare come backlog |

## P0 - RLS / Policy Da Chiudere

Queste tabelle esistono in Pro 2, ma la parita RLS non e ancora abbastanza esplicita per un DB autonomo.

| Tabella | Stato | Rischio | Azione |
|---|---|---|---|
| `planned_workouts` | creata in `014_training_planned_executed_import_jobs_v1.sql` | accesso affidato soprattutto a route/service role | aggiungere RLS owner/coach coerente con `app_user_profiles` + `coach_athletes` |
| `executed_workouts` | creata in `014_training_planned_executed_import_jobs_v1.sql` | dati reality sensibili senza policy Pro 2 dedicata | aggiungere RLS owner/coach |
| `training_import_jobs` | creata in `014_training_planned_executed_import_jobs_v1.sql` | job operativi da proteggere | preferire service role; read owner/coach se esposto |
| `metabolic_lab_runs` | creata in `015_read_spine_metabolic_and_evidence_v1.sql` | dati lab fisiologici sensibili | aggiungere RLS owner/coach |
| `physiological_profiles` | creata in `001_pro2_v1_canonical_prereq_read_spine.sql` | stato fisiologico canonico sensibile | verificare/aggiungere RLS owner/coach |
| `orgs` | creata in `000_pro2_orgs.sql`, RLS locked | ok service role, ma UI/admin deve essere esplicita | documentare accesso admin o policy read minimale per coach/admin |

## P1 - Da Portare Dopo Il P0

Queste completano audit, loop adattivo e compatibilita storica.

| Tabella | Fonte V1 | Valore Per Pro 2 | Azione |
|---|---|---|---|
| `empathy_events` | `001_empathy_canonical_schema.sql` | event log trasversale per loop adaptation e audit | portare come log append-only con service role + read owner/coach filtrato |
| `meals` | `001_empathy_canonical_schema.sql` | storico pasto strutturato legacy | valutare se mantenerla o sostituirla con `food_diary_entries` + meal plan solver output |
| `device_sync_exports` provider expansion | V1 `018_device_sync_exports_provider_expansion.sql`, `028_device_sync_exports_provider_ecosystem.sql` | provider ecosystem multi-device | confrontare con Pro 2 `005_device_sync_exports_provider_ecosystem.sql`; non duplicare se gia equivalente |
| `connected_devices` estensioni | V1 `001` + eventuali evoluzioni | registry device/provider | Pro 2 ha tabella base; verificare colonne per Oura/Whoop/Strava |

## P2 - Da Valutare, Non Copiare Alla Cieca

| Area | Stato | Decisione |
|---|---|---|
| `knowledge_*` | Pro 2 ha gia migration `018_knowledge_library_and_research_traces_v1.sql` | fare confronto colonna-per-colonna solo se emerge errore runtime |
| `billing_*` | Pro 2 ha gia migration `019_billing_stripe_v1.sql` | verificare solo webhook/policy production |
| `biomech_*` | Pro 2 ha schema `020`/`021`, applicazione ancora parziale | non aggiungere altro schema prima di API/UI reali |
| `aerodynamic_tests` | documentata/route in V1, non centrale in Pro 2 | rimandare a modulo aerodynamics reale |

## Matrice Modulo -> Gap DB

| Modulo Pro 2 | Tabelle gia ok | Gap DB | Priorita |
|---|---|---|---|
| Profile / access | `athlete_profiles`, `app_user_profiles`, `coach_athletes`, `orgs` | policy `orgs`/admin da documentare | P0 RLS |
| Training / builder | `planned_workouts`, `executed_workouts`, `training_import_jobs` | RLS esplicite + `twin_states` | P0 |
| Twin / adaptation | `physiological_profiles`, `systemic_modulation_snapshots` | `twin_states`, `load_series`, `empathy_events` | P0/P1 |
| Nutrition meal plan | `food_diary_entries`, `nutrition_fdc_foods`, `nutrition_product_catalog` | `nutrition_plans`, `nutrition_constraints`, eventuale `meals` decision | P0/P1 |
| Fueling | planned sessions + physiology + profile | nessuna nuova tabella immediata; dipende da `media_assets` per packshot | P0 media |
| Devices | `device_sync_exports`, `garmin_*`, `connected_devices` | provider registry esteso, RLS/event log generico | P1 |
| Health / physiology | `biomarker_panels`, `metabolic_lab_runs` | RLS `metabolic_lab_runs`, parita panels verificata | P0 RLS |
| Knowledge | `knowledge_*`, `knowledge_evidence_hits` | L2 staging non ancora schema | prossimo punto architetturale |
| Biomechanics / aerodynamics | `biomech_*` per biomech | aerodynamics reale non schema Pro 2 | P2 |

## Migration Candidate Order

Ordine consigliato dopo `025_nutrition_fdc_food_cache.sql`:

1. `026_v1_remaining_core_state_tables.sql` [implemented]
   - `twin_states`
   - `load_series`
   - `empathy_events`

2. `027_v1_nutrition_plan_compat.sql` [implemented]
   - `nutrition_constraints`
   - `nutrition_plans`
   - decisione esplicita su `meals`

3. `028_media_assets_catalog_v1.sql` [implemented]
   - `media_assets`
   - campi quality ops da V1 `013`
   - policy read all / write authenticated o admin, da decidere

4. `029_training_and_lab_rls_hardening.sql` [implemented]
   - RLS `planned_workouts`
   - RLS `executed_workouts`
   - RLS `training_import_jobs`
   - RLS `metabolic_lab_runs`
   - eventuale RLS `physiological_profiles`

5. `030_interpretation_staging.sql` [implemented]
   - non e import V1: e il primo schema nuovo Pro 2 per orchestratore AI multilivello
   - tabelle: `interpretation_staging_runs`, `interpretation_staging_findings`, `interpretation_staging_commits`

## Criteri Di Accettazione

Una tabella e considerata "parity clean" quando:

- esiste in migration Pro 2, non solo nel DB condiviso;
- e idempotente su DB gia migrato da V1;
- ha indici minimi usati dalle query Pro 2;
- ha RLS esplicita o una nota service-role-only motivata;
- ha almeno una route o resolver Pro 2 che la usa, oppure una decisione scritta di backlog.

## Domande Aperte

1. `nutrition_plans` rimane storage canonico o diventa solo compatibilita legacy mentre il piano vive in `athlete_profiles.nutrition_config` + solver?
2. `meals` va mantenuta o sostituita interamente da `food_diary_entries` e output meal-plan deterministic?
3. `load_series` deve essere materializzata da Garmin/executed workouts o calcolata on demand nel twin resolver?
4. `media_assets` deve essere scrivibile da coach/authenticated o solo da service role/admin?
5. `empathy_events` deve diventare il log comune anche per interpretation staging e device jobs?

## Prossimo Step

Prima migration concreta consigliata: `026_v1_remaining_core_state_tables.sql`, con `twin_states`, `load_series`, `empathy_events` e RLS minima owner/coach. Questa sblocca il nucleo del loop:

`reality -> compute -> twin -> adaptation -> event log`
