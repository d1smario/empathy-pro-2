# Device data → UI surface matrix

Mappa di **letteratura** dei dati device (Garmin / Strava / Wahoo / Whoop / file FIT/GPX/TCX) verso le pagine prodotto Empathy Pro 2.0. Pensata come riferimento operativo: per ogni evento ingestito, dove sta nel DB e dove dovrebbe comparire in UI. Si combina con `docs/INGEST_DEVICE_AND_LAB_MATRIX.md` (regole ingest) e `docs/DEVICE_VENDORS_DECODE_READ_EXPOSE_PLAN.md` (decode pull/oauth).

## Principi

- L'ingest passa **solo** da adapter envelope → tabelle canoniche (`executed_workouts`, `device_sync_exports`, `biomarker_panels`, eventuali serie HD). UI non parla mai diretto col vendor.
- Le pagine leggono da **una spina sola** per modulo (`requireAthleteReadContext` + endpoint modulo). Niente fetch device-specific da componenti.
- Quando il vendor non espone un campo, in UI **stato vuoto controllato**, mai numeri inventati.

## Tabelle DB toccate (riferimento veloce)

- `executed_workouts` — colonne top-level: `id, athlete_id, planned_workout_id, date, started_at, ended_at, duration_minutes, tss, kj, kcal, trace_summary jsonb, lactate_mmoll, glucose_mmol, smo2, subjective_notes, source, external_id` (`supabase/migrations/014_training_planned_executed_import_jobs_v1.sql`).
- `device_sync_exports` — payload normalizzato per provider (cgm/whoop/garmin/strava/wahoo) con `provider`, `payload jsonb`, `sync_kind`, `external_ref`, `created_at`.
- `biomarker_panels` — pannelli laboratorio o derivati (`type`, `sample_date`, `values jsonb`, `source`).
- `executed_workout_series` — *prevista in Fase 3*: serie HD per canale (power/HR/altitudine/...) con `executed_workout_id`, `channel`, `samples jsonb`, `unit`, `version`.
- Tabelle daily aggregate dedicate **non** esistono: il "panel giornaliero" è ricostruito a runtime da `apps/web/lib/physiology/daily-wellness-panel.ts`.

## Chiavi canoniche `trace_summary` (file e pull)

Definite in `apps/web/lib/training/import-normalizer.ts`:
`distance_km`, `power_avg_w` / `power_avg`, `power_max_w` (Fase 1), `hr_avg_bpm`, `hr_max_bpm` (Fase 1), `cadence_avg_rpm`, `cadence_max_rpm` (Fase 1), `speed_avg_kmh`, `speed_max_kmh` (Fase 1), `elevation_gain_m`, `altitude_avg_m`, `altitude_min_m`/`altitude_max_m` (Fase 1), `temperature_avg_c`, `temperature_min_c`/`temperature_max_c` (Fase 1), `lactate_mmol_l`, `glucose_mmol`, `smo2`, `vo2_l_min`, `vco2_l_min`, `core_temp_c`, `sport`.

Le serie downsampled da file: `power_series_w`, `hr_series_bpm`, `speed_series_kmh`, `cadence_series_rpm`, `altitude_series_m`, `temperature_series_c`, `route_points`, `route_distance_series_km`, `route_altitude_series_m`.

## Provider × evento × campi × dove finiscono × UI surface

### Garmin Activity API (workout)

| Campo grezzo | Chiave canonica | Tabella | UI surface |
|---|---|---|---|
| `durationInSeconds` | `duration_minutes` | `executed_workouts.duration_minutes` | KPI Calendar Session Detail |
| `activeKilocalories` / `calories` | `kcal` | `executed_workouts.kcal` | KPI Session Detail |
| `trainingLoadScore` / `trainingStressScore` | `tss` | `executed_workouts.tss` | KPI Session Detail, overlay 42g Analyzer |
| `averagePower` / `maxPower` | `power_avg_w` / `power_max_w` | `trace_summary` (Fase 1 rimap) | KPI + tabella min/avg/max |
| `averageHeartRateInBeatsPerMinute` / `maxHeartRateInBeatsPerMinute` / `averageHeartRate` | `hr_avg_bpm` / `hr_max_bpm` | `trace_summary` (Fase 1) | KPI + tabella |
| `averageSpeedInMetersPerSecond` / `maxSpeedInMetersPerSecond` | `speed_avg_kmh` / `speed_max_kmh` | `trace_summary` (Fase 1) | tabella secondaria |
| `averageRunCadenceInStepsPerMinute` / `averageBikeCadenceInRoundsPerMinute` / `maxBikeCadenceInRoundsPerMinute` | `cadence_avg_rpm` / `cadence_max_rpm` | `trace_summary` (Fase 1) | tabella secondaria |
| `totalElevationGainInMeters` / `elevationGainInMeters` | `elevation_gain_m` | `trace_summary` | KPI |
| `averageTemperatureInCelsius` | `temperature_avg_c` | `trace_summary` | tabella secondaria |
| `distanceInMeters` | `distance_km` | `trace_summary` | KPI |
| `garmin_keys` / `channels_available` / `import_quality` | (meta) | `trace_summary` | banner qualità |

