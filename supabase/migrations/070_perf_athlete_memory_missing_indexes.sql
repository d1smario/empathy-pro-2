-- =============================================================================
-- 070 — Indici mancanti per athlete memory (performance, additivo)
-- =============================================================================
-- Contesto: il caricamento del contesto atleta (resolveAthleteMemory, usato da
-- calendar/training/nutrition) interroga molte tabelle con `eq(athlete_id)`
-- + `order(...)`. La maggior parte ha già un indice athlete_id-leading; restano
-- due tabelle senza indice utile su athlete_id:
--   - connected_devices    : nessun indice su athlete_id (001 non lo crea).
--                            Query: eq(athlete_id) order created_at desc.
--   - biomarker_panels      : solo (import_job_id) [032]; manca athlete_id.
--                            Query: eq(athlete_id) order sample_date desc, created_at desc.
-- Effetto: nessun cambio di logica/schema dati, solo indici additivi che
-- rendono il caricamento del contesto atleta più rapido. Idempotente.
-- Prerequisiti: 001 (connected_devices, biomarker_panels).
-- =============================================================================

create index if not exists idx_connected_devices_athlete_created
  on public.connected_devices (athlete_id, created_at desc);

create index if not exists idx_biomarker_panels_athlete_sample
  on public.biomarker_panels (athlete_id, sample_date desc, created_at desc);
