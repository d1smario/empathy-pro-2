-- V2: deduplica stessa email senza TEMP TABLE (meno fragile in alcuni client).
-- Sostituisci ovunque m@d1s.ch se serve (anche dentro i blocchi DO). Esegui TUTTO in un solo Run (BEGIN → COMMIT).
-- Keeper = riga più vecchia (created_at ASC); losers = tutte le altre con stessa email normalizzata.

BEGIN;

-- Subquery riusate (stesso filtro email in tutto lo script)
-- K = id keeper | L = insieme id loser

UPDATE public.app_user_profiles
SET athlete_id = (
  SELECT b.id
  FROM public.athlete_profiles b
  WHERE lower(trim(coalesce(b.email, ''))) = lower(trim('m@d1s.ch'))
  ORDER BY b.created_at ASC
  LIMIT 1
)
WHERE athlete_id IN (
  SELECT a.id
  FROM public.athlete_profiles a
  WHERE lower(trim(coalesce(a.email, ''))) = lower(trim('m@d1s.ch'))
    AND a.id <> (
      SELECT b.id
      FROM public.athlete_profiles b
      WHERE lower(trim(coalesce(b.email, ''))) = lower(trim('m@d1s.ch'))
      ORDER BY b.created_at ASC
      LIMIT 1
    )
);

DO $$
DECLARE
  t text;
  opt_del text[] := ARRAY['garmin_athlete_links', 'coach_athletes'];
BEGIN
  FOREACH t IN ARRAY opt_del
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE athlete_id IN (
           SELECT a.id FROM public.athlete_profiles a
           WHERE lower(trim(coalesce(a.email, ''''))) = lower(trim(''m@d1s.ch''))
             AND a.id <> (
               SELECT b.id FROM public.athlete_profiles b
               WHERE lower(trim(coalesce(b.email, ''''))) = lower(trim(''m@d1s.ch''))
               ORDER BY b.created_at ASC LIMIT 1
             )
         )',
        t
      );
    END IF;
  END LOOP;
END $$;

-- UNIQUE(athlete_id) / load_series: elimina righe sui loser (solo se tabella esiste).
DO $$
DECLARE
  t text;
  dels text[] := ARRAY['physiological_profiles', 'nutrition_constraints', 'load_series'];
BEGIN
  FOREACH t IN ARRAY dels
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE athlete_id IN (
           SELECT a.id FROM public.athlete_profiles a
           WHERE lower(trim(coalesce(a.email, ''''))) = lower(trim(''m@d1s.ch''))
             AND a.id <> (
               SELECT b.id FROM public.athlete_profiles b
               WHERE lower(trim(coalesce(b.email, ''''))) = lower(trim(''m@d1s.ch''))
               ORDER BY b.created_at ASC LIMIT 1
             )
         )',
        t
      );
    END IF;
  END LOOP;
END $$;

-- UPDATE su tabelle opzionali (migrazioni V1 parziali): solo se la tabella esiste.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'connected_devices',
    'physiological_profiles',
    'planned_workouts',
    'executed_workouts',
    'load_series',
    'nutrition_constraints',
    'nutrition_plans',
    'biomarker_panels',
    'twin_states',
    'empathy_events',
    'metabolic_lab_runs',
    'device_sync_exports',
    'knowledge_evidence_hits',
    'manual_actions_queue',
    'athlete_update_locks',
    'training_import_jobs',
    'knowledge_research_traces',
    'food_diary_entries',
    'athlete_knowledge_bindings',
    'knowledge_modulation_snapshots',
    'session_knowledge_packets',
    'biomech_session_imports',
    'biomech_capture_jobs',
    'garmin_pull_jobs'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.%I SET athlete_id = (
           SELECT b.id FROM public.athlete_profiles b
           WHERE lower(trim(coalesce(b.email, ''''))) = lower(trim(''m@d1s.ch''))
           ORDER BY b.created_at ASC LIMIT 1
         ) WHERE athlete_id IN (
           SELECT a.id FROM public.athlete_profiles a
           WHERE lower(trim(coalesce(a.email, ''''))) = lower(trim(''m@d1s.ch''))
             AND a.id <> (
               SELECT b.id FROM public.athlete_profiles b
               WHERE lower(trim(coalesce(b.email, ''''))) = lower(trim(''m@d1s.ch''))
               ORDER BY b.created_at ASC LIMIT 1
             )
         )',
        t
      );
    END IF;
  END LOOP;
END $$;

DELETE FROM public.athlete_profiles ap
WHERE ap.id IN (
  SELECT a.id
  FROM public.athlete_profiles a
  WHERE lower(trim(coalesce(a.email, ''))) = lower(trim('m@d1s.ch'))
    AND a.id <> (
      SELECT b.id
      FROM public.athlete_profiles b
      WHERE lower(trim(coalesce(b.email, ''))) = lower(trim('m@d1s.ch'))
      ORDER BY b.created_at ASC
      LIMIT 1
    )
);

CREATE OR REPLACE FUNCTION public.athlete_profile_id_by_normalized_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ap.id
  FROM public.athlete_profiles ap
  WHERE p_email IS NOT NULL
    AND length(trim(p_email)) > 0
    AND ap.email IS NOT NULL
    AND length(trim(ap.email)) > 0
    AND lower(trim(ap.email)) = lower(trim(p_email))
  ORDER BY ap.created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.athlete_profile_id_by_normalized_email(text) IS
  'Prima riga athlete_profiles per email normalizzata (lower(trim)); usata da ensure-profile.';

GRANT EXECUTE ON FUNCTION public.athlete_profile_id_by_normalized_email(text) TO anon, authenticated, service_role;

CREATE UNIQUE INDEX IF NOT EXISTS uq_athlete_profiles_email_normalized
  ON public.athlete_profiles (lower(trim(email)))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;

COMMIT;