Codice: `apps/web/lib/integrations/garmin-activity-materialize.ts`. Serie HD ad alta risoluzione **non esposte** dal pull summary; per curve dense serve file FIT collegato.

### Garmin Health API (daily / sleep / hrv / stress / respirazione)

Stream supportati (`apps/web/lib/integrations/garmin-health-api-notification-schema.ts`): `dailies`, `sleeps`, `hrv`, `epochs`, `pulseox`, `allDayRespiration`, `stressDetails`, `bodyComps`, `skinTemp`, `userMetrics`, `healthSnapshot`.

| Stream | Campi chiave attesi | Tabella | UI surface |
|---|---|---|---|
| `dailies` | `steps`, `activeKilocalories`, `totalKilocalories`, `restingHeartRateInBeatsPerMinute`, `averageStressLevel`, `floorsClimbed`, `respirationAvg` | `device_sync_exports` (provider `garmin`, `sync_kind=daily`) | Wellness Day KPI |
| `sleeps` | `sleepTimeInSeconds`, `deepSleepDurationInSeconds`, `remSleepInSeconds`, `lightSleepDurationInSeconds`, `awakeDurationInSeconds`, `validation` | `device_sync_exports` | Wellness Day fasi sonno + Calendar badge |
| `hrv` | `hrvSummary.lastNightAvg`, `hrvValueArray` (se esposto) | `device_sync_exports` | Wellness Day trend HRV + Calendar badge |
| `stressDetails` | `stressLevelValuesArray` (con timestamp) | `device_sync_exports` | grafico stress giornaliero |
| `allDayRespiration` | `respirationValuesArray` | `device_sync_exports` | grafico FR giornaliera |
| `pulseox` | `spo2ValuesArray` | `device_sync_exports` | KPI SpO2 |
| `skinTemp` | delta nottata, valore base | `device_sync_exports` | trend temperatura corporea |

Stato attuale: gli stream arrivano nei job `garmin_pull_jobs.response_body`; il merge nel `daily-wellness-panel` legge `device_sync_exports` con chiavi flessibili (vedi `apps/web/lib/reality/sleep-recovery-signals.ts` e `apps/web/lib/physiology/daily-wellness-panel.ts`). **Gap**: scrittura sistematica in `device_sync_exports` per gli stream Health da pull job.

### Whoop (sleep / recovery / workout)

`apps/web/lib/integrations/whoop-pull-runner.ts` — pull v2 paginato, salva ciascun record in `device_sync_exports` con `provider=whoop` e `sync_kind` (`sleep` / `recovery` / `training`); per il workout fa anche upsert su `executed_workouts`.

| Risorsa | Campi noti | Dove | UI surface |
|---|---|---|---|
| `sleep` | `score.stage_summary.total_in_bed_time_milli`, `slow_wave_sleep_time_milli`, `rem_sleep_time_milli`, `wake_duration_milli`, `score.respiratory_rate`, `sleep_performance_percentage` | `device_sync_exports` | Wellness Day KPI + fasi |
| `recovery` | `score.recovery_score`, `score.resting_heart_rate`, `score.hrv_rmssd_milli`, `score.skin_temp_celsius`, `score.spo2_percentage` | `device_sync_exports` | Wellness Day KPI (HRV, RHR) + Calendar badge |
| `workout` | `score.strain`, `score.average_heart_rate`, `score.max_heart_rate`, `score.kilojoule`, `distance_meter`, `sport_name`, `start`/`end` | `device_sync_exports` + `executed_workouts` | Session Detail + Calendar chip EXEC |

### Strava

Activity → upsert su `executed_workouts` con chiavi vicine al canone (`power_avg_w`, `hr_avg_bpm`, `distance_m`, `total_elevation_gain`, `calories`, `moving_time`). Salva anche export in `device_sync_exports` (`provider=strava`).

| Campo | Canone | UI surface |
|---|---|---|
| `moving_time` | `duration_minutes` | KPI |
| `distance` (m) | `distance_km` | KPI |
| `total_elevation_gain` | `elevation_gain_m` | KPI |
| `average_watts` / `weighted_average_watts` / `max_watts` | `power_avg_w` / `power_max_w` | KPI + tabella |
| `average_heartrate` / `max_heartrate` | `hr_avg_bpm` / `hr_max_bpm` | KPI + tabella |
| `average_cadence` | `cadence_avg_rpm` | tabella |
| `calories` | `kcal` | KPI |
| `kilojoules` | `kj` | KPI |
| `average_temp` | `temperature_avg_c` | tabella |

### Wahoo

Workout → `executed_workouts` (campi `avg_power`, `max_power`, `avg_hr`, `max_hr`, `distance_m`, `total_ascent`, `kilojoules`) + export grezzo in `device_sync_exports`. Mapper: `apps/web/lib/integrations/wahoo-*` (vedi `wahoo-plan-from-generated-session.ts` per il verso opposto).

