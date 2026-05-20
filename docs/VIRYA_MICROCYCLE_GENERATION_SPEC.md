# VIRYA — microciclo → Builder (Pro 2)

## Principio

Ogni seduta intraday passa da **`generateBuilderSession`** e materialize canonico (`materializeViryaGymBuilderSession` per gym, ramo aerobic/technical/lifestyle con `mapEngineSessionToTrainingBlocks` → `finalizeViryaPro2ContractAsBuilderFile`). VIRYA periodizza e produce un **`ViryaBuilderSessionBrief`** per slot; `deriveViryaBuilderInstructions` traduce il brief in `tss`, minuti, `adaptationTarget`, hint.

## I 5 principi → Builder

| # | Principio | Planner | Builder |
|---|-----------|---------|---------|
| 1 | Budget settimanale | `distributeWeeklyLoad` + `normalizeWeeklyLoad` | `tssTargetHint`, `summary.tss/kcal` post-materialize |
| 2 | Polarizzazione Q/V | `sessionRole` per slot | Gym: `adaptationTarget` (es. `max_strength` vs `hypertrophy_*`). Aerobic: `resolveAerobicViryaPrescription` × scale ruolo |
| 3 | Pattern giorni | `VIRYA_WEEKDAY_PATTERN_OFFSETS` (Lun=0…Dom=6) | `weekday` in `objectiveDetail`; data calendario = `weekStart + weekdayOffset` |
| 4 | Fase | `phase` mesociclo | `phase` su `SessionGoalRequest`; deload abbassa pesi ruolo |
| 5 | Famiglia | `family` + modulo giorno | Gym distretti; technical/lifestyle moduli; aerobic disciplina + archetype |

## Pattern giorni (preset)

| Id | Offset (da lunedì `weekStart`) |
|----|----------------------------------|
| 3d | Lun, Mer, Ven |
| 4d | Lun, Mer, Ven, Dom |
| 5d | Lun, Mar, Gio, Ven, Dom |
| 6d | Lun–Sab |

## File

- `apps/web/lib/training/virya/virya-microcycle-planner.ts` — settimana slot + carichi
- `apps/web/lib/training/virya/build-virya-session-brief.ts` — brief per seduta
- `apps/web/lib/training/virya/derive-virya-builder-instructions.ts` — ponte → Builder
- `apps/web/lib/training/virya/materialize-virya-gym-builder-session.ts` — gym scheda

## Meta audit

Dopo il JSON builder in `planned_workouts.notes`, riga `microcycle=pattern:…;day=…;role=…;load=…` da `formatViryaBriefMetaLine`.

## Esempio 500 carico / 5 sedute (build, pattern 5d)

- Giorni: Lun, Mar, Gio, Ven, Dom (non consecutivi mer–dom).
- Ruoli: Q, V, Q, V, Q con carichi diversi; somma ≈ 500 (±3%).
- Due sedute Q vs V → `adaptationTarget` e hint diversi in `deriveViryaBuilderInstructions`.

## Ripubblicazione

Piani già salvati senza brief/meta vanno rigenerati con «Genera piano annuale su Calendar» per scheda gym completa e chip carico coerenti.
