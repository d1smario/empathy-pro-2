# Mappa operativa — parità V1 → Empathy Pro 2 (`empathy-pro-2-cursor`)

**Obiettivo:** Pro 2 deve **fare tutto ciò che fa V1** su training, nutrition, physiology, profile, health, dashboard, bio, ecc.; poi evoluzione (multilivello, bioenergetica, VIRYA) senza violare i vincoli in `docs/CURSOR_REALIGN_DAILY.md` e `docs/EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md`.

**Repo V1:** `nextjs-empathy-pro` · **Repo Pro 2:** `empathy-pro-2-cursor` · **Deploy:** `docs/AGENT_STATIC_CONTEXT_PRO2.md`.

---

## Legenda stato

- [ ] non iniziato · [~] in corso · [x] fatto nel repo (migrazione / codice); **DB** = da applicare su Supabase progetto Pro 2
- **Blocca tutto** se mancano auth o `athlete_profiles` (read-spine / `resolveAthleteMemory`)

---

## Fase 0 — Allineamento operativo (ogni sprint)

- [x] Contesto statico e riallineamento: `docs/AGENT_STATIC_CONTEXT_PRO2.md`, `docs/CURSOR_REALIGN_DAILY.md`
- [ ] Stesso progetto Supabase tra locale e Vercel (`/api/health` → `supabaseHost` + `supabaseServiceRoleConfigured`)

---

## Fase L4 — Schema Supabase (parità dati con V1)

Ordine **consigliato** sul DB Pro 2 (file in `supabase/migrations/`):

| Step | File Pro 2 | Equivalente / fonte V1 | Scopo |
|------|------------|-------------------------|--------|
| L4.1 | `000_pro2_orgs.sql` | Pro 2 | Org seed |
| L4.2 | **`001_pro2_v1_canonical_prereq_read_spine.sql`** | `001` (estratti) + `004` + `009` | `athlete_profiles`, auth, device, fisiologia base, **`device_sync_exports`** prima di `005` |
| L4.3 | `002_coach_athletes_org_multitenant.sql` | Pro 2 + prereq `coach_athletes` | PK `org_id` |
| L4.4 | `003` … `008` | Garmin / export | Integrazioni |
| L4.5 | `009`–`010` Pro 2 | — | Email normalizzata atleta |
| L4.6 | `011_systemic_modulation_snapshots.sql` | Pro 2 L8 | Richiede `app_user_profiles` |
| L4.7 | `012`–`013` | Pro 2 | Garmin OAuth / permessi |
| L4.8 | **`014_training_planned_executed_import_jobs_v1.sql`** | `001` (training) + `016` + `017` | Calendario + import |
| L4.9 | **`015_read_spine_metabolic_and_evidence_v1.sql`** | `005` + `010` | `metabolic_lab_runs`, `knowledge_evidence_hits` |
| L4.10 | **`016_nutrition_catalog_and_food_diary_v1.sql`** | V1 `007` + `008` + `021` | Catalogo nutrizione + `food_diary_entries` |
| L4.11 | **`017_manual_actions_and_athlete_update_locks_v1.sql`** | V1 `014` + `015_athlete_update_locks` | Coda manual actions + lock aggiornamenti |
| L4.12 | **`018_knowledge_library_and_research_traces_v1.sql`** | V1 `019` + `020` | Knowledge library + research traces |
| L4.13 | **`019_billing_stripe_v1.sql`** | V1 `024` | `billing_*`, `stripe_webhook_events` + RLS |
| L4.14 | **`020_biomech_session_imports_and_capture_jobs_v1.sql`** | V1 `022` | Import biomech + coda capture jobs |
| L4.15 | **`021_biomech_capture_storage_bucket_v1.sql`** | V1 `023` | Bucket `biomech-capture` |
| L4.16 | **`022_metabolic_lab_vo2max_section_v1.sql`** | V1 `027` | Sezione `vo2max_lab` su `metabolic_lab_runs` |
| L4.17 | **`023_biomarker_panels_rls_v1.sql`** | V1 `006` | RLS `biomarker_panels` (dopo tabella in `001`) |

- [x] L4.2 `001` aggiunto (greenfield + DB già migrati: `IF NOT EXISTS` dove possibile)
- [x] L4.9 `015` aggiunto
- [x] L4.10–L4.17 `016`–`023` (L4.r: nutrition, manual/knowledge, billing, biomech, lab VO2, biomarker RLS)
- [ ] **DB:** eseguire su Supabase le migrazioni mancanti (vedi nota DB condiviso in L4.r; range file Pro 2 `016`–`023`)
- [ ] L4.r **Resto V1 non ancora in Pro 2:** `001` completo (nutrition `nutrition_*`, `meals`, `load_series`, `twin_states`, `empathy_events`…), V1 `018` device expansion export provider — **tracciare quando servono i moduli**

### L4.r — Backlog schema V1 → Pro 2 (dettaglio)

- [x] Nutrition (repo Pro 2): `016_nutrition_catalog_and_food_diary_v1.sql` (= V1 `007` + `008` + `021`)
- [x] Knowledge library + research traces (repo Pro 2): `018_knowledge_library_and_research_traces_v1.sql` (= V1 `019` + `020`). **Nota:** V1 `010`/`011` evidence + dedup restano coperti da `015_read_spine_metabolic_and_evidence_v1.sql` lato `knowledge_evidence_hits`; non duplicare senza verificare oggetti già creati.
- [x] Health / manual (repo Pro 2): `017_manual_actions_and_athlete_update_locks_v1.sql` (= V1 `014` + `015_athlete_update_locks`; non confondere con Pro 2 `015_read_spine_*`)
- [x] Billing (repo Pro 2): `019_billing_stripe_v1.sql` (= V1 `024`)
- [x] Biomech (repo Pro 2): `020_biomech_session_imports_and_capture_jobs_v1.sql`, `021_biomech_capture_storage_bucket_v1.sql` (= V1 `022` + `023`)
- [x] Lab VO2max section (repo Pro 2): `022_metabolic_lab_vo2max_section_v1.sql` (= V1 `027`; richiede `metabolic_lab_runs` da `015`)
- [x] Biomarker RLS (repo Pro 2): `023_biomarker_panels_rls_v1.sql` (= V1 `006`)