### File FIT / GPX / TCX

`apps/web/lib/training/import-parser.ts` produce sia summary canonici sia **serie campionate** (1200 punti) salvate dentro `executed_workouts.trace_summary` (chiavi `*_series_*` e `route_points`). La normalizzazione finale passa da `apps/web/lib/training/import-normalizer.ts`.

Da Fase 3 le stesse serie (downsampled multi-resolution) verranno persistite in `executed_workout_series` per disaccoppiarle dal JSON di sessione e supportare grafici densi anche quando il `trace_summary` è snello.

## UI surface map (dove appare cosa)

| UI | File componente | Sorgente lettura |
|---|---|---|
| Calendar grid + chip PLAN/EXEC | `apps/web/modules/training/views/TrainingCalendarPageView.tsx` | `GET /api/training/planned-window` |
| Calendar Session Detail (Fase 1) | `apps/web/components/training/CalendarDaySessionDetail.tsx` (nuovo) | `dayExecuted[*].traceSummary` (no fetch extra) |
| Calendar Wellness Day (Fase 2) | `apps/web/components/training/CalendarDayWellnessDetail.tsx` (nuovo) | `GET /api/health/daily-wellness` |
| Calendar wellness badge per cella (Fase 2) | `TrainingCalendarPageView.tsx` (estensione) | `wellnessByDate` aggiunto a `planned-window` |
| Training Analyzer overlay 42g | `apps/web/modules/training/views/TrainingAnalyticsPageView.tsx` | `GET /api/training/analytics` |
| Analyzer cross-channel sessione (Fase 4) | sezione nuova in `TrainingAnalyticsPageView.tsx` | stessa API + helper `cross-channel-session.ts` |
| Health archivio referti & valori | `apps/web/modules/health/views/HealthPageView.tsx` | `GET /api/health/panels-timeline` |
| Physiology daily | `apps/web/app/(shell)/physiology/daily/[date]/page.tsx` + `buildPhysiologyDailyPanel` | API esistenti |

## Gap dichiarati (da risolvere fuori UI)

1. Pull job Garmin Health: persistenza esplicita in `device_sync_exports` per `dailies`/`sleeps`/`hrv` (oggi resta in `garmin_pull_jobs.response_body`).
2. Garmin Activity: medie/max numeriche rimappate in `trace_summary` → risolto in Fase 1; samples HD da Activity Details API ora mappate verso `*_series_*` e persistite su `executed_workout_series` quando presenti (vedi `garmin-activity-materialize.ts`).
3. Serie HD per pull API legacy: i pull "summary only" non espongono stream → curve dense vengono dal file FIT/TCX o dal **callback Activity Details** Garmin.
4. Continuous channels (Na+/K+ sudore, NAD, NO) — già nei seed, esposte ora come overlay 42g + sezione cross-channel (Fase 4).

## Backfill / dati storici

- **Wellness storico** (sleep / HRV / RHR / readiness): **nessun backfill richiesto**. `buildWellnessWindowSummary` (`apps/web/lib/physiology/wellness-window-summary.ts`) e `buildPhysiologyDailyPanel` leggono retroattivamente da `device_sync_exports` per la finestra temporale richiesta dalla calendar/daily; i record già esistenti sono visibili appena la pagina interroga `?includeWellness=1`.
- **Serie HD storiche** (`executed_workout_series`): per i workout già importati prima della migration `045_executed_workout_series_v1.sql` la tabella è vuota. Lanciare:

  ```bash
  curl -X POST https://empathy-pro-2-web.vercel.app/api/training/backfill-series \
    -H "Content-Type: application/json" \
    -H "Cookie: <session>" \
    -d '{"athleteId":"<uuid>","limit":1000,"skipIfAlreadyHasSeries":true}'
  ```

  Idempotente (upsert su `executed_workout_id+channel+version`); i workout senza `*_series_*` nel `trace_summary` (es. push Garmin summary-only) vengono saltati senza errori.
- **Backfill Garmin Activity samples**: dal momento che `garmin-activity-materialize.ts` ora ingerisce `samples[]` quando l'Activity Details payload li include, basta ri-emettere il push o ri-eseguire il pull job per popolare le serie HD. Per i workout già materializzati senza samples, fare `curl` sopra dopo aver triggrato un re-import (oppure no-op: resta come summary-only).

## Convenzioni copy / UX (canon Pro 2)

- KPI hero in alto, palette `text-zinc-200`, accent gradient fucsia/violet/orange come da `docs/PRO2_UI_PAGE_CANON.md`.
- Tabella secondaria compatta: `font-mono tabular-nums`, separatori `divide-white/5`, colonne `min/avg/max`.
- Trend: Recharts su sfondo nero con bordo `border-white/10`. Stato vuoto: una sola riga di copy + CTA secondaria.
