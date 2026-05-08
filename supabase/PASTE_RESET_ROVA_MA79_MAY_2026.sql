-- =============================================================================
-- EMPATHY Pro 2.0 — Reset training Maggio 2026 per rova.ma79@gmail.com
-- =============================================================================
-- Cancella TUTTE le righe `planned_workouts` ed `executed_workouts` con `date`
-- nel mese indicato per l’athlete risolto da app_user_profiles → athlete_profiles.
-- `executed_workout_series` viene rimossa in cascade su delete executed_workouts.
--
-- Esegui nel SQL Editor del progetto Supabase corretto.
-- Verifica che l’host (Settings → API → Project URL) sia lo STESSO di
-- `NEXT_PUBLIC_SUPABASE_URL` su Vercel **Production** — altrimenti cancelli un altro DB
-- e in prod non cambia nulla.
-- =============================================================================

DO $$
DECLARE
  v_email text := 'rova.ma79@gmail.com';
  v_year int := 2026;
  v_month int := 5;
  v_from date := make_date(v_year, v_month, 1);
  v_to date := (make_date(v_year, v_month, 1) + interval '1 month' - interval '1 day')::date;
  v_uid uuid;
  v_athlete uuid;
  n_exec int;
  n_plan int;
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
    AND date >= v_from
    AND date <= v_to;
  GET DIAGNOSTICS n_exec = ROW_COUNT;

  DELETE FROM public.planned_workouts
  WHERE athlete_id = v_athlete
    AND date >= v_from
    AND date <= v_to;
  GET DIAGNOSTICS n_plan = ROW_COUNT;

  RAISE NOTICE 'Reset % %-%: athlete_id=% executed_deleted=% planned_deleted=%',
    v_email, v_year, v_month, v_athlete, n_exec, n_plan;
END $$;
