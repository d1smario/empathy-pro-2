-- Deduplica athlete_profiles per stessa email normalizzata, poi applica funzione (009) + indice univoco (010).
-- 1) Cambia solo la riga seguente se serve un altro indirizzo.
-- 2) Esegui tutto in SQL Editor (una volta). In caso di errore su una tabella assente, commenta quella UPDATE.

BEGIN;

CREATE TEMP TABLE _reap_keep ON COMMIT DROP AS
SELECT id AS keeper_id
FROM (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(trim(coalesce(email, '')))
      ORDER BY created_at ASC
    ) AS rn
  FROM public.athlete_profiles
  WHERE lower(trim(coalesce(email, ''))) = lower(trim('m@d1s.ch'))
) s
WHERE rn = 1;

CREATE TEMP TABLE _reap_los ON COMMIT DROP AS
SELECT id AS loser_id
FROM (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(trim(coalesce(email, '')))
      ORDER BY created_at ASC
    ) AS rn
  FROM public.athlete_profiles
  WHERE lower(trim(coalesce(email, ''))) = lower(trim('m@d1s.ch'))
) s
WHERE rn > 1;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM _reap_keep) <> 1 THEN
    RAISE EXCEPTION 'PASTE_DEDUPE: atteso esattamente 1 keeper per email (trovati %)', (SELECT COUNT(*) FROM _reap_keep);
  END IF;
END $$;

-- Conflitti UNIQUE(athlete_id) o equivalenti: elimina riga del loser se il keeper ha già una riga.
DELETE FROM public.physiological_profiles p
USING _reap_los l, _reap_keep k
WHERE p.athlete_id = l.loser_id
  AND EXISTS (SELECT 1 FROM public.physiological_profiles p2 WHERE p2.athlete_id = k.keeper_id);

DELETE FROM public.nutrition_constraints p
USING _reap_los l, _reap_keep k
WHERE p.athlete_id = l.loser_id
  AND EXISTS (SELECT 1 FROM public.nutrition_constraints p2 WHERE p2.athlete_id = k.keeper_id);

DELETE FROM public.load_series ls
USING _reap_los l, _reap_keep k
WHERE ls.athlete_id = l.loser_id
  AND EXISTS (
    SELECT 1
    FROM public.load_series ls2
    WHERE ls2.athlete_id = k.keeper_id
      AND ls2.date = ls.date
      AND ls2.load_kind = ls.load_kind
  );

DELETE FROM public.coach_athletes ca
USING _reap_los l, _reap_keep k
WHERE ca.athlete_id = l.loser_id
  AND EXISTS (
    SELECT 1
    FROM public.coach_athletes ca2
    WHERE ca2.org_id = ca.org_id
      AND ca2.coach_user_id = ca.coach_user_id
      AND ca2.athlete_id = k.keeper_id
  );

DELETE FROM public.garmin_athlete_links g
USING _reap_los l, _reap_keep k
WHERE g.athlete_id = l.loser_id
  AND EXISTS (SELECT 1 FROM public.garmin_athlete_links g2 WHERE g2.athlete_id = k.keeper_id);

-- Riassegnazione athlete_id → keeper
UPDATE public.connected_devices SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.physiological_profiles SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.planned_workouts SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.executed_workouts SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.load_series SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.nutrition_constraints SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.nutrition_plans SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.biomarker_panels SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.twin_states SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.empathy_events SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);

UPDATE public.metabolic_lab_runs SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.device_sync_exports SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.knowledge_evidence_hits SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.manual_actions_queue SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.athlete_update_locks SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.training_import_jobs SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.knowledge_research_traces SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.food_diary_entries SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);

UPDATE public.athlete_knowledge_bindings SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.knowledge_modulation_snapshots SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.session_knowledge_packets SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);

UPDATE public.biomech_session_imports SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.biomech_capture_jobs SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);

UPDATE public.garmin_athlete_links SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.garmin_pull_jobs SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);

UPDATE public.app_user_profiles SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);
UPDATE public.coach_athletes SET athlete_id = (SELECT keeper_id FROM _reap_keep) WHERE athlete_id IN (SELECT loser_id FROM _reap_los);

DELETE FROM public.athlete_profiles ap
WHERE ap.id IN (SELECT loser_id FROM _reap_los);

-- Completamento migrazioni 009 + 010 (funzione + indice; idempotente)
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
