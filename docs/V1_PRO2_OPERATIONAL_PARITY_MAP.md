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

- [x] L4.2 `001` aggiunto (greenfield + DB già migrati: `IF NOT EXISTS` dove possibile)
- [x] L4.9 `015` aggiunto
- [ ] **DB:** eseguire su Supabase **Empatia-Pro-2.0** le migrazioni mancanti (o `supabase db push` dal clone)
- [ ] L4.r **Resto V1 non ancora in Pro 2:** `001` completo (nutrition `nutrition_*`, `meals`, `load_series`, `twin_states`, `empathy_events`…), `006` biomarker RLS, `007–008` catalogo nutrizione, `014–015` manual actions / locks, `018` device expansion, **`019–020` knowledge library**, `021` food diary, `022–023` biomech, `024` Stripe, `027` lab VO2 — **tracciare in sotto-sezioni sotto quando servono i moduli**

### L4.r — Backlog schema V1 → Pro 2 (dettaglio)

- [ ] Nutrition: `007_nutrition_product_catalog.sql`, `008_*_write_policy.sql`, `021_food_diary_entries.sql`
- [ ] Knowledge: `019_knowledge_library_foundation.sql`, `020_knowledge_research_traces.sql`, `010`/`011` (dedup) se non coperti solo da `015` evidence
- [ ] Health / manual: `014_manual_actions_queue.sql`, `015_athlete_update_locks.sql` (V1 naming; non confondere con Pro2 `015_read_spine_*`)
- [ ] Billing: `024_billing_stripe.sql`
- [ ] Biomech: `022_*`, `023_*`

---

## Fase L3 / API — Parità route e contratti (`apps/web/app/api`)

Conta indicativa: V1 ~141 route, Pro 2 ~59. Allineamento **per modulo** (stesso contratto o deprecazione esplicita documentata qui).

- [ ] **Training:** `calendar` (V1) vs `planned-window` (Pro 2) — già documentato in `CURSOR_REALIGN_DAILY.md`; altre: `import-jobs`, `trend`, `session`, `builder/save`, `presentation-brief`, `engine/evidence-basis`, …
- [ ] **Nutrition:** `food-lookup`, `profile-config`, `device-export`, `media`, `catalog`, `usda-by-nutrient`, …
- [ ] **Physiology:** `vo2max-lab`, moduli health aggregati
- [ ] **Profile / access:** `athletes`, `repair`, `access/*` vs Pro 2 `ensure-profile`, `roster`
- [ ] **Health:** `health/module`, `health/evidence`, `panels` vs Pro 2 `panels-latest`, `panels-timeline`
- [ ] **Dashboard:** `dashboard` vs `dashboard/athlete-hub`
- [ ] **Knowledge:** `research-traces`, `research-plan`, `pubmed/ingest`, `bindings`, …
- [ ] **Biomechanics / billing / webhooks:** porting dove il prodotto Pro 2 deve egualiare V1

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
4. [ ] **Tu:** applicare le migrazioni sul progetto Supabase Pro 2 (`supabase db push` dal clone **oppure** SQL Editor incollando i file in ordine) e ridistribuire Vercel. Se il DB era nato senza `001`, la prima `db push` applicherà `001` **retroattivamente** (idempotente); verificare che non ci siano conflitti con oggetti creati a mano con nomi uguali.
5. [ ] Prossimo punto operativo consigliato: **L4.r nutrition** oppure **Fase API Training** (scegli priorità prodotto)

---

*Ultimo aggiornamento: mappa creata insieme alle migrazioni `001` e `015` in repo.*
