# Empathy Pro 2 — Smoke checklist (build + risultati)

**Repo:** `empathy-pro-2-cursor` · **App:** `apps/web`  
**Contesto:** verifica che l’app **compili**, **parta** e, con Supabase configurato, che i flussi principali **tornino dati** (non solo pagine vuote).  
**Allineamento:** `docs/EMPATHY_OPERATIONAL_REALIZATION_MAP.md`, `docs/MODULE_FETCH_AUDIT_PRO2.md`.

---

## A — Gate automatici (nessun browser)

Esegui dalla **root del monorepo** (`empathy-pro-2-cursor/`).

| # | Comando | Esito atteso |
|---|---------|----------------|
| A1 | `npm run verify` | Exit code **0** (typecheck workspace + lint + build produzione `apps/web`) |
| A2 | (opzionale) `npm run dev:clean` poi `npm run dev` | Console: `Ready`, URL `http://localhost:3020` (o **3021+** se 3020 occupata) |

**Probe HTTP** (server dev avviato):

| # | Richiesta | Esito atteso |
|---|-----------|----------------|
| A3 | `GET /api/health` | JSON `ok: true`, campo `version` presente |
| A4 | `GET /` | Status **200** (home marketing / scaffold) |

Su Windows PowerShell: `Invoke-RestMethod -Uri http://localhost:<porta>/api/health`.

---

## B — Sessione e atleta (con Supabase)

**Prerequisito:** `apps/web/.env.local` con almeno `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (stesso progetto di V1 se condividi il cloud).  
Con env pubblico valorizzati, il middleware **protegge** le route modulo (`/dashboard`, `/training`, …): senza login si viene mandati a `/access?next=…`.

| # | Passo | Esito atteso |
|---|--------|----------------|
| B1 | Apri `/access`, login (magic link o provider configurato in Supabase) | Redirect verso `next=` o dashboard; nessun loop infinito |
| B2 | Dopo login, `GET /api/auth/session` (da DevTools → Network, o stesso cookie in curl) | Risposta coerente con utente autenticato |
| B3 | Seleziona / crea atleta attivo (shell + `use-active-athlete` / ensure profile) | UI mostra un `athleteId` effettivo (non bloccato su “nessun atleta”) |

---

## C — Spina lettura e hub

| # | Azione | API / UI | Esito atteso |
|---|--------|----------|----------------|
| C1 | Dashboard | `GET /api/dashboard/athlete-hub?athleteId=<id>` | **200**, payload con hub (niente errore generico 500 ripetuto) |
| C2 | Memoria aggregata | `GET /api/athlete-memory?athleteId=<id>` | **200**, oggetto memoria (anche parziale); utile per vedere `readSpineCoverage` se esposto lato client tramite altre viste |
| C3 | Profilo | Apri modulo Profile / strip fisiologia | `GET /api/physiology/profile` o `GET /api/profile` **200** con dati o fallback controllato |

*Nota:* per chiamate API autenticate da terminale, copia il cookie di sessione dal browser (`sb-…-auth-token` / cookie Supabase SSR del progetto) oppure usa solo la UI.

---

## D — Training: calendario ↔ builder ↔ scrittura

| # | Azione | API / percorso | Esito atteso |
|---|--------|----------------|--------------|
| D1 | Calendario training | UI `/training/calendar` → `GET /api/training/planned-window?athleteId=&from=&to=` | **200**, `planned` / `executed` array (anche vuoti ma struttura valida) |
| D2 | Builder | Genera sessione (UI `/training/builder`) → `POST /api/training/engine/generate` | **200**, payload con struttura sessione / summary (TSS o blocchi secondo contratto) |
| D3 | Salva su calendario | Da UI “salva / calendario” o `POST /api/training/planned/insert` | **200**; nuova riga visibile in calendario o in `planned-window` per quella data |
| D4 | VIRYA | UI `/training/vyria` o virya → `GET /api/training/virya-context?athleteId=` | **200**, campi tipo `strategyHints`, `physiology`, `readSpineCoverage` (trace persistence può essere vuota se manca knowledge foundation — non è necessariamente fallimento) |

---

## E — Nutrizione (deterministico)

| # | Azione | API | Esito atteso |
|---|--------|-----|----------------|
| E1 | Modulo nutrition / meal plan | `POST /api/nutrition/intelligent-meal-plan` (body come dalla UI) | **200**, piano con slot/alimenti o messaggio di validazione chiaro (non 500 silenzioso) |
| E2 | Diario (se usato) | `GET/POST /api/nutrition/diary` | Coerente con atleta |

---

## F — Interpretazione (senza numeri “inventati” da LLM)

| # | Azione | API | Esito atteso |
|---|--------|-----|----------------|
| F1 | Multiscala | `GET /api/knowledge/multiscale-bottleneck?athleteId=<id>` | **200**, `bottleneck` / `snapshot` (da stato fisiologia/twin) |
| F2 | PubMed / knowledge (se provato dalla UI Physiology) | `GET /api/knowledge/pubmed?…` | **200** o errore configurazione chiaro (es. chiavi mancanti) |

---

## G — Dati Supabase “solo SQL demo”

Se nel DB ci sono `planned_workouts` da script V1 (`[DEMO_*]`, `mario-rova-demo`, …), il calendario può essere **pieno** ma **senza** `BUILDER_SESSION_JSON::` nelle note: è atteso. Vedi `docs/LOCAL_DEV_WITH_V1.md` § “Stesso Supabase”.

---

## Criteri di successo minimi

- **A1–A4** tutti ok → piattaforma **operativa a livello release engineering**.  
- **B–D** ok con un atleta reale → **dialogo moduli ↔ API ↔ DB** verificato su training.  
- **E–F** ok → nutrizione deterministico + strato interpretazione raggiungibili.

---

## Cosa questa checklist non sostituisce

- Test E2E automatici (Playwright): **non** sono ancora nel `package.json` del monorepo; questa lista è **manuale**.  
- Carico, sicurezza RLS completa, regressione cross-browser: fuori scope smoke breve.

---

*Aggiornare dopo ogni onda che cambia route critiche o auth.*
