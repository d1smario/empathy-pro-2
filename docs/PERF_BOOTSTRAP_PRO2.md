# Pro 2 — Bootstrap velocità e precisione contesto

## Flusso critico

1. **Middleware** — refresh session Supabase
2. **ActiveAthleteProvider** — `app_user_profiles.athlete_id` canonico (private: 1 query profilo se id noto)
3. **Moduli** — API con `requireAthleteReadContext` + dedupe `planned_workouts` in lettura

## Ottimizzazioni applicate

| Area | Comportamento |
|------|----------------|
| Nutrition `mode=light` | Salta `resolveOperationalSignalsBundle`; primo paint più leggero |
| Nutrition `mode=pathway` | Query planned/executed **solo** il giorno `pathwayDate` |
| Nutrition primo load | `pathwayDate` + conserva pathway/energy dal light (meno refetch) |
| Calendario | Un solo `planned-window` con `includeWellness=1`; VIRYA tombstone in parallelo |
| Calendario | Cache client 8s + inflight dedupe su stessa URL |
| Calendario giorno | `includeTraceSummary=1` esplicito per interazioni/trace |
| Volumi periodo | Default **28g** invece di 365g sotto il calendario |
| Cross-tab atleta | `storage` → `load()` completo (validazione roster coach) |

## Precisione

- Planned: `dedupePlannedWorkoutDbRows` in `queryPlannedExecutedWindow`
- Private: priorità `app_user_profiles.athlete_id` su localStorage
- Coach: `activeId` deve essere in `coach_athletes` per org configurata

## Prossimi step (non in questo patch)

- SSR seed atleta nel layout shell
- Token sessione condiviso dal provider (meno `getSession` ripetuti)
- Lazy mount `TrainingPeriodVolumeSummary` fino a scroll
