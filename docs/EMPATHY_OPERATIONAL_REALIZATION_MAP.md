# EMPATHY — Mappa operativa di realizzazione (spina lettura + generativo)

**Repo:** Empathy Pro 2 (`empathy-pro-2-cursor`). App Next in **`apps/web`**.

**Percorsi Pro 2 (divergenze da V1):**

- Copertura spina: `apps/web/lib/platform/read-spine-coverage.ts` — `summarizeReadSpineCoverage()`.
- Hub dashboard dati reali: `GET /api/dashboard/athlete-hub` → `apps/web/app/api/dashboard/athlete-hub/route.ts` (include `readSpineCoverage` quando la memoria è risolvibile).
- Memoria atleta: `GET /api/athlete-memory` → `apps/web/app/api/athlete-memory/route.ts`.
- Audit fetch client: `docs/MODULE_FETCH_AUDIT_PRO2.md`.

**Scopo:** rendere **operativo** il modello architetturale (loop chiuso, 4 livelli, regole generative) con fasi verificabili, non solo dichiarazioni.

**Fonti normative (V1 + Pro2):** `ARCHITECTURE_RULES.md` (se presente nel monorepo), `docs/ARCHITECTURE.md`, `.cursor/rules/empathy_generative_core.mdc` (allineamento con clone V1), documentazione ATHLETE_MEMORY in `docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`.

---

## 1. Modello di riferimento (allineamento)

### 1.1 Loop di prodotto (invariato)

`reality → physiology/bioenergetics (motori) → digital twin → training/nutrition/recovery → esecuzione → dato reale → confronto → adattamento → aggiornamento`

### 1.2 Quattro livelli (schema V1)

| Livello | Nome | Ruolo |
|--------|------|--------|
| **L4** | Data | Supabase, device, lab, knowledge grezze |
| **L3** | Physiology engine | Motori deterministici + risoluzione stato canonico |
| **L2** | AI / interpretazione | Retrieval, trace, memoria strutturata, orchestrazione — **non** sostituisce motori né builder canonico |
| **L1** | Application | Moduli UI + API che **consumano** twin/memory |

### 1.3 Regole generative da rispettare in ogni fase

- `Reality > Plan`, `Physiology > UI`, **internal load > external** dove definito.
- **Un solo** generatore canonico di **singola sessione**: `builder`; **calendario** = operativo; **VIRYA** struttura e richiede materializzazione al builder.
- **AI:** interpretazione + evidenza + scrittura in **athlete memory / trace**; rigenerazione numerica tramite **pipeline deterministiche** che leggono quella memoria + fisiologia/twin.
- **Stability-first:** niente redirect aggressivi dai moduli generativi.

---

## 2. Spina di lettura unica (obiettivo operativo)

**Definizione:** ogni modulo che ha bisogno dello stato atleta deve poter ottenere, in ordine di preferenza:

1. **`GET /api/athlete-memory?athleteId=`** — aggregato `resolveAthleteMemory` (profilo, fisiologia risolta, twin, reality recente, evidence items, audit).
2. **Modulo-dedicated API** che **internamente** riusano la stessa risoluzione (es. `GET /api/nutrition/module`, `GET /api/profile`, hub `GET /api/dashboard/athlete-hub`) — ammessi per payload specializzati, ma **non** devono duplicare logica di verità fisiologica.

**Anti-pattern da eliminare progressivamente:** pagina che ricostruisce FTP/VO2/soglie solo da stato locale o da endpoint paralleli non allineati al resolver.

**Copertura codificabile:** `summarizeReadSpineCoverage()` in `apps/web/lib/platform/read-spine-coverage.ts` — booleans su cosa è presente in `AthleteMemory` (dashboard hub, health check interno, QA).

---

## 3. Matrice modulo × dominio (stato attuale — indicativo)

Aggiornare questo blocco quando si chiudono le cuciture.

| Modulo | Legge athlete-memory / twin | API principali | Gap tipici |
|--------|-----------------------------|----------------|------------|
| **Dashboard** | Hub + `readSpineCoverage` + `resolveAthleteMemory` in parallelo | `GET /api/dashboard/athlete-hub` | KPI hub ancora da unificare con twin dove serve |
| **Training** | Come sopra + **`GET /api/training/planned-window`** arricchito con `readSpineCoverage` e `twinContextStrip` (parallelo a `resolveAthleteMemory`) | `planned-window`, `virya-context`, `analytics`, `training/*` | Strip fisiologia KPI ancora minima su calendar card |
| **Nutrition** | `nutrition/module` + memory | `/api/nutrition/module` | Pathway vs twin in evoluzione |
| **Health** | panels timeline / latest | `/api/health/*` | Biomarker → twin modulante |
| **Physiology** | Strip dashboard: `fetchCanonicalPhysiologyProfile`; history/snapshot | `/api/physiology/profile`, `/api/physiology/history`, `POST /api/physiology/snapshot` | `profile-latest` deprecato (solo compat) |
| **Profile** | `GET /api/profile` + memory | `profile` | Coerenza lab vs stima metabolic |
| **Knowledge** | Trace | `knowledge/*` | Convergenza verso memoria condivisa |

---

## 4. Fasi di realizzazione (ordine consigliato)

### Fase 0 — Baseline e gate (1 sprint)

