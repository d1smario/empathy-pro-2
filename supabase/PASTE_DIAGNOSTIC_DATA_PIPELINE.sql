-- Pro 2.0 — mirror di nextjs-empathy-pro/supabase/PASTE_DIAGNOSTIC_DATA_PIPELINE.sql
-- =============================================================================
-- Diagnostica “dove sono i dati” — V1 / stesso DB Pro 2
-- Supabase SQL Editor: un solo Run. Email solo nella CREATE TEMP VIEW.
--
-- Checklist fuori da SQL (app che parla al DB giusto):
--   • Supabase Dashboard → Settings → API → Project URL (es. https://xxxx.supabase.co)
--   • Locale: .env.local NEXT_PUBLIC_SUPABASE_URL deve avere lo STESSO xxxx.
--   • In console EMPATHY l’atleta attivo (UUID) deve coincidere con app_user_athlete_id qui sotto.
--   • Questo editor usa ruolo elevato: i conteggi sono completi; l’app utente è soggetta a RLS.
--
-- Cosa guardi nei risultati:
--   • device_exports_by_provider: Whoop/Garmin/… (reality ingest)
--   • training_import_jobs: file import training
--   • knowledge_* / evidence: layer interpretazione (non “genera” piani da solo)
--   • planned_demo_seed / executed_demo_seed: seed mario-rova-demo
--
-- Tabella assente (es. knowledge_expansion_traces): il blocco H in fondo usa NOTICE
-- nel pannello “Messages” del SQL Editor, senza far fallire le query sopra.
-- =============================================================================

DROP VIEW IF EXISTS _empathy_diag_email;
CREATE TEMP VIEW _empathy_diag_email AS SELECT 'm@d1s.ch'::text AS v_email;

-- A) Identità + athlete_id app
WITH u AS (
  SELECT
    u.id AS auth_user_id,
    lower(u.email::text) AS email,
    aup.role,
    aup.athlete_id AS app_user_athlete_id
  FROM auth.users u
  CROSS JOIN _empathy_diag_email p
  LEFT JOIN app_user_profiles aup ON aup.user_id = u.id
  WHERE lower(u.email) = lower(p.v_email)
)
SELECT 'A_identity' AS section, * FROM u;

-- B) Conteggi aggregati atleta app
WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT
  'B_counts' AS section,
  a.id AS athlete_id,
  (SELECT count(*) FROM planned_workouts pw WHERE pw.athlete_id = a.id) AS planned_total,
  (SELECT count(*) FROM planned_workouts pw WHERE pw.athlete_id = a.id AND pw.notes ILIKE 'mario-rova-demo%') AS planned_demo_seed,
  (SELECT count(*) FROM executed_workouts ew WHERE ew.athlete_id = a.id) AS executed_total,
  (SELECT count(*) FROM executed_workouts ew WHERE ew.athlete_id = a.id AND ew.external_id LIKE 'mario-rova-demo-%') AS executed_demo_seed,
  (SELECT count(*) FROM twin_states t WHERE t.athlete_id = a.id) AS twin_states_rows,
  (SELECT count(*) FROM physiological_profiles ph WHERE ph.athlete_id = a.id) AS physiological_rows,
  (SELECT count(*) FROM connected_devices c WHERE c.athlete_id = a.id) AS connected_devices_total,
  (SELECT count(*) FROM biomarker_panels b WHERE b.athlete_id = a.id) AS biomarker_panels_total,
  (SELECT count(*) FROM device_sync_exports d WHERE d.athlete_id = a.id) AS device_sync_exports_total
FROM aid a
WHERE a.id IS NOT NULL;

-- C) device_sync_exports per provider (Whoop, Garmin, …)
WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT 'C_device_exports_by_provider' AS section, d.provider, count(*)::int AS n
FROM aid
JOIN device_sync_exports d ON d.athlete_id = aid.id
GROUP BY d.provider
ORDER BY n DESC, d.provider;

-- D) Ultime righe device_sync (payload adapter / sleep HRV)
WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT
  'D_latest_device_sync_exports' AS section,
  d.provider,
  d.status,
  left(coalesce(d.external_ref, ''), 48) AS external_ref_preview,
  d.created_at,
  left(coalesce(d.payload->>'adapterKey', ''), 40) AS adapter_key_preview
FROM aid
JOIN device_sync_exports d ON d.athlete_id = aid.id
ORDER BY d.created_at DESC
LIMIT 12;

-- E) Ultimi job import file training (richiede migration 016; se 42P01, salta o applica migrazione)
WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT
  'E_latest_training_import_jobs' AS section,
  j.status,
  j.mode,
  j.source_format,
  left(coalesce(j.file_name, ''), 50) AS file_name_preview,
  j.created_at
FROM aid
JOIN training_import_jobs j ON j.athlete_id = aid.id
ORDER BY j.created_at DESC
LIMIT 12;

-- F) Ultime planned / executed (calendario)
WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT 'F_latest_planned' AS section, pw.date, pw.type, left(pw.notes, 36) AS notes_preview
FROM aid
JOIN planned_workouts pw ON pw.athlete_id = aid.id
ORDER BY pw.date DESC
LIMIT 10;

WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT 'G_latest_executed' AS section, ew.date, ew.tss, left(coalesce(ew.external_id, ''), 40) AS external_id_preview
FROM aid
JOIN executed_workouts ew ON ew.athlete_id = aid.id
ORDER BY ew.date DESC
LIMIT 10;

-- H) Conteggi tabelle opzionali (migrations 010 / 016 / 020) — leggi tab “Messages” / Notice
DO $$
DECLARE
  v_aid uuid;
  v_target_email text;
  v_n bigint;
BEGIN
  SELECT p.v_email INTO v_target_email FROM _empathy_diag_email p LIMIT 1;
  SELECT aup.athlete_id INTO v_aid
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  WHERE lower(u.email) = lower(v_target_email)
  LIMIT 1;

  IF v_aid IS NULL THEN
    RAISE NOTICE '[H] Nessun athlete_id per email % — salto conteggi opzionali', v_target_email;
    RETURN;
  END IF;

  IF to_regclass('public.knowledge_evidence_hits') IS NOT NULL THEN
    EXECUTE 'SELECT count(*)::bigint FROM knowledge_evidence_hits WHERE athlete_id = $1' USING v_aid INTO v_n;
    RAISE NOTICE '[H] knowledge_evidence_hits (mig 010): % righe per athlete_id %', v_n, v_aid;
  ELSE
    RAISE NOTICE '[H] knowledge_evidence_hits: tabella assente (migration 010 non applicata)';
  END IF;

  IF to_regclass('public.training_import_jobs') IS NOT NULL THEN
    EXECUTE 'SELECT count(*)::bigint FROM training_import_jobs WHERE athlete_id = $1' USING v_aid INTO v_n;
    RAISE NOTICE '[H] training_import_jobs (mig 016): % righe per athlete_id %', v_n, v_aid;
  ELSE
    RAISE NOTICE '[H] training_import_jobs: tabella assente (migration 016 non applicata)';
  END IF;

  IF to_regclass('public.knowledge_expansion_traces') IS NOT NULL THEN
    EXECUTE 'SELECT count(*)::bigint FROM knowledge_expansion_traces WHERE athlete_id = $1' USING v_aid INTO v_n;
    RAISE NOTICE '[H] knowledge_expansion_traces (mig 020): % righe per athlete_id %', v_n, v_aid;
  ELSE
    RAISE NOTICE '[H] knowledge_expansion_traces: tabella assente (migration 020 non applicata)';
  END IF;
END $$;
