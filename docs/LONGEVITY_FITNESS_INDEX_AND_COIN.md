# Longevity & Fitness — Longevity & Fitness Index (EPI), check-in giornaliero, Empathy Coin

> Modulo prodotto `longevity`. Loop giornaliero in-app: l'atleta registra sensazioni e giorni di
> malessere, vede un **Health Index (EPI)** deterministico e guadagna **Empathy Coin** per ogni
> "giorno efficiente" verso le certificazioni Bronze / Silver / Gold.
>
> Allineato a: `empathy_generative_core.mdc` (AI solo interpretazione, motori deterministici),
> `empathy_athlete_memory.mdc` (chiave `athlete_id`, niente twin parallelo),
> `empathy_pro2_no_parallel_lines.mdc` (una sola pipeline), `empathy_stability_first.mdc`
> (degradazione controllata, niente effetti su auth/routing), `empathy_schema_whole_picture.mdc`.

## 1. Confine generativo

| Piano | Cosa fa | Dove |
| --- | --- | --- |
| Ingest | Check-in soggettivo giornaliero (sensazioni + malessere) come **reality** | `athlete_daily_checkins` |
| Compute | **EPI deterministico** (0–100) da twin/internal-load/diary + check-in | `apps/web/lib/epi/epi-engine.ts` (puro, testato) |
| Interpretation | Narrazione/etichette dell'indice (nessun numero) | UI / interpretation layer |
| Application | Modulo `longevity`, Coin/tier, export terzi (Fase 6, off-app) | `app/(shell)/longevity`, ledger |

**L'AI non calcola l'EPI.** Il punteggio è prodotto da una funzione pura e versionata
(`EPI_ALGORITHM_VERSION`). L'EPI è una **proiezione** (come `systemic_modulation_snapshots`),
non una seconda verità del twin.

## 2. Check-in giornaliero (nuova ingest reality)

Tabella `athlete_daily_checkins` — una riga per `(athlete_id, checkin_date)`:

- Scale soggettive 1–5: `energy`, `mood`, `sleep_quality`, `soreness` (1 = nessun
  indolenzimento), `stress` (1 = nessuno stress), `motivation`.
- Flag malessere (`illness_flags text[]`): `fever`, `headache`, `sore_throat`, `gi_upset`,
  `cold_flu`, `injury`, `other`.
- `note` (testo breve), `source` (default `self_report`), timestamps.
- RLS canonica `private`/`coach` (vedi `011_systemic_modulation_snapshots.sql`).

## 3. Health Index (EPI) — composito deterministico 0–100

Otto pilastri, ognuno normalizzato 0–100 con un `dataTier` di confidenza; pesi in
`EPI_PILLAR_WEIGHTS`. Pilastri con dato assente non azzerano l'indice: vengono esclusi e il peso
è ridistribuito, e la **confidenza** complessiva riflette la copertura (no-device non è penalizzato a 0).

| Pilastro | Input canonici |
| --- | --- |
| `activity_load` | `executionCompliancePct`, `fitnessChronic`, streak |
| `recovery` | `InternalLoadState.autonomic` + `recoveryCapacity`, `TwinState.readiness` |
| `hrv` | canale `autonomic` vs baseline HRV |
| `sleep` | `sleep_circadian`, `TwinState.sleepRecovery` |
| `nutrition` | `energyAdequacyRatio`, `proteinGPerKg` |
| `body_composition` | `bodyFatPct`/`muscleMassKg`, `phaseAngleScore` |
| `protocol_adherence` | compliance allenamento + diario + piano attivo |
| `subjective_wellness` | scale del check-in (energy/mood/sleep/soreness/stress) |

### Guardia malattia (illness guard)

Se il giorno ha `illness_flags`, l'EPI marca `illnessDay = true`: l'obiettivo di efficienza è
**sospeso** (nessuna penalità Coin, nessun calo ingiusto), il pilastro soggettivo non spinge il
punteggio verso il basso in modo punitivo, e il giorno è etichettato come recupero. Segnalare
onestamente non viene mai punito.

## 4. Empathy Coin per giorno efficiente (interno, no blockchain)

- **Giorno efficiente** (deterministico): check-in completato + EPI ≥ soglia
  (`EPI_EFFICIENT_DAY_MIN_SCORE`) + non illness day. Premia `COIN_PER_EFFICIENT_DAY`.
- Illness day: **0 Coin di efficienza, nessuna penalità**.
- Tier (configurabili in `COIN_TIERS`): 10.000 Bronze, 25.000 Silver, 50.000 Gold.
- Ledger **append-only**; saldo e tier sono **derivati**, chiave `athlete_id` (+ `user_id`).
- "L'assicurazione compra la riduzione del rischio, non il Coin."

## 5. Certificazione & dimostrazione di efficacia (requisito vincolante)

Il sistema deve poter **certificare** nel tempo e dimostrare correlazione con esiti reali
(meno assenze lavorative, miglior stato psicofisico, marker metabolici migliori). Per questo:

1. **Determinismo + versioning.** `EPI_ALGORITHM_VERSION` e `COIN_LEDGER_VERSION` sono salvati su
   ogni snapshot/riga; il **registry** (`EPI_ALGORITHM_REGISTRY` / `COIN_LEDGER_REGISTRY` in
   `packages/contracts/src/schemas/epi.ts`) congela i parametri di ogni versione. Cambi di formula =
   nuova versione, mai riscrittura silenziosa: gli storici restano confrontabili e riproducibili.
2. **Audit trail temporale.** Ogni `epi_snapshots` conserva `captured_at`, `epi_score`, breakdown
   `pillars`, `data_tier`, `illness_flag`, **e la provenienza degli input** (`inputs_provenance`):
   quali sorgenti erano presenti e con che confidenza. Da qui si ricostruisce ogni punteggio.
3. **Ledger append-only.** Le righe Coin non si modificano: si aggiungono. Il saldo è una somma
   verificabile → tracciabilità per audit esterni.
4. **Schema pronto per studi di outcome.** `health_outcome_events` (migration `067`, append-only,
   RLS) aggancia dati di esito per `athlete_id` e periodo (assenze, ricadute, marker) senza
   migrazione distruttiva: snapshot longitudinale + ledger + outcome events sono la base statistica
   per validare l'efficacia (coorti EPI alto vs basso). Solo registrazione locale; nessun dato
   identificabile lascia la piattaforma in questa fase. Protocollo completo:
   `docs/LONGEVITY_FITNESS_EFFICACY_VALIDATION.md`.
5. **Validazione del motore.** Golden/fixture test (`epi-engine.test.ts`): copertura piena,
   parziale, no-device e illness-day, più invarianti (monotonicità, range 0–100, determinismo a
   parità di input). Regression test obbligatorio se si cambia una formula.

> La condivisione verso terzi (assicurazioni, aziende come benefit, strutture governative) è la
> **Fase 6**, **off-app** e **solo dopo consenso esplicito** dell'utente, con preferenza per dati
> aggregati/anonimi. Non è una funzione esposta nell'app. Fuori dallo scope di questa consegna
> (Fasi 1–5).

## 6. Tokenizzazione: differita

Nessuna blockchain ora. Il Coin è un sistema interno. La tokenizzazione si valuta solo dopo
20–50k utenti e partnership reali (come da brief).