- [ ] Smoke: auth, athlete context, moduli core senza redirect flicker (`empathy_stability_first`).
- [x] Documentare per ogni modulo **una** lista di fetch in ingresso (file view + service) — vedi `docs/MODULE_FETCH_AUDIT_PRO2.md`.
- [x] Usare `summarizeReadSpineCoverage` in **dashboard hub** (solo lettura) per visualizzare copertura.

**Exit:** checklist firmata + copertura visibile su almeno un ambiente demo.

### Fase 1 — Chiusura letture (Wave 2 del master plan)

- [ ] Ogni modulo “a consumo stato” chiama **prima** memory o API che wrappa `resolveAthleteMemory` / twin resolver (hub + builder + strip physiology: **fatto**; restano viste training calendar/session grezze su `planned-window`, ecc.).
- [x] Marcare `@deprecated` endpoint paralleli non allineati (`GET /api/physiology/profile-latest`); letture critiche su resolver canonico o profile.
- [ ] Allineare `apps/web/api/*/contracts.ts` ai payload reali.

**Exit:** nessun modulo prodotto critico dipende da baseline inventata in pagina se esiste profilo/twin.

### Fase 2 — Reality → twin (qualità ingest)

- [ ] Completare normalizzazione `apps/web/lib/reality/*` per le fonti attive.
- [ ] Ogni nuovo ingest aggiorna envelope + compare con twin.

**Exit:** executed/import mostra qualità copertura; twin non dipende da raw provider fragile.

### Fase 3 — Generativo deterministico end-to-end

- [x] Builder engine (`POST /api/training/engine/generate`) legge fisiologia tramite **`resolveCanonicalPhysiologyState`** (allineato a strip / profile API). VIRYA e altri entrypoint: da verificare.
- [ ] Nutrition meal paths consumano diary + vincoli + twin come da `docs/NUTRITION_FOOD_DIARY_USDA_PIPELINE.md`.
- [ ] Nessun nuovo “generatore sessione” parallelo (architecture gate).

**Exit:** test di integrazione su un flusso: memory → builder save → calendar → executed.

### Fase 4 — Strato interpretativo (L2) senza contaminazione L3

- [ ] Research trace → scrittura **audit + memoria**; builder contract coerente con knowledge.
- [ ] LLM / agent: solo estrazione strutturata e hop-link, mai override numeri motori.

**Exit:** tracciabilità da claim testuale a corpus/mechanism; twin invariato dai soli trace.

### Fase 5 — Nuovi dati / nuove funzioni (intelligenza sistemica)

Per **ogni** nuovo tipo di dato:

1. Schema + migrazione (se persistito).
2. Ingest + normalizzazione (reality).
3. Aggiornamento resolver o twin (L3).
4. Esposizione in `AthleteMemory` o contract modulo (L4→L1).
5. Solo dopo: UI e copy generativa (L2/L1).

**Exit:** checklist “nuovo dato” completata; nessun bypass del gate architetturale.

---

## 5. Prossimi passi immediati (ordine di esecuzione)

1. ~~**Visualizzazione copertura spina** nell’hub dashboard (`readSpineCoverage`).~~ **Fatto**
2. ~~**Audit statico:** `docs/MODULE_FETCH_AUDIT_PRO2.md`.~~ **Fatto** (rieseguire grep prima di PR che tocchi fetch)
3. ~~**Modulo pilota Training builder:** hint FTP/FC da `fetchProfileViewModel`.~~ **Fatto**
4. ~~**POST fisiologia sensibili:**~~ in Pro 2 l’unico `POST` su lab/profilo è `POST /api/physiology/snapshot` — già con `requireRequestAthleteAccess`. Scrittura profilo/twin altrove: cookie + `canAccessAthleteData` (es. `POST /api/training/engine/generate`). **Verificato**
5. **Documentare in PR** ogni chiusura di cucitura con riga aggiornata nella tabella §3 (questo file va aggiornato a ogni onda).
6. ~~**VIRYA + analytics:** fallback `resolveCanonicalPhysiologyState` se `memory.physiology` assente; Virya non fallisce più senza twin; `readSpineCoverage` su `virya-context` e `analytics`.~~ **Fatto**
7. ~~**planned-window + calendar/session/builder/card:** risposta con `readSpineCoverage` + `twinContextStrip`; UI `TrainingPlannedWindowContextStrip`; fetch con `buildSupabaseAuthHeaders` dove mancava.~~ **Fatto**
8. ~~**Strip fisiologia estesa** (`formatPhysiologicalProfileStrip`: soglie LT, vLamax, HRV, temp/glucosio baseline, economia) + **`includeAthleteContext=0|skip|…`** su `GET /api/training/planned-window` per saltare `resolveAthleteMemory` quando serve solo calendario.~~ **Fatto**
9. **Prossimo lavoro utile:** uso esplicito di `includeAthleteContext=0` da client ad alta frequenza se si misura latenza; test carico su `resolveAthleteMemory` in parallelo.

---

## 6. Metriche di successo (semplici)

- **Copertura memory:** `%` atleti demo con `profile + physiology + twin` non null in `summarizeReadSpineCoverage`.
- **Coerenza:** stesso `vo2max_ml_min_kg` / FTP tra Profile API e modulo Physiology dopo save.
- **Regressioni:** zero login loop / context loss dopo merge su moduli generativi.
- **Tracciabilità:** almeno un research trace collegato a sessione builder su scenario demo.

---

*Questo documento va aggiornato a ogni onda di stabilizzazione; è il collegamento operativo tra architettura dichiarata e lavoro in repo.*
