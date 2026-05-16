# Atleta greenfield — report stato sistema (Pro 2)

**Repo:** `empathy-pro-2-cursor` · **Aggiornamento:** maggio 2026  
**Pubblico:** coach, product, engineering  
**Non sostituisce:** `CONSTITUTION.md`, `docs/ADAPTATION_LOAD_SCIENCE_AND_SCORE_V1.md`

Piano operativo collegato: [`docs/EMPATHY_PRO2_DATA_AND_GENERATIVE_OPTIMIZATION_PLAN.md`](EMPATHY_PRO2_DATA_AND_GENERATIVE_OPTIMIZATION_PLAN.md)

---

## 1. Posizionamento scientifico (Costituzione §J)

- La **letteratura pubblicata** definisce *cosa* è plausibile modellare (impulso giornaliero, filtri esponenziali su serie, limiti wearable).
- **Empathy** implementa formule **proprietarie, versionate** in `packages/domain-*` — non parità numerica con algoritmi chiusi (WHOOP strain, TrainingPeaks, Oura readiness, ecc.).
- I dati vendor sono **ingressi ingest**; i motori (CTL/ATL analoghi, `internalLoadScore`, `AdaptationScoreV1`) sono **Empathy**.
- Dove il codice è **euristica** (`internalLoadScore`, proxy TSS da FC con cap), va dichiarato in UI e in `ADAPTATION_LOAD_SCIENCE_AND_SCORE_V1.md`.

---

## 2. Checklist operativa (legenda: ⬜ da fare · 🟡 parziale · ✅ ok)

### A — Piattaforma

| # | Criterio | Tipico | Verifica |
|---|----------|--------|----------|
| A1 | Auth stabile | 🟡 | Login → refresh → moduli senza redirect loop |
| A2 | `athlete_id` attivo coerente | 🟡 | Stesso ID su Dashboard, Training, Settings |
| A3 | `requireAthleteReadContext` su API dati | ✅ | 401/403 senza atleta |
| A4 | Memoria canonica unica | ✅ | `resolveAthleteMemory`, no twin parallelo |
| A5 | `npm run verify` verde | ✅ | Root monorepo |
| A6 | Secrets non in commit | ✅ | Solo `.env.example` in repo |

### B — Ingest recovery

| # | Criterio | Tipico | Verifica |
|---|----------|--------|----------|
| B1 | Device collegato + policy ingest | 🟡 | Settings → Devices |
| B2 | Sonno in recovery | ✅ se Garmin/WHOOP | Core · Sonno |
| B3 | HRV | ✅ spesso | Core · HRV |
| B4 | RHR | 🟡 | Core · FC a riposo (fix filtro export in D2) |
| B5 | Strain vendor (metadato) | 🟡 | Opzionale, non motore |
| B6 | RR notturna | 🟡 | Tier `extended` se mappata |
| B7 | `RecoveryDataTier` su twin | 🟡 | Strip / analytics |

### C — Training reality

| # | Criterio | Tipico | Verifica |
|---|----------|--------|----------|
| C1 | `executed_workouts` in finestra 120g | ⬜ senza sync | Analytics rows |
| C2 | TSS o proxy su eseguiti | ⬜ | TSS 7g > 0 se allenato |
| C3 | Piano vs reale non `X/0` | ⬜ con solo piano | Core |
| C4 | Compliance sensata | ⬜ | Se eseguito, non 0% |
| C5 | CTL/ATL/TSB ext non tutti 0 | ⬜ | Dopo ≥1 settimana dati |
| C6 | Coupling int/ext interpretabile | ⬜ | |
| C7 | Calendar EXEC popolato | 🟡 | Nel tempo |
| C8 | Builder → planned | 🟡 | |
| C9 | VIRYA → builder (no motore parallelo) | ✅ | Regola pipeline |

### D — Motori numerici

| # | Criterio | Tipico | Verifica |
|---|----------|--------|----------|
| D1 | EWMA solo `@empathy/domain-training` | ✅ | Test golden |
| D2 | Impulso esterno TSS + proxy FC | ✅ | `empathy-external-daily-impulse` |
| D3 | `load-series` unico | ✅ | Audit science doc §3.1 |
| D4 | `AdaptationScoreV1` + confidence | 🟡 | Twin + strip parziale UI |
| D5 | No claim “uguale a vendor” in copy | 🟡 | Review UI |

### E — Twin e adattamento

| # | Criterio | Tipico | Verifica |
|---|----------|--------|----------|
| E1 | Twin readiness/fatigue/glycogen | ✅ | Core |
| E2 | Loop adattamento con evidenza esecutiva | 🟡 | Gate G0 |
| E3 | Divergenza non narrata a reale=0 | 🟡 | Banner Core |

### F — Moduli prodotto

| Modulo | Stato |
|--------|--------|
| Dashboard · Core | 🟡 recovery ok; training vuoto senza eseguiti |
| Training · Calendar / Session | 🟡 |
| Training · Builder / Analyzer | 🟡 dipende da C |
| Nutrition · meal-plan | 🟡 profilo BMR |
| Health / Bioenergetics / Physiology | 🟡 |
| Settings · device + preferenze | 🟡 |

