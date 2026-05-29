# Vitality / EPI — protocollo di certificazione & validazione dell'efficacia

> Come l'Empathy Physiological Index (EPI) e gli Empathy Coin sono progettati per essere
> **certificabili** e per **dimostrare efficacia** (meno assenze lavorative, miglior stato
> psicofisico, marker metabolici migliori) nel tempo. Complementare al design in
> `VITALITY_HEALTH_INDEX_AND_COIN.md` (sez. 5). Allineato a `empathy_generative_core.mdc`
> (motori deterministici, AI solo interpretazione) e `empathy_schema_whole_picture.mdc`.

## 1. Principi di certificabilità

1. **Determinismo.** L'EPI è una funzione pura (`apps/web/lib/epi/epi-engine.ts`): stessi input →
   stesso output. Nessun numero è prodotto dall'AI. Questo rende ogni punteggio **riproducibile** e
   verificabile da un auditor.
2. **Versioning immutabile.** Ogni snapshot/riga porta `algorithm_version` / `ledger_version`. Un
   cambio di formula **aggiunge** una versione (registry in `packages/contracts/src/schemas/epi.ts`:
   `EPI_ALGORITHM_REGISTRY`, `COIN_LEDGER_REGISTRY`), mai una riscrittura silenziosa.
3. **Audit trail.** `epi_snapshots.inputs_provenance` registra quali pilastri/input erano presenti
   e con quale confidenza → ogni score è ricostruibile.
4. **Ledger append-only.** Le righe Coin (`empathy_coin_ledger`) non si modificano: il saldo è una
   somma verificabile.
5. **Schema outcomes-ready.** `health_outcome_events` aggancia esiti reali per `athlete_id` e
   periodo senza migrazione distruttiva.

## 2. Registry delle versioni (single source of truth)

| Componente | Costante | Registry | Versione attiva |
| --- | --- | --- | --- |
| Algoritmo EPI | `EPI_ALGORITHM_VERSION` | `EPI_ALGORITHM_REGISTRY` / `CURRENT_EPI_VERSION_INFO` | `epi_v1` |
| Ledger Coin | `COIN_LEDGER_VERSION` | `COIN_LEDGER_REGISTRY` / `CURRENT_COIN_VERSION_INFO` | `coin_v1` |

Ogni entry del registry congela i parametri shippati (pesi pilastri, soglia giorno efficiente,
tier, coin/giorno) come **copia di audit**. Confronti longitudinali tra versioni partono da qui.

### Procedura di change control (obbligatoria al cambio formula)

1. Aggiungere una nuova entry al registry (`epi_v2`, …) con `effectiveFrom` e `status: "active"`;
   marcare la precedente `deprecated` (gli storici restano leggibili).
2. Bump della costante `*_VERSION`.
3. Aggiornare/estendere i golden test (`apps/web/lib/epi/epi-engine.test.ts`); **regression test
   obbligatorio**: gli output della versione precedente su fixture noti non cambiano.
4. Nessuna ri-scrittura retroattiva degli snapshot esistenti.

## 3. Asset dati per la validazione

| Tabella | Ruolo nello studio |
| --- | --- |
| `epi_snapshots` | Serie longitudinale EPI per atleta/giorno (score, pilastri, tier, illness, provenance). |
| `empathy_coin_ledger` | Aderenza/engagement (giorni efficienti, streak) — variabile di esposizione. |
| `athlete_daily_checkins` | Stato soggettivo (variabile self-report). |
| `health_outcome_events` | **Esiti** reali (assenze, episodi, marker) — variabili dipendenti. |

## 4. Disegno di validazione (efficacy study, off-app)

- **Obiettivo.** Verificare se EPI alto/aderenza alta correlano con esiti migliori.
- **Esposizione.** EPI medio nel periodo, n. giorni efficienti, streak (da snapshot + ledger).
- **Endpoint primario.** Giorni di assenza lavorativa per periodo (`category = 'work_absence'`).
- **Endpoint secondari.** Episodi di malattia (`illness_episode`), variazione marker
  (`clinical_marker`, in collegamento a `biomarker_panels`), trend stato psicofisico (check-in).
- **Coorti.** EPI alto vs basso (es. terzili) a parità di covariate disponibili.
- **Riproducibilità.** Ogni estrazione fissa `algorithm_version`; un auditor ricalcola gli EPI dai
  `inputs_provenance` con la stessa versione del motore.
- **Criteri di accettazione (esempio).** Associazione pre-registrata (direzione + soglia effetto)
  su coorte minima, con correzione per confondenti; risultati negativi documentati, non scartati.

## 5. Governance, consenso e privacy

- Tutto è **athlete-owned** con RLS (`private` + `coach` di membership). Nessun dato identificabile
  lascia la piattaforma in Fasi 1–5.
- `health_outcome_events.consent_for_research` (default `false`) abilita **solo** studi
  aggregati/anonimi; non implica mai condivisione esterna identificabile.
- La condivisione verso terzi (assicurazioni/aziende/welfare) resta **Fase 6**, **off-app**, dopo
  consenso esplicito e con preferenza per dati aggregati. Non esposta nell'app.

## 6. Validazione del motore (già in repo)

`apps/web/lib/epi/epi-engine.test.ts` — copertura piena/parziale/no-device/illness-day + invarianti
(range 0–100, confidenza 0–1, determinismo, re-normalizzazione pesi). Estendere a ogni bump versione.
