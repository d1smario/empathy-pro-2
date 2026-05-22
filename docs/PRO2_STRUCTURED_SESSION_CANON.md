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

**Note coach → Zwift:** `block.notes` sul **primo step** di ogni blocco logico → `coachNote` / `textEvents` in export; XML annidato `<textevent timeoffset="0" message="…"/>` dentro `SteadyState` / `Ramp` (helper `zwo-step-text-events.ts`). Nessun messaggio automatico «Riscaldamento/Lavoro».

## Gap risolti (2026-05)

1. **Grafico Calendar** mostrava 4 barre (warm / main / secondary / cool) invece di lavoro+recupero ripetuti → ladder condiviso.
2. **Label** allineate IT: Riscaldamento, Serie principali, Defaticamento.
3. **Warm/cool** mappati a `ramp` nel contratto (non solo steady generico).
4. **Workout details** — `StructuredWorkoutStepTable` sotto il grafico (Calendar + Giornata via `CalendarPlannedBuilderDetail`).
5. **ZWO TextEvents** — solo `block.notes` (editing note in Builder: fase successiva).

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