### G — Interpretation / AI

| # | Criterio | Tipico |
|---|----------|--------|
| G1 | AI non sostituisce motori | ✅ policy |
| G2 | Staging L2 prima memoria | 🟡 |
| G3 | Generative: fallback locale | 🟡 |

### H — Osservabilità

| # | Criterio | Tipico |
|---|----------|--------|
| H1 | `readSpineCoverage` visibile | ✅ |
| H2 | Degradazione controllata ingest | 🟡 |

---

## 3. Definition of Done — prima settimana atleta

Tutti veri:

1. **B2 + B3 + B4** — sonno, HRV, RHR valorizzati (device o lab).
2. **C1 + C2** — ≥3 giorni con eseguiti e TSS (o proxy) negli ultimi 7g.
3. **C3 + C4** — piano·reale e compliance coerenti con esecuzione reale.
4. **C5** — CTL ext in crescita o > 0 dopo impulsi.
5. **E2** — tier recupero visibile.
6. **F1** — Core con banner espliciti se manca reality training.
7. **A1–A2** — auth e contesto atleta stabili.

---

## 4. Caso reale — Dashboard Core (sintesi)

Scenario osservato: **piano alto, eseguito 0**, recovery **GOOD** (sonno, HRV), **twin** popolato, **TSS/CTL/coupling 0**.

| Osservazione | Interpretazione |
|--------------|-----------------|
| Piano 376 / reale 0 (7g) | Pianificato presente; **nessuna reality esecuzione** nella metrica confrontata |
| TSS 0, CTL 0 | **Coerente**: EWMA senza impulso giornaliero |
| Kcal 80 / 7243 (28g) | Energia da trace possibile **senza** TSS strutturato |
| Divergenza 20 / intervento 19 | Loop può usare twin+piano **senza** evidenza esecutiva → etichettare **bassa confidenza** (G0) |
| HRV 68 ms, sonno 8.8 h | Ingest recovery **funziona** su quel ramo |
| RHR `—` con provider garmin | Gap **mapping/filtro** export, non assenza twin |

---

## 5. Matrice vendor cloud (stato repo)

| Provider | Training | Wellness | OAuth/pull | Policy stream | Preferenza dominio | Priorità |
|----------|----------|----------|------------|---------------|-------------------|----------|
| **Garmin** | materialize + FIT | Health → exports | Completo | `garmin_activity_summary` on | `garmin` | P0 executed + RHR |
| **WHOOP** | workout off default | sleep/recovery on | `whoop/pull/run` | anti-doppione | `whoop` recovery | P1 |
| **Wahoo** | pull workouts | — | `wahoo/pull/run` + push builder | `wahoo_workout` off default | `wahoo` training | P1 |
| **Strava** | `strava-pull-runner` | — | OAuth + `strava/pull/run` | estendere policy | `strava` training | P1 UI pull |
| **Oura/Polar/Coros** | import file | parziale | — | contracts | futuro | P2 |
| **CGM** | — | glicemia | export | `cgm` | time-series 055 | P1 |

**Convogliamento:** `persistRealityDeviceExport` → `device_sync_exports` (+ `executed_workouts`) → `loadDataSourcePreferenceMap` / analytics.

Dettaglio sequenza: [`docs/DEVICE_VENDORS_DECODE_READ_EXPOSE_PLAN.md`](DEVICE_VENDORS_DECODE_READ_EXPOSE_PLAN.md)

---

## 6. Sensori e sorgenti future

| Sorgente | Stato repo | Piano |
|----------|------------|-------|
| **Aura** | Non in `integrations/*` | D7: adapter + policy |
| **Apple Watch / Health** | `apple_watch` + import file | D7: export HealthKit |
| **Core temp** | `core_temp_c` trace | D7: mapper |
| **SmO₂ / Moxy** | `smo2` + physiology UI | D7: file/BLE → aggregati |
| **Limbo / Abbott Core 2** | canale `lactate_mmol_l` | D7: time-series |
| **Lattato** | import + lab + cross-channel | D4 health |
| **Sudorazione** | evidence bridge only | D7+ con sensore reale |

---

## 7. Riferimenti

- [`docs/ADAPTATION_LOAD_SCIENCE_AND_SCORE_V1.md`](ADAPTATION_LOAD_SCIENCE_AND_SCORE_V1.md)
- [`docs/INGEST_DEVICE_AND_LAB_MATRIX.md`](INGEST_DEVICE_AND_LAB_MATRIX.md)
- [`docs/EMPATHY_OPERATIONAL_REALIZATION_MAP.md`](EMPATHY_OPERATIONAL_REALIZATION_MAP.md)
- [`docs/PRO2_SMOKE_CHECKLIST.md`](PRO2_SMOKE_CHECKLIST.md)
- [`docs/GARMIN_OAUTH2_TEST_RUNBOOK.md`](GARMIN_OAUTH2_TEST_RUNBOOK.md) (se presente)
