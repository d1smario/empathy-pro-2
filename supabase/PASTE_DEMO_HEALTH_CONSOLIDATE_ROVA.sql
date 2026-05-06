-- =====================================================================
--  EMPATHY Pro 2.0 — Health: consolidamento UNICA SORGENTE per rova.ma79
--
--  Obiettivo (no parallel lines):
--    - Cancellare i panel sintetici "history-as-vlm" (filename `demo_*`)
--      generati da PASTE_DEMO_HEALTH_FULL_HISTORY_AS_VLM.sql
--    - Cancellare le righe causal layer collegate (extraction_runs
--      parser_version='health-demo-seed-v1' + osservazioni dipendenti)
--    - Rinominare i panel PDF reali caricati dall'utente
--      (source='health_demo_vlm_shadow_v1', filename NON `demo_*`) in
--      source='vlm_user_upload' per chiarezza
--    - Lasciare intatti i 20 panel canonici Gen→Apr 2026 con flat keys
--      (source='d1s-demo-janapr-v1-seed') prodotti da
--      PASTE_DEMO_SEED_ROVA_MA79_JAN_APR_2026.sql
--
--  Risultato atteso:
--    - 1 sola sorgente "demo storica" Gen→Apr 2026 (canonical flat)
--    - eventuali PDF reali rimangono come vlm_user_upload (no banner se
--      vlm_pending_validation=false; review se true)
--    - readNum nel UI legge i flat canonici grazie agli alias allineati
--
--  Idempotente: si può rieseguire più volte.
-- =====================================================================

DO $$
DECLARE
  v_email text := 'rova.ma79@gmail.com';
  v_uid uuid;
  v_athlete uuid;
  v_seed_synth text := 'health_demo_vlm_shadow_v1';
  v_seed_real text := 'vlm_user_upload';
  v_canon text := 'd1s-demo-janapr-v1-seed';
  v_count_synth int := 0;
  v_count_real int := 0;
  v_count_canon int := 0;
  v_count_runs int := 0;
BEGIN
  -- Resolve athlete (auth.users → app_user_profiles → athlete_profiles fallback)
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth.users email % non trovata', v_email; END IF;
  SELECT aup.athlete_id INTO v_athlete FROM public.app_user_profiles aup WHERE aup.user_id = v_uid LIMIT 1;
  IF v_athlete IS NULL THEN
    SELECT ap.id INTO v_athlete FROM public.athlete_profiles ap
     WHERE lower(ap.email) = lower(v_email)
     ORDER BY ap.updated_at DESC NULLS LAST
     LIMIT 1;
  END IF;
  IF v_athlete IS NULL THEN RAISE EXCEPTION 'Nessun athlete_id per %', v_email; END IF;

  -- 1) Staging runs sintetici (history-as-vlm + altri trigger demo storici)
  DELETE FROM public.interpretation_staging_runs
   WHERE athlete_id = v_athlete
     AND trigger_source IN (
       'health_demo_history_as_vlm_seed',
       'health_demo_vlm_shadow_seed_history'
     );

  -- 2) Causal layer derivato dai panel sintetici (se applicato)
  DELETE FROM public.observation_lineage
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1'
     );
  DELETE FROM public.lab_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1'
     );
  DELETE FROM public.hormone_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1'
     );
  DELETE FROM public.microbiota_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1'
     );
  DELETE FROM public.epigenetic_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1'
     );
  DELETE FROM public.athlete_system_nodes
   WHERE athlete_id = v_athlete
     AND state ? '_demo_seed'
     AND state->>'_demo_seed' = 'health_demo_full_history_v1';
  DELETE FROM public.athlete_system_edges
   WHERE athlete_id = v_athlete
     AND metadata ? '_demo_seed'
     AND metadata->>'_demo_seed' = 'health_demo_full_history_v1';
  DELETE FROM public.bioenergetics_responses
   WHERE athlete_id = v_athlete
     AND response_key LIKE 'demo_seed_%';
  DELETE FROM public.extraction_runs
   WHERE athlete_id = v_athlete
     AND parser_version = 'health-demo-seed-v1';

  GET DIAGNOSTICS v_count_runs = ROW_COUNT;

  -- 3) Cancella i 24 panel sintetici (filename `demo_*` in import)
  DELETE FROM public.biomarker_panels
   WHERE athlete_id = v_athlete
     AND source = v_seed_synth
     AND COALESCE(values->'import'->>'filename', '') LIKE 'demo_%';
  GET DIAGNOSTICS v_count_synth = ROW_COUNT;

  -- 4) Rinomina i PDF reali (source shadow ma filename non-demo) per chiarezza
  UPDATE public.biomarker_panels
     SET source = v_seed_real
   WHERE athlete_id = v_athlete
     AND source = v_seed_synth
     AND COALESCE(values->'import'->>'filename', '') NOT LIKE 'demo_%';
  GET DIAGNOSTICS v_count_real = ROW_COUNT;

  -- 5) Stato canonico
  SELECT count(*) INTO v_count_canon
    FROM public.biomarker_panels
   WHERE athlete_id = v_athlete
     AND source = v_canon;

  RAISE NOTICE '── Health consolidate · rova.ma79@gmail.com ──';
  RAISE NOTICE 'athlete_id: %', v_athlete;
  RAISE NOTICE 'Panel sintetici (filename demo_*) cancellati: %', v_count_synth;
  RAISE NOTICE 'extraction_runs causal-layer cancellati: %', v_count_runs;
  RAISE NOTICE 'Panel PDF reali rinominati → %: %', v_seed_real, v_count_real;
  RAISE NOTICE 'Panel canonici (% ): %', v_canon, v_count_canon;
  IF v_count_canon = 0 THEN
    RAISE NOTICE '⚠ Nessun panel canonico trovato.';
    RAISE NOTICE '  Esegui PASTE_DEMO_SEED_ROVA_MA79_JAN_APR_2026.sql per popolare 20 panel (5 tipi × 4 mesi).';
  END IF;
END $$;

-- =====================================================================
-- VERIFICA FINALE — read-only
-- =====================================================================
WITH ath AS (
  SELECT aup.athlete_id
    FROM auth.users u
    JOIN public.app_user_profiles aup ON aup.user_id = u.id
   WHERE lower(u.email) = lower('rova.ma79@gmail.com')
   LIMIT 1
)
SELECT
  bp.type,
  bp.source,
  count(*) AS panel_count,
  min(bp.sample_date) AS first_sample,
  max(bp.sample_date) AS last_sample
FROM public.biomarker_panels bp
JOIN ath a ON bp.athlete_id = a.athlete_id
GROUP BY bp.type, bp.source
ORDER BY bp.type, bp.source;
