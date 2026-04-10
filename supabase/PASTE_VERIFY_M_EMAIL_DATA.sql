-- Pro 2.0 — mirror di nextjs-empathy-pro/supabase/PASTE_VERIFY_M_EMAIL_DATA.sql (stesso DB consentito).
-- =============================================================================
-- Verifica: id atleta per email + presenza seed mario-rova-demo
-- Supabase SQL Editor: incolla tutto e Run (no comandi psql tipo \set).
-- Cambia email SOLO nella riga CREATE TEMP VIEW sotto.
-- =============================================================================

DROP VIEW IF EXISTS _empathy_diag_email;
CREATE TEMP VIEW _empathy_diag_email AS SELECT 'm@d1s.ch'::text AS v_email;

-- 1) Utente auth + athlete_id usato dall’app
WITH u AS (
  SELECT
    u.id AS auth_user_id,
    lower(u.email::text) AS email,
    aup.role,
    aup.athlete_id AS app_user_athlete_id,
    ap.id AS profile_row_id,
    ap.first_name,
    ap.last_name,
    ap.email AS athlete_profile_email
  FROM auth.users u
  CROSS JOIN _empathy_diag_email p
  LEFT JOIN app_user_profiles aup ON aup.user_id = u.id
  LEFT JOIN athlete_profiles ap ON ap.id = aup.athlete_id
  WHERE lower(u.email) = lower(p.v_email)
)
SELECT '1_identity' AS section, * FROM u;

-- 2) Profilo atleta con stessa email ma non collegato a questo utente (disallineamento)
SELECT
  '2_orphan_profile_same_email' AS section,
  ap.id AS athlete_profiles_id,
  ap.email,
  ap.first_name,
  ap.last_name
FROM _empathy_diag_email p
JOIN athlete_profiles ap ON lower(ap.email) = lower(p.v_email)
WHERE NOT EXISTS (
  SELECT 1 FROM app_user_profiles aup
  JOIN auth.users u ON u.id = aup.user_id AND lower(u.email) = lower(p.v_email)
  WHERE aup.athlete_id = ap.id
);

-- 3) Conteggi sull’atleta risolto da app_user_profiles
WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT
  '3_counts_for_app_athlete_id' AS section,
  a.id AS athlete_id,
  (SELECT count(*) FROM planned_workouts pw WHERE pw.athlete_id = a.id) AS planned_total,
  (SELECT count(*) FROM planned_workouts pw WHERE pw.athlete_id = a.id AND pw.notes ILIKE 'mario-rova-demo%') AS planned_demo_seed,
  (SELECT count(*) FROM executed_workouts ew WHERE ew.athlete_id = a.id) AS executed_total,
  (SELECT count(*) FROM executed_workouts ew WHERE ew.athlete_id = a.id AND ew.external_id LIKE 'mario-rova-demo-%') AS executed_demo_seed,
  (SELECT count(*) FROM device_sync_exports d WHERE d.athlete_id = a.id) AS device_exports_total,
  (SELECT count(*) FROM device_sync_exports d WHERE d.athlete_id = a.id AND d.external_ref LIKE 'mario-rova-demo-%') AS device_exports_demo_whoop,
  (SELECT count(*) FROM biomarker_panels b WHERE b.athlete_id = a.id AND b.source = 'mario-rova-demo-seed') AS biomarker_demo_panels,
  (SELECT count(*) FROM connected_devices c WHERE c.athlete_id = a.id AND c.external_id = 'whoop-demo-mario-001') AS connected_whoop_demo,
  (SELECT count(*) FROM physiological_profiles ph WHERE ph.athlete_id = a.id) AS physiological_rows
FROM aid
JOIN LATERAL (SELECT id FROM aid WHERE id IS NOT NULL) a(id) ON true;

-- 4) Ultime planned
WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT '4_latest_planned' AS section, pw.date, pw.type, pw.tss_target, left(pw.notes, 40) AS notes_preview
FROM aid
JOIN planned_workouts pw ON pw.athlete_id = aid.id
ORDER BY pw.date DESC
LIMIT 8;

-- 5) Ultime executed
WITH aid AS (
  SELECT aup.athlete_id AS id
  FROM auth.users u
  JOIN app_user_profiles aup ON aup.user_id = u.id
  CROSS JOIN _empathy_diag_email p
  WHERE lower(u.email) = lower(p.v_email)
  LIMIT 1
)
SELECT '5_latest_executed' AS section, ew.date, ew.tss, ew.external_id
FROM aid
JOIN executed_workouts ew ON ew.athlete_id = aid.id
ORDER BY ew.date DESC
LIMIT 8;
