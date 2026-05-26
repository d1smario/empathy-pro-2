# Pro 2 — Seduta strutturata (canone Builder / VIRYA / export)

## Obiettivo

Ogni seduta **aerobica** (e, dove applicabile, tecnica/lifestyle con proxy tempo) deve essere **leggibile e interscambiabile** con:

- TrainingPeaks Structured Workout Builder
- Zwift (`.zwo`)
- Rouvy / Wahoo / TrainerRoad (`.erg`, `.mrc`, `.fit` workout)
- Whoosh (import FIT/ZWO)

L’atleta e il coach devono vedere **la stessa struttura** in Empathy (grafico + lista step) e sul dispositivo.

## Shell obbligatoria (letteratura + prassi indoor)

Ordine fisso (TP FAQ: **un solo** warm-up in testa, **un solo** cool-down in coda):

| Fase | Ruolo fisiologico | Implementazione Pro 2 |
|------|-------------------|------------------------|
| **Riscaldamento** | Attivazione cardiovascolare, progressione neuromuscolare verso la zona di lavoro (10–20′ tipico endurance) | Blocco `ramp` Z1→Z2, label `Riscaldamento` |
| **Lavoro** | Stimolo target (soglia, VO₂, endurance, ecc.) | `interval2` / `interval3` / `steady` / `pyramid` con preset VIRYA (`PRESET_*`) |
| **Recupero** | Tra le ripetizioni: attivo Z1–Z2 (non stop completo salvo sprint) | Espanso in segmenti «lavoro» + «recupero» nel grafico e in ZWO |
| **Volume complementare** | Opzionale: blocco steady secondario (fase piano) | `steady` Z2–Z3, label `Volume complementare` |
| **Defaticamento** | Smaltimento metaboliti, ritorno autonomico (10–15′) | Blocco `ramp` Z2→Z1, label `Defaticamento` |

Riferimenti pratica: distribuzione fasi Coggan/Allen (warm / work / cool); interval training review (Buchheit & Laursen, 2013); TP Structured Builder block types (Warm up, Active, Recovery, Cool down).

## Tipi blocco (allineamento TP ↔ Pro 2 ↔ ZWO)

| TrainingPeaks | Pro 2 `kind` | Export |
|---------------|--------------|--------|
| Warm up | `ramp` (Z1→Z2) | `Ramp` o stepwise steady |
| Active / Steady | `steady` | `SteadyState` |
| Recovery (tra interval) | segmenti `interval2` (intensity2 = Z1) | `SteadyState` basso |
| Two-step repeat | `interval2` | N× (SteadyState work + SteadyState rec) |
| Three-step repeat | `interval3` | N× (A+B+C) |
| Ramp up/down | `ramp` | `Ramp` |
| Cool down | `ramp` (Z2→Z1) | `Ramp` o steady |

## Pipeline canonica (no linee parallele)

```
generateTrainingSession / VIRYA brief
  → mapEngineSessionToTrainingBlocks (TrainingBlock + chart)
  → scaleTrainingBlock
  → buildPro2BlockSessionContract
  → finalizeViryaPro2ContractAsBuilderFile
  → BUILDER_SESSION_JSON in planned_workouts.notes
```

**UI Calendar / Session:** `expandContractToLadderSteps` in `pro2-structured-interval-ladder.ts` — unica espansione per grafico (`ladderStepsToChartSegments`), tabella (`ladderStepsToStructuredIntervalRows`) e ZWO.

## Builder domina VIRYA (calendario + energia)

- **VIRYA** resta visibile finché esistono righe `[VIRYA:…]` in `planned_workouts`.
- **Salvataggio Builder** (`POST /api/training/planned/insert` con contratto in `notes`) **elimina** tutte le righe VIRYA del **giorno** prima dell’insert (`purgeViryaPlannedWorkoutsOnDay`).
- **Nutrizione / meal plan:** `dedupePlannedTrainingForNutritionEnergy` esclude VIRYA se nel giorno c’è già una seduta Builder (fallback se purge non è andato a buon fine).
- **Metriche unificate:** `resolvePlannedSessionMetrics` — kJ/kcal/TSS/durata per calendario, nutrition API, fueling (FTP atleta da memoria fisiologica).

## Import file (calendario)

