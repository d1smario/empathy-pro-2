# Empathy Pro 2.0

Greenfield repository per la prossima generazione della piattaforma **EMPATHY**: performance, adattamento metabolico, dati interni + evidenza scientifica, non solo metriche esterne.

**Questa directory (`empathy-pro-2-cursor`) è il clone di lavoro canonico** collegato a [GitHub](https://github.com/d1smario/empathy-pro-2). Non tenere una seconda copia parallela dello stesso repo sulla stessa macchina (file e commit si sdoppiano). Opzionale: rinomina questa cartella in `empathy-pro-2` e aggiorna `EMPATHY.code-workspace` in `Documenti\EMPATHY`.

## Documenti guida (leggere in ordine)

| File | Contenuto |
|------|------------|
| [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) | **Charter prodotto** — domini scientifici, differenziazione, fasi, multi-disciplina |
| [`docs/COMMERCIAL_AND_ROLES.md`](docs/COMMERCIAL_AND_ROLES.md) | Stripe, atleta/coach, SKU biomeccanica/aerodinamica, bioimpedenza |
| [`CONSTITUTION.md`](CONSTITUTION.md) | Invarianti tecnici + principi non negoziabili |
| [`docs/PLATFORM_STRUCTURE_SUMMARY.md`](docs/PLATFORM_STRUCTURE_SUMMARY.md) | Sintesi 4 piani, memoria, generazione, Stripe/home |
| [`docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`](docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md) | Memoria unica per `athlete_id`, coach = accesso |
| [`docs/INGEST_DEVICE_AND_LAB_MATRIX.md`](docs/INGEST_DEVICE_AND_LAB_MATRIX.md) | Device, CGM, lab, adapter; Stripe vs twin |
| [`docs/TECHNICAL_BLUEPRINT.md`](docs/TECHNICAL_BLUEPRINT.md) | Scheletro repo, layer, assorbimento da V1 |
| [`docs/DESIGN_SYSTEM_AND_FIGMA.md`](docs/DESIGN_SYSTEM_AND_FIGMA.md) | **Grafica / Figma (canonico 2.0)** — token, UI grade A, viewport 3D |
| [`docs/PLATFORM_AND_DEPLOY.md`](docs/PLATFORM_AND_DEPLOY.md) | Cursor, GitHub, **Supabase**, **Vercel**, segreti LogMeal/Spline |
| [`docs/P0_VERCEL_DEPLOY_CHECKLIST.md`](docs/P0_VERCEL_DEPLOY_CHECKLIST.md) | **P0 deploy:** checklist Vercel (branch `master`, root `apps/web`, webhook, build) |
| [`docs/ARCHITECTURE_SAFETY_AND_RISKS.md`](docs/ARCHITECTURE_SAFETY_AND_RISKS.md) | Coerenza generazione, rischi crash, mitigazioni |
| [`docs/NUTRITION_FOOD_DIARY_USDA_PIPELINE.md`](docs/NUTRITION_FOOD_DIARY_USDA_PIPELINE.md) | Diario alimentare + USDA (allineamento con V1) |
| [`docs/INTEGRATIONS_LOGMEAL.md`](docs/INTEGRATIONS_LOGMEAL.md) | Diario alimentare AI (**solo 2.0**) |
| [`docs/INTEGRATIONS_SPLINE.md`](docs/INTEGRATIONS_SPLINE.md) | Esercizi e asset **3D** (stile MyFit Coach) |
| [`docs/v2/SKELETON_CHECKLIST.md`](docs/v2/SKELETON_CHECKLIST.md) | Checklist primo codice |
| [`docs/LOCAL_DEV_WITH_V1.md`](docs/LOCAL_DEV_WITH_V1.md) | Due finestre Cursor, porte, convivenza con V1 |
| [`docs/PRO2_SMOKE_CHECKLIST.md`](docs/PRO2_SMOKE_CHECKLIST.md) | **Smoke manuale** — verify, health, login, training/nutrition/API fino a risultati |
| [`docs/AGENT_STATIC_CONTEXT_PRO2.md`](docs/AGENT_STATIC_CONTEXT_PRO2.md) | **URL fissi** (GitHub, localhost 3020, Vercel production), branch, trigger riallineamento — per agent senza memoria tra sessioni |
| [`docs/WORKSTREAM_AFTER_REALIGN.md`](docs/WORKSTREAM_AFTER_REALIGN.md) | **Linea di lavoro** post-riallineamento (P0 deploy → P1… smoke); un punto alla volta |
| [`docs/CURSOR_REALIGN_HOWTO.md`](docs/CURSOR_REALIGN_HOWTO.md) | **Dove e come** usare i testi di riallineamento (Settings vs chat) |
| [`docs/CURSOR_REALIGN_DAILY.md`](docs/CURSOR_REALIGN_DAILY.md) | Blocco breve quotidiano (bussola repo + generativo + UI Pro 2) |
| [`docs/CURSOR_REALIGN_DEEP.md`](docs/CURSOR_REALIGN_DEEP.md) | Riallineamento profondo se la sessione è fuori rotta |
| [`docs/PRO2_UI_PAGE_CANON.md`](docs/PRO2_UI_PAGE_CANON.md) | Canone pagina prodotto (modello **Training Builder** rich) |

**Mirror V1:** gli stessi tre file `CURSOR_REALIGN_*` vivono anche in `nextjs-empathy-pro/docs/` (vedi HOWTO).

## App web (`apps/web`)

### Stato operativo (check rapido)

Dalla **root del monorepo**, dopo `npm install`:

1. Copia `apps/web/.env.example` → `apps/web/.env.local` e compila almeno **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) per login e API dati. Per integrazione con lo stesso cloud di V1, riusa le stesse chiavi di `nextjs-empathy-pro/.env.local`.
2. Verifica build + tipi + lint: `npm run verify` (su **Windows/OneDrive** pulisce `.next` prima del build per evitare errori `readlink` / symlink corrotti). Se `verify` è verde, l’app Pro 2 è **operativa** a livello di build; il passo mancante è solo configurazione/env e avvio dev.
3. Avvio dev: `npm run dev` oppure doppio click su **`start-dev.cmd`** (stessa cartella del monorepo).

