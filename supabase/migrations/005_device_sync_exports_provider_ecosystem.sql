-- Parità V1 migration 028: provider aggiuntivi per device_sync_exports (Suunto, Apple Watch, Zwift, Karoo).
-- Applicare sullo stesso progetto Supabase usato da V1 e Pro 2.

alter table public.device_sync_exports
  drop constraint if exists device_sync_exports_provider_check;

alter table public.device_sync_exports
  add constraint device_sync_exports_provider_check
  check (
    provider in (
      'garmin',
      'garmin_connectiq',
      'trainingpeaks',
      'strava',
      'wahoo',
      'coros',
      'polar',
      'whoop',
      'oura',
      'cgm',
      'suunto',
      'apple_watch',
      'zwift',
      'hammerhead',
      'other'
    )
  );
