# Empathy Load Metrics V2 — specifica

**Versione motore:** `EMPATHY_LOAD_V2_2026_05`  
**Governance:** `CONSTITUTION.md` §J, `docs/ADAPTATION_LOAD_SCIENCE_AND_SCORE_V1.md` (v1 resta storico fino a cutover UI).

## 1. Scopo

- Nomenclatura **non** TrainingPeaks: in UI vietati TSS, CTL, ATL, TSB.
- Due rami: **carico esterno** (lavoro meccanico, scala Coggan-Empathy) e **carico interno** (STRESS CORE + derivati).
- Un solo implementazione in `@empathy/domain-training`; app e API **consumano**.

## 2. Letteratura (ancoraggio, non parità vendor)

| Area | Riferimento concettuale | Uso in Empathy |
|------|-------------------------|----------------|
| Carico esterno | Coggan & Allen — IF, durata, stress score | `trainingLoad` seduta: IF²×ore×100 o proxy FC |
| Impulso–risposta | Banister; Busso — fitness/fatigue EWMA | `strain` = EWMA τ=7 su carico giornaliero |
| Mesociclo | Media mobile su carico | `fitness4` (28g), `fitness8` (56g) |
| Forma | Differenza cronico − acuto | `form = fitness4 − strain` |
| TRIMP / FC×durata | Edwards; Banister | Componente `s_hr` in STRESS CORE |
| Recovery | Buchheit, Plews — HRV/sonno come modulatori | Penalità normalizzate `s_hrv`, `s_sleep` |

## 3. Carico esterno

### 3.1 Seduta — `trainingLoad`

Priorità (`inferEmpathyTrainingLoadForSession`):

1. `vendorLoad` > 0 → usare quel valore (es. Garmin `trainingLoadScore`).
2. `avgPowerW` + `ftpW` → `round(min(999, Σ ore × (P/FTP)² × 100))`.
3. `hrAvgBpm` + `durationMinutes` → `min(150, empathyCardioImpulseDaily × 10)`.
4. Solo durata → `min(40, durationMinutes × 0.45)` (conservativo).

### 3.2 Giorno — impulso `L_d`

`L_d` = somma `trainingLoad` delle sedute nel giorno `d` (giorni senza seduta: `L_d = 0`).

### 3.3 Serie esterna

| Campo | Formula | τ / finestra |
|-------|---------|----------------|
| `strain` | EWMA(`L`, τ=7) | `ewmaDailyStep` |
| `fitness4` | Media aritmetica `L` su **28** giorni di calendario inclusi (zeri inclusi) | 28g |
| `fitness8` | Media aritmetica `L` su **56** giorni | 56g |
| `form` | `fitness4 − strain` | — |

**Sostituisce** CTL (42g EWMA), ATL, TSB in prodotto V2.

## 4. Carico interno — STRESS CORE

### 4.1 Segnali normalizzati `s_* ∈ [0,1]`

| Segnale | Formula |
|---------|---------|
| `s_load` | `min(1, L_d / max(P90(L,56g), 1))` |
| `s_hr` | `min(1, sum(cardioImpulse sedute) / max(P90(cardio,56g), 1))` |
| `s_hrv` | `clamp((baseline7_hrv − hrv_today) / (0.15 × baseline7_hrv), 0, 1)` se baseline > 0 |
| `s_sleep` | `clamp((targetSleepH − sleep_h) / targetSleepH, 0, 1)` — default target 7.5h |
| `s_rhr` | `clamp((rhr_today − baseline7_rhr) / 15, 0, 1)` |
| `s_temp` | `clamp(|temp − baseline7_temp| / 1.5, 0, 1)` se temp presente |

Baseline 7g: media degli ultimi 7 giorni **precedenti** con dato valido.

### 4.2 STRESS CORE

```
stressCore = 100 × (0.35·s_load + 0.25·s_hr + 0.20·s_hrv + 0.12·s_sleep + 0.06·s_rhr + 0.02·s_temp)
```

### 4.3 Derivati interni

| Campo | Formula |
|-------|---------|
| `fatigueInt` | EWMA(`stressCore`, τ=7) |
| `conditioningInt4` | Media mobile 28g su `stressCore` |
| `conditioningInt8` | Media mobile 56g su `stressCore` |
| `formInt` | `conditioningInt4 / max(fatigueInt, ε)` — **ε = 1** |

UI può clamp `formInt` a [0.3, 3].

## 5. Etichette prodotto (IT)

Vedi tabella in piano Cursor / `apps/web/lib/training/load-metrics-labels.ts`.

## 6. Test

- `packages/domain-training/src/empathy-load-metrics-v2.test.ts`
- `packages/domain-training/src/empathy-infer-training-load.test.ts`

## 7. Migrazione

- Colonna DB `executed_workouts.tss` resta; semanticamente = **training load**.
- API legacy `ctl`/`atl`/`tsb` in `DailyLoadPoint`: alias popolati da v2 per compatibilità transitoria (`ctl←fitness4`, `atl←strain`, `tsb←form`).
