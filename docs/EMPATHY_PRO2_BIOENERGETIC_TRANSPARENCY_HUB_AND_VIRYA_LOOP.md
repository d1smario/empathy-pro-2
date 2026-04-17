# EMPATHY Pro 2 — Hub bioenergetico (trasparenza) e loop giorno → VIRYA → builder

**Repo:** `empathy-pro-2-cursor` · **Non** sostituisce `CONSTITUTION.md` né `docs/ARCHITECTURE.md`: incarna scelte prodotto già lì (un solo builder di sessione, VIRYA per struttura di piano, `Reality > Plan`).

## 1. Scopo del documento

Definire in un solo posto:

1. **Hub bioenergetico** = superficie **solo lettura** che mostra **provenienza e effetto** dei segnali operativi (twin, recovery, modulazione bioenergetica, loop adattamento, dial nutrizione/fueling), **senza** diventare un secondo motore generativo.
2. **Pipeline operativa** = ordine causale consentito tra **realtà del giorno**, **VIRYA** (carico / micro-aggiustamenti piano) e **builder** (materializzazione sessione singola).

## 2. Ruoli canonici (nessun fork)

| Artefatto | Responsabilità | Piano |
|-----------|----------------|--------|
| **Digital twin + memoria atleta** | Stato atteso/osservato, driver, segnali diario | Compute + Ingest |
| **`resolveOperationalSignalsBundle`** | Unica catena: guidance → contesto giornata → loop rigenerazione → modulazione bioenergetica → dial nutrizione | Compute |
| **VIRYA** (`/training/vyria`, orchestratori annuali) | Fasi, distribuzione stimoli, **ritune** del programma quando i segnali superano soglie; **non** sostituisce il builder per il dettaglio blocco-esercizio | Application + struttura piano |
| **Builder** (`/training/builder`, engine generate) | **Unica** generazione canonica della **singola sessione** | Compute / Application verso DB |
| **Pathway / settori meal** | Interpretazione (copy, target funzionali, filtri catalogo) | Interpretation |

## 3. Due superfici di adattamento, un solo convoglio (anti-doppione)

In Pro 2 convivono due modi legittimi di parlare di “adattamento”, che **non** devono diventare due motori numerici paralleli.

| Superficie | Cosa legge | Cosa fa (senza fork) |
|------------|------------|----------------------|
| **Dashboard / hub operativo** | Memoria atleta, twin, esecuzione vs piano, recovery → **punteggio / semaforo / loop** (`resolveOperationalSignalsBundle`, dial nutrizione) | **Compute deterministico**: scala carico, suggerisce `nextAction` sul piano, alimenta VIRYA e nutrizione **come input** — i numeri canonici passano da qui. |
| **Sistema generativo “largo”** (pathway, microbiota, epigenetica in roadmap, **AI** su PubMed / knowledge) | Stimoli testuali, meccanismi, evidenza, binding | **Interpretation** (+ staging L2): arricchisce **vincoli, rationale, filtri catalogo**, deposita **fatti strutturati** in memoria/trace **solo dopo** gate e conferma dove previsto — **non** ricalcola al posto del twin né riscrive il piano pasto o le sessioni. |

**Regola di convoglio:** tutto ciò che deve **cambiare** allenamento, nutrizione o piano in modo ripetibile converge su:

1. **Stesso substrato dati** (read spine, `athlete-memory`, profilo) — già allineato tra dashboard e moduli.
2. **Stessa catena Compute** per i numeri (bundle operativo, solver, builder).
3. **Un solo percorso di commit** verso stato persistente (memoria canonica, piano, profilo): l’interpretazione propone; **Compute + Application esplicita** applicano.

Così “adattamento multilivello” resta **multilivello narrativo e vincolante**, ma **monodirezionale** verso il generatore canonico — niente secondo punteggio nascosto che sovrascrive il primo.

## 4. Loop desiderato (giorno → VIRYA → programma; builder per sessione)

```text
Realtà giorno (esecuzione, diario, recovery, twin aggiornato)
        ↓
resolveOperationalSignalsBundle (e linee incrociate)
        ↓
┌───────────────────────────────────┐
│ Input strutturato a VIRYA         │  ← status loop, nextAction, divergenza, semaforo adattamento
│ (ritune microciclo / carico)      │     azioni esplicite utente/coach dove previsto
└───────────────────────────────────┘
        ↓
Programma calendario aggiornato (leggero: volumi, priorità, obiettivi giorno)
        ↓
Builder materializza la sessione del giorno richiesta (contract unico)
```

**Vincoli:**

- Il **builder** non deve aggiornare in silenzio la logica macro-VIRYA: eventuali write al piano passano da **VIRYA / calendario / memoria strutturata** come da contratti esistenti.
- L’**hub UI** non scrive in DB: solo lettura via `GET /api/dashboard/athlete-hub?includeOperationalSignals=1` (stessa verità di `GET /api/nutrition/module` sul bundle).

## 5. Dove vive in codice oggi

| Cosa | Dove |
|------|------|
| Bundle operativo | `apps/web/lib/dashboard/resolve-operational-signals-bundle.ts` |
| Linee incrociate training ↔ nutrizione | `apps/web/lib/platform/operational-dynamics-lines.ts` |
| Hub API (opzionale `includeOperationalSignals`) | `apps/web/app/api/dashboard/athlete-hub/route.ts` |
| Hub UI trasparenza (pagina dedicata) | `apps/web/app/(shell)/physiology/bioenergetics/page.tsx` → `BioenergeticTransparencyHubPageView` |
| Tabella audit sintetica (ledger) | `apps/web/lib/platform/bioenergetic-transparency-ledger.ts` (`buildInfluenceLedgerRowsFromOperationalBundle`) |
| Lettura client unificata hub + segnali | `apps/web/lib/dashboard/use-athlete-operational-hub.ts` + `athlete-hub-operational-contract.ts` (dashboard card e hub pagina) |
| Dashboard modulo · sezione operativa | `apps/web/components/navigation/StandardModuleSurface.tsx` (`id="dash-operational"`, `DashboardAthleteHubCard`) |

## 6. “Influence ledger” (audit, non generazione)

Righe **deterministiche** che collegano: **fonte Compute** → **consumatore** (nutrizione solver, VIRYA, builder come lettore di contesto) → **effetto sintetico** (numeri già calcolati nel bundle). Serve a coach e prodotto per verificare coerenza senza aprire il codice.

Estensioni future (separate da questo doc): persistenza su DB solo se serve export legale / storico; default resta **derivato on-demand** dal bundle.

## 7. Riferimenti incrociati

- `docs/EMPATHY_MULTILAYER_COMPLETE_ARCHITECTURE.md` — mappa piani e API.
- `docs/EMPATHY_PRO2_GENERATIVE_SYSTEM_ARCHITECTURE.md` — ingresso sistema generativo.
- `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md` — rete A/B, gap residui (es. grafo tempo post-workout verso composer).
- `docs/EMPATHY_OPERATIONAL_REALIZATION_MAP.md` — L1–L4 e spina lettura.
- `docs/PRO2_APPLICATION_READ_SPINE_AND_INTERPRETATION_STAGING.md` — convergenza interpretazione → memoria senza doppioni.

**Fine.**