**DB condiviso già migrato da V1 (`001`…`031`):** le migrazioni Pro 2 `016`–`023` sono in gran parte **idempotenti** (`IF NOT EXISTS`, `ON CONFLICT DO UPDATE` sul bucket, `DROP CONSTRAINT IF EXISTS` + nuovo check su lab). Per **solo DDL** senza history Pro 2, incollale nell’**SQL Editor** (no-op se V1 ha già applicato gli equivalenti `024`, `022`–`023`, `027`, …).

**`supabase db push` dal clone Pro 2** su un progetto la cui history è stata creata **solo** da V1 fallisce con: *Remote migration versions not found in local migrations directory* (nomi file diversi tra i due repo). Opzioni: allineare la cartella `supabase/migrations` alla history remota (`supabase db pull` / repair secondo [Supabase CLI](https://supabase.com/docs/guides/cli/managing-environments)), oppure usare **un solo repo** come fonte di `db push` per quel progetto cloud. **Greenfield** solo Pro 2: `db push` dal clone Pro 2: `000`→`023`.

---

## Fase L3 / API — Parità route e contratti (`apps/web/app/api`)

Conta indicativa: V1 ~141 route, Pro 2 ~59. Allineamento **per modulo** (stesso contratto o deprecazione esplicita documentata qui).

- [~] **Training:** `GET /api/training/import-jobs` aggiunto (parità V1, auth `requireAthleteReadContext`). Restano `calendar` vs `planned-window`, `trend`, `session`, `builder/save`, `presentation-brief`, `engine/evidence-basis`, …
- [ ] **Nutrition:** `food-lookup`, `profile-config`, `device-export`, `media`, `catalog`, `usda-by-nutrient`, …
- [~] **Physiology:** route `POST/DELETE /api/physiology/vo2max-lab` + UI Metabolic profile (salvataggio in alto, VO₂max manuale/file gas, cross-check) allineati a V1; resto health aggregati da verificare
- [ ] **Profile / access:** `athletes`, `repair`, `access/*` vs Pro 2 `ensure-profile`, `roster`
- [ ] **Health:** `health/module`, `health/evidence`, `panels` vs Pro 2 `panels-latest`, `panels-timeline`
- [ ] **Dashboard:** `dashboard` vs `dashboard/athlete-hub`
- [~] **Knowledge:** `GET/POST /api/knowledge/research-traces`, `GET /api/knowledge/bindings` (stesso contratto V1 + store già in repo). Restano `research-plan`, `pubmed/ingest`, `corpus`, `mechanisms`, `omics`, `research-traces/hop-links`, …
- [~] **Biomechanics / billing / webhooks:** schema L4 `019`–`021` in repo; route Pro 2 già presenti (`/api/billing/*`, `/api/webhooks/stripe`, integrazioni) — verificare parità contratti con V1 modulo per modulo
- [x] **Manual actions (coda coach):** `GET/POST /api/manual-actions`, `PATCH /api/manual-actions/[id]` + `api/manual-actions/contracts` + `lib/coach-actions/manual-action-policy` (POST: `createdByUserId` deve coincidere con l’utente autenticato; GET/POST usano contesto atleta Pro 2)

---

## Fase UI / moduli (`apps/web/modules`, shell)

- [ ] Ogni modulo ufficiale rispetta `docs/PRO2_UI_PAGE_CANON.md` e parità funzionale con V1 dove dichiarato
- [ ] Nessun secondo generatore sessione; Builder + calendario come da regole

---

## Fase Interpretation / multiscala (dopo L4+L3 stabili)

- [ ] Knowledge + trace + bottleneck allineati a `docs/EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md`
- [ ] Hub bioenergetico / loop VIRYA: `docs/EMPATHY_PRO2_BIOENERGETIC_TRANSPARENCY_HUB_AND_VIRYA_LOOP.md`

---

## Esecuzione “punto per punto” (questa sessione)

1. [x] Aggiungere migrazione **`001_pro2_v1_canonical_prereq_read_spine.sql`** (prerequisito **prima** di `002`)
2. [x] Aggiungere migrazione **`015_read_spine_metabolic_and_evidence_v1.sql`**
3. [x] Aggiornare commento in `002_coach_athletes_org_multitenant.sql` (riferimento a `001`)
4. [x] L4.r — `016`–`023` (vedi tabella L4.10–L4.17 incluso `023_biomarker_panels_rls_v1`)
5. [ ] **Tu:** `supabase db push` dal clone Pro 2 **oppure** SQL Editor per `016`–`023` se la history migrazioni è gestita solo da V1 (vedi nota sopra).
6. [ ] Prossimo punto operativo consigliato: **L4.r** resto (V1 `018` device expansion export) **oppure** **Fase L3 API** (training import-jobs / manual-actions / knowledge research-plan & bindings) — vedi tabella L3.

---

*Ultimo aggiornamento: L4.r `016`–`023` (billing, biomech, VO2max, biomarker RLS).*
