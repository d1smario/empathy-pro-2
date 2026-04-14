# Pro 2 — Spina di lettura Application + staging interpretazione (L2)

**Status:** normativo per implementazione.  
**Incrocia:** `docs/ARCHITECTURE.md` (4 piani), `docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`, `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md`, `docs/EMPATHY_OPERATIONAL_REALIZATION_MAP.md`.

---

## 1. Perché non era “dal primo giorno” nel codice

Il **modello generativo** (Ingest → Compute → Interpretation → Application) e la **memoria atleta unica** sono definiti da tempo in costituzione e documentazione Pro 2 / V1.  
L’implementazione è cresciuta **per incrementi**: prima shell UI e route “utili”, poi integrazioni device, poi cuciture tra moduli. Sono rimasti **due stili di gate** sulle API (Bearer-only `request-auth` vs cookie+Bearer+service role `training-route-auth`), e letture tabella senza la stessa policy — esattamente l’anti-pattern che `docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md` vieta come “bypass”.

**Obiettivo ora:** codificare in **un solo entry point** (`@/lib/auth/athlete-read-context`) ciò che i documenti già chiedevano: *una linea di accesso ai fatti per `athlete_id`*, allineata al calendario operativo e alla memoria.

Questo **non sostituisce** i 4 piani: è il **sottostrato Application** che garantisce che UI e orchestrazioni leggano dati con la stessa autorità, prima ancora di Interpretation / AI.

---

## 2. Dove si colloca nel modello a 4 piani

| Piano | Cosa abbiamo fissato in codice | Note |
|--------|--------------------------------|------|
| **Ingest** | (invariato) adapter + envelope | |
| **Compute** | (invariato) motori, twin, solver | |
| **Interpretation** | *Staging L2* (vedi §4) | AI confronta e propone; non committa verità canonica da sola |
| **Application** | **`requireAthleteReadContext`** + `resolveAthleteMemory` / API che li riusano | Gate identità + `canAccessAthleteData` + client DB lettura; poi domini |

Flusso consigliato per una route modulo che legge DB:

1. `requireAthleteReadContext(req, athleteId)` → `db` (+ errori `AthleteReadContextError`).
2. Query su tabelle operative / aggregati usando `db`.
3. Se serve stato già fuso: `resolveAthleteMemory(athleteId)` (o equivalente server-side), **dopo** il gate — così non si espone lavoro senza autorizzazione.

---

## 3. Convergenza: niente dati “per conto proprio”

**Stato (wave Application):** le route prodotto sotto `apps/web/app/api/` che leggevano/scrivano per `athleteId` con `requireRequestAthleteAccess` sono migrate a `requireAthleteReadContext` (GET / letture) o `requireAthleteWriteContext` (POST/insert/update/delete). La funzione legacy resta in `request-auth.ts` per eventuali script o route speciali; **non** usarla per nuove API modulo.

**Restano da vigilare:**

- UI che trattano come verità numeri o sessioni **solo** da stato React se esiste twin / calendario / memoria canonica.
- Route **non** sotto `app/api` (se aggiunte) o integrazioni webhook senza sessione utente.

**Verifica pratica:** `docs/MODULE_FETCH_AUDIT_PRO2.md`; grep `requireRequestAthleteAccess` dovrebbe colpire solo `lib/auth/request-auth.ts` e commenti.

---

## 4. Memoria intermedia (L2 / multilivello AI)

L’AI multilivello deve poter:

1. **Leggere** più sorgenti (memoria atleta, knowledge, reality, output compute) già autorizzate.
2. **Confrontare** (coerenza, lacune, conflitti, confidenza) in uno **spazio di lavoro** che **non** è la memoria canonica finale.
3. **Depositare** in memoria comune atleta solo **fatti strutturati validati** (trace, evidence link, campi profilo con audit), come da regole generative.

**Staging interpretazione (concetto):**

- **Input:** snapshot letti tramite Application gate + eventuali retrieval knowledge.
- **Output candidato:** proposte strutturate (JSON), diff rispetto allo stato attuale, note di evidenza.
- **Commit:** transizione esplicita → tabelle / resolver che alimentano `AthleteMemory` (o estensioni audit), mai “solo chat” come store di verità.

Contratto TypeScript di riferimento (ancora implementazione parziale consentita):  
`apps/web/lib/memory/interpretation-staging-contract.ts`.

**Regola:** lo staging **non** genera numeri canonici di sessione/piano pasto/twin; produce **input** per pipeline deterministiche o **metadati** interpretativi tracciati.

---

## 5. Riferimenti file codice

| Artefatto | Path |
|-----------|------|
| Gate Application unico | `apps/web/lib/auth/athlete-read-context.ts` |
| Implementazione sottostante | `apps/web/lib/auth/training-route-auth.ts` |
| Accesso atleta | `apps/web/lib/athlete/can-access-athlete-data.ts` |
| Finestra calendario condivisa | `apps/web/lib/training/planned-executed-window-query.ts` |
| Copertura read-spine | `apps/web/lib/platform/read-spine-coverage.ts` |

---

*Aggiornare questo file quando si chiude la migrazione completa delle API da `requireRequestAthleteAccess` o quando lo staging L2 ottiene persistenza dedicata (tabella / namespace) in Supabase.*
