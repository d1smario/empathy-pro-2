-- =============================================================================
-- EMPATHY Pro 2.0 — Demo reset (contact@d1s.ch, jan-apr dataset)
-- =============================================================================
-- Rimuove SOLO il dataset demo con prefisso:
--   d1s-demo-janapr-v1-
-- senza toccare dati reali.
-- =============================================================================

DO $$
DECLARE
  v_email text := 'contact@d1s.ch';
  v_uid uuid;
  v_athlete uuid;
  v_prefix text := 'd1s-demo-janapr-v1-';
BEGIN
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(v_email) LIMIT 1;

  SELECT aup.athlete_id INTO v_athlete
  FROM public.app_user_profiles aup
  WHERE aup.user_id = v_uid
  LIMIT 1;

  IF v_athlete IS NULL THEN
    SELECT ap.id INTO v_athlete
    FROM public.athlete_profiles ap
    WHERE lower(ap.email) = lower(v_email)
    ORDER BY ap.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_athlete IS NULL THEN
    RAISE EXCEPTION 'Nessun athlete_id trovato per %', v_email;
  END IF;

  DELETE FROM public.executed_workouts
  WHERE athlete_id = v_athlete
    AND external_id LIKE v_prefix || '%';

  DELETE FROM public.device_sync_exports
  WHERE athlete_id = v_athlete
    AND external_ref LIKE v_prefix || '%';

  DELETE FROM public.planned_workouts
  WHERE athlete_id = v_athlete
    AND notes LIKE v_prefix || '%';

  DELETE FROM public.biomarker_panels
  WHERE athlete_id = v_athlete
    AND source = v_prefix || 'seed';

  DELETE FROM public.connected_devices
  WHERE athlete_id = v_athlete
    AND external_id LIKE v_prefix || '%';

  RAISE NOTICE 'Demo reset completato (%).', v_prefix;
END $$;

-- Verifica post-reset
WITH target AS (
  SELECT
    'contact@d1s.ch'::text AS email,
    'd1s-demo-janapr-v1-'::text AS pfx
),
ath AS (
  SELECT
    COALESCE(
      (
        SELECT aup.athlete_id
        FROM public.app_user_profiles aup
        JOIN auth.users u ON u.id = aup.user_id
        JOIN target t ON true
        WHERE lower(u.email) = lower(t.email)
        LIMIT 1
      ),
      (
        SELECT ap.id
        FROM public.athlete_profiles ap
        JOIN target t ON true
        WHERE lower(ap.email) = lower(t.email)
        ORDER BY ap.updated_at DESC NULLS LAST
        LIMIT 1
      )
    ) AS athlete_id
)
SELECT
  (SELECT count(*) FROM public.planned_workouts pw JOIN ath a ON pw.athlete_id = a.athlete_id JOIN target t ON true WHERE pw.notes LIKE t.pfx || '%') AS planned_rows_after_reset,
  (SELECT count(*) FROM public.executed_workouts ew JOIN ath a ON ew.athlete_id = a.athlete_id JOIN target t ON true WHERE ew.external_id LIKE t.pfx || '%') AS executed_rows_after_reset,
  (SELECT count(*) FROM public.device_sync_exports dx JOIN ath a ON dx.athlete_id = a.athlete_id JOIN target t ON true WHERE dx.external_ref LIKE t.pfx || '%') AS device_rows_after_reset,
  (SELECT count(*) FROM public.biomarker_panels bp JOIN ath a ON bp.athlete_id = a.athlete_id JOIN target t ON true WHERE bp.source = t.pfx || 'seed') AS biomarker_rows_after_reset;
