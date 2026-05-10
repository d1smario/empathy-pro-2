-- Pro 2 — estensione canali HD per `executed_workout_series`.
--
-- Stato precedente (045): 6 canali scalari (power, hr, speed, cadence, altitude, temperature).
-- Esteso ora per analisi attività più ricca quando il device espone samples HD
-- (Garmin Activity Details API, file FIT con record completi):
--   - route          → array di oggetti `{ lat: number, lon: number, alt?: number }` (polyline GPS)
--   - distance       → array scalare (metri cumulati)
--   - time_elapsed   → array scalare (secondi dallo start)
--   - pace_min_per_km → array scalare (min/km istantanei)
--   - vertical_speed_mps → array scalare (m/s, derivato altitude/dt)
--
-- Compatibile all'indietro: i 6 canali esistenti restano permessi; nessuna riga esistente
-- è invalidata. La colonna `samples jsonb` accetta già array eterogenei (number / object).
--
-- Idempotente.

alter table public.executed_workout_series
  drop constraint if exists executed_workout_series_channel_check;

alter table public.executed_workout_series
  add constraint executed_workout_series_channel_check
  check (
    channel in (
      'power',
      'hr',
      'speed',
      'cadence',
      'altitude',
      'temperature',
      'route',
      'distance',
      'time_elapsed',
      'pace_min_per_km',
      'vertical_speed_mps'
    )
  );

comment on column public.executed_workout_series.channel is
  'Canale HD: power/hr/speed/cadence/altitude/temperature scalari; route oggetti {lat,lon[,alt]}; distance/time_elapsed/pace_min_per_km/vertical_speed_mps scalari derivati o originali.';
