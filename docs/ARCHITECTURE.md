# EMPATHY Pro 2.0 — Architettura operativa

**Charter:** `docs/PRODUCT_VISION.md` · **Invarianti:** `CONSTITUTION.md` · **Sistema generativo Pro 2 (ingresso + link alla mappa multilayer):** `docs/EMPATHY_PRO2_GENERATIVE_SYSTEM_ARCHITECTURE.md` · **Mappa multilayer unica (organigramma + file + API):** `docs/EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md` · **Hub bioenergetico (trasparenza) + loop giorno → VIRYA → builder:** `docs/EMPATHY_PRO2_BIOENERGETIC_TRANSPARENCY_HUB_AND_VIRYA_LOOP.md` · **Sintesi struttura:** `docs/PLATFORM_STRUCTURE_SUMMARY.md` · **Memoria atleta / coach:** `docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md` · **Ingest device & lab:** `docs/INGEST_DEVICE_AND_LAB_MATRIX.md` · **Scheletro repo:** `docs/TECHNICAL_BLUEPRINT.md` · **Sicurezza integrazioni:** `docs/ARCHITECTURE_SAFETY_AND_RISKS.md` · **Deploy:** `docs/PLATFORM_AND_DEPLOY.md` · **Diario alimentare + USDA (spec condivisa con V1):** repo `nextjs-empathy-pro` → `docs/NUTRITION_FOOD_DIARY_USDA_PIPELINE.md`

## Piani (layer)

1. **Ingest** — adapter device, laboratorio, BIA; **LogMeal** (foto pasto → reality nutrizionale); eventi normalizzati / envelope di qualità.
2. **Compute** — motori versionati (fisiologia, bioenergetica); proiezione **digital twin**.
3. **Interpretation** — knowledge (corpus, meccanismi, binding), research trace, faccette deterministiche; AI solo interpretazione/orchestrazione.
4. **Application** — `apps/web` (e future API thin): moduli prodotto, auth, ruoli atleta/coach, Stripe; **Spline** per presentazione 3D esercizi (layer UI, non sorgente dati).  
   **Gate lettura atleta (Pro 2):** `requireAthleteReadContext` in `apps/web/lib/auth/athlete-read-context.ts` — stessa policy per route che leggono dati per `athleteId` (allineamento calendario / moduli / dashboard). **Staging interpretazione L2** (confronto prima del deposito in memoria canonica): `docs/PRO2_APPLICATION_READ_SPINE_AND_INTERPRETATION_STAGING.md`.

Flusso logico: ingest → compute → twin; ingest e twin alimentano knowledge; twin + knowledge → UI/API.

## Monorepo

- **`packages/contracts`** — tipi e contratti condivisi (portare da V1 in modo incrementale).
- **`packages/domain-*`** — logica di dominio e motori; non dipendono da React.
- **`packages/integrations-*`** — Stripe, Supabase, **LogMeal**, **Spline** (mapping + tipi; viewer spesso in `apps/web`).
- **`apps/web`** — Next.js: wiring, UI, route handler sottili.

## Regole di confine

- Un solo generatore canonico di **singola sessione** (builder); calendario operativo; niente motori paralleli per la stessa responsabilità.
- `Reality > Plan`, `Physiology > UI`, **carico interno > esterno**.
- Modifiche coach su dati atleta: permessi espliciti, audit (vedi `docs/COMMERCIAL_AND_ROLES.md`).
- **Memoria:** letture/scritture per `athlete_id` come da `docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`; **ingest** come da `docs/INGEST_DEVICE_AND_LAB_MATRIX.md`.

---

*Documento vivo: aggiornare quando cambiano piani dati o cutover da V1.*