**Calendario vs builder con DB condiviso:** molte righe `planned_workouts` create da **seed SQL** in V1 (`supabase/DEMO_*.sql`, ecc.) non hanno il marker `BUILDER_SESSION_JSON::` — sono dati sintetici per analisi, non sessioni materializzate da Builder/Virya. Vedi `docs/LOCAL_DEV_WITH_V1.md` § “Stesso Supabase”.

Dalla **root del monorepo**:

```bash
npm install
npm run dev
```

**Porta di sviluppo:** `npm run dev` parte da **3020** (non usa la 3000 di V1). Se **3020** è occupata, lo script prova **3021, 3022, …** automaticamente: guarda l’URL stampato in console (`Local: http://localhost:…`).

- Home: `http://localhost:<porta>/`
- Preview: `http://localhost:<porta>/preview`

`npm run dev:fixed` forza **3020** (fallisce se occupata). `npm run dev:3000` forza **3000**.

**Variabile d’ambiente:** la porta iniziale è **`EMPATHY_PRO2_DEV_PORT`** (default **3020**). Non usiamo `PORT` generico perché spesso è impostato a `3000` a livello di sistema e confonde Pro 2.0 con V1.

Next viene avviato dalla root del monorepo (evita `ENOWORKSPACES` con npm 11).

Prima di `npm run dev`, se compare errore su `.next` (Windows/OneDrive): `Remove-Item -Recurse -Force .\apps\web\.next`.

- **`/`** — scaffold + link alla preview.
- **`/preview`** — demo UI marketing (matrice Figma, **dati dimostrativi**), Tailwind + Recharts + Motion.

```bash
npm run build          # build produzione (apps/web/.next)
npm run build:clean    # consigliato se il build fallisce (OneDrive / cache)
npm run lint
npm run typecheck      # tutti i workspace
npm run verify         # typecheck + lint + clean + build
```

## Prerequisiti monorepo

- **npm 7+** (protocollo `workspace:*`). Con npm 6: `npm install -g npm@10` oppure Node 20+.

## Rapporto con Empathy V1

Il codice operativo V1 resta in **`nextjs-empathy-pro`** (repo sorella). Migrazione: `docs/MIGRATION_FROM_V1.md`.

**Lavorare su V1 e Pro 2.0 insieme senza conflitti:** apri **due finestre Cursor** (due sessioni), una cartella per repo — vedi [`docs/LOCAL_DEV_WITH_V1.md`](docs/LOCAL_DEV_WITH_V1.md). Il workspace multi-root `EMPATHY.code-workspace` va bene per navigare il codice; per i `npm run dev` è più sicuro separare le finestre o tenere una sola app in esecuzione.

## GitHub

Repository remoto: [https://github.com/d1smario/empathy-pro-2](https://github.com/d1smario/empathy-pro-2).