| Modalità UI | Esito tipico |
|-------------|----------------|
| **Auto** (default) | FIT/ZWO/ERG/MRC workout → **PLAN** + `BUILDER_SESSION_JSON`; FIT/TCX/GPX attività → **EXEC** |
| **Calendario (PLAN)** | Seduta strutturata o programma tabellare |
| **Attività (EXEC)** | Traccia registrata; FIT workout-shaped viene comunque instradato a PLAN (no 0 min) |

Vedi `docs/TRAINING_CALENDAR_SYSTEM_MAP.md`.

**Note coach → Zwift:** `block.notes` sul **primo step** di ogni blocco logico → `coachNote` / `textEvents` in export; XML annidato `<textevent timeoffset="0" message="…"/>` dentro `SteadyState` / `Ramp` (helper `zwo-step-text-events.ts`). Nessun messaggio automatico «Riscaldamento/Lavoro».

## Gap risolti (2026-05)

1. **Grafico Calendar** mostrava 4 barre (warm / main / secondary / cool) invece di lavoro+recupero ripetuti → ladder condiviso.
2. **Label** allineate IT: Riscaldamento, Serie principali, Defaticamento.
3. **Warm/cool** mappati a `ramp` nel contratto (non solo steady generico).
4. **Workout details** — `StructuredWorkoutStepTable` sotto il grafico (Calendar + Giornata via `CalendarPlannedBuilderDetail`).
5. **ZWO TextEvents** — solo `block.notes` (editing note in Builder: fase successiva).

## Coach Workout Library (rollout progressivo)

- **Migration 062** — `coach_workout_library_items` / `folders`: template `Pro2BuilderSessionContract` riusabili (coach-only).
- **Migration 063** — `athlete_workout_archetype_traces`: read spine memoria atleta (aderenza planned vs executed per archetype).
- **Apply** — `POST /api/training/library/items/[id]/apply` inserisce su `planned_workouts` via `contractToPlannedWorkoutRow` (stesso contratto builder, nessun motore parallelo).
- **Scaling opt-in** — checkbox «Adatta carico» → `applyScaling: true` usa bundle operativo giornaliero + hint tracce; default **senza** scaling.
- **Export ZWO** — da item library, stesso path di calendario (`serializePro2BuilderContractToZwo`).
- **Starter pack Fase 4 → catalogo v2** — `POST /api/training/library/seed-starter-pack` (`pack=catalog_v2`) importa **~145** template (cycling legacy + multi-disciplina: bike/run/swim/canoe) — Z2/Z3, norvegese Z4, polarizzato, lattacido, VO₂, anaerobico, HIT, ipossico sim, caldo, TT, sprint, forza, 30-30 / 20-40. Idempotente per `presetId`. Cartella «Empathy · Workout Catalog».
- **Export VIRYA Fase 5** — passo 5 VIRYA «Salva settimana in libreria»: materializza la settimana selezionata con la stessa pipeline del Calendar (`buildViryaPlannedRows` → `materializeViryaSessionContract`) e scrive N item via `POST /api/training/library/import-from-virya-week` (metadata `virya_phase`, `virya_week_objective`). Filtro fase in pannello libreria.
- **Calendar copy/move** — dettaglio seduta: **Copia** (`POST /api/training/planned/clone`) e **Sposta** (`PATCH /api/training/planned` con `date`).
- **Filtri libreria** — `GET /api/training/library/items` con `discipline`, `tag` (metodologia), `family`, `viryaPhase`, `q`; pannello coach con griglia filtri + reset.
- **Anteprima struttura libreria** — click su un template nel pannello coach espande sotto la riga il **grafico a blocchi** (`SessionBlockIntensityChart`, stesso del calendario/builder).

## Prossimi passi (roadmap)

- [x] Lista step stile TP sotto il grafico (tabella: durata, target W, zona, note) da `StructuredIntervalRow[]`.
- [x] TextEvents ZWO annidati da `block.notes` (primo step del blocco).
- [ ] Microciclo settimanale: distribuzione carico tra giorni con vincolo «max 2 quality» + long steady (VIRYA planner).
- [ ] Run/swim: stesso shell con `renderProfile` pace / HR e export FIT dove supportato.

## Verifica rapida

1. Genera seduta VIRYA ciclismo su Calendar.
2. Apri seduta: grafico con **molte barre** (warm ramp + N×(lavoro+recupero) + cool).
3. Export ZWO: numero step ≈ numero barre grafico.
4. Import ZWO in Zwift: stessa sequenza.
