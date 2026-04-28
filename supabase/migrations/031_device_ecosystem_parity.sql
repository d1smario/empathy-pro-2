-- Pro 2 — device ecosystem parity (provider registry + sync lifecycle metadata).
--
-- Scope:
--   - extend connected_devices for multi-provider lifecycle
--   - extend device_sync_exports for ingestion job/event metadata and dedup
--   - add explicit owner/coach RLS on connected_devices
--
-- Notes:
--   - idempotent on DB already migrated by V1/Pro 2
--   - service-role routes still bypass RLS

alter table public.connected_devices
  add column if not exists provider_account_id text,
  add column if not exists device_model text,
  add column if not exists device_name text,
  add column if not exists connection_status text,
  add column if not exists capabilities jsonb,
  add column if not exists metadata jsonb,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_error_at timestamptz,
  add column if not exists last_error_message text;

alter table public.connected_devices
  drop constraint if exists connected_devices_connection_status_check;

alter table public.connected_devices
  add constraint connected_devices_connection_status_check
  check (
    connection_status is null
    or connection_status in ('active', 'paused', 'revoked', 'error')
  );

create index if not exists idx_connected_devices_athlete_provider_updated
  on public.connected_devices (athlete_id, provider, updated_at desc);

create unique index if not exists uq_connected_devices_athlete_provider_account
  on public.connected_devices (athlete_id, provider, provider_account_id)
  where provider_account_id is not null;

alter table public.connected_devices enable row level security;

drop policy if exists "connected_devices_select_scoped" on public.connected_devices;
create policy "connected_devices_select_scoped"
  on public.connected_devices
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = connected_devices.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = connected_devices.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "connected_devices_insert_scoped" on public.connected_devices;
create policy "connected_devices_insert_scoped"
  on public.connected_devices
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = connected_devices.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = connected_devices.athlete_id
            )
          )
        )
    )
  );

drop policy if exists "connected_devices_update_scoped" on public.connected_devices;
create policy "connected_devices_update_scoped"
  on public.connected_devices
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = connected_devices.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = connected_devices.athlete_id
            )
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.app_user_profiles aup
      where aup.user_id = auth.uid()
        and (
          (aup.role = 'private' and aup.athlete_id = connected_devices.athlete_id)
          or (
            aup.role = 'coach'
            and exists (
              select 1
              from public.coach_athletes ca
              where ca.coach_user_id = auth.uid()
                and ca.athlete_id = connected_devices.athlete_id
            )
          )
        )
    )
  );

alter table public.device_sync_exports
  add column if not exists sync_kind text,
  add column if not exists external_event_id text,
  add column if not exists external_job_id text,
  add column if not exists window_start timestamptz,
  add column if not exists window_end timestamptz,
  add column if not exists payload_checksum text,
  add column if not exists payload_size_bytes bigint,
  add column if not exists ingested_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists error_code text,
  add column if not exists error_message text;

alter table public.device_sync_exports
  drop constraint if exists device_sync_exports_sync_kind_check;

alter table public.device_sync_exports
  add constraint device_sync_exports_sync_kind_check
  check (
    sync_kind is null
    or sync_kind in ('pull', 'push', 'manual_import')
  );

alter table public.device_sync_exports
  drop constraint if exists device_sync_exports_status_check;

alter table public.device_sync_exports
  add constraint device_sync_exports_status_check
  check (
    status in ('created', 'queued', 'processing', 'sent', 'done', 'failed', 'error', 'partial')
  );

create index if not exists idx_device_sync_exports_athlete_provider_created
  on public.device_sync_exports (athlete_id, provider, created_at desc);

create index if not exists idx_device_sync_exports_status_created
  on public.device_sync_exports (status, created_at desc);

create unique index if not exists uq_device_sync_exports_provider_event
  on public.device_sync_exports (provider, external_event_id)
  where external_event_id is not null;

