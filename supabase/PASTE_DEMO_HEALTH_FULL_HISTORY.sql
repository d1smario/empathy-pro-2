-- =====================================================================
--  DEMO ONLY — Empathy Pro 2.0 (Health module) — STORICO COMPLETO
--
--  Crea per l'atleta corrispondente a `v_email` uno storico di 4-5 punti
--  per ognuno dei 6 panel-type Health (blood, microbiota, epigenetics,
--  hormones, inflammation, oxidative_stress) con valori canonici scritti
--  direttamente in `biomarker_panels.values` (no shadow proposals).
--
--  Coerenza con la pipeline canonica:
--    - tutte le chiavi corrispondono a quelle lette dai selettori
--      `readNum()` di apps/web/modules/health/views/HealthPageView.tsx
--    - source = 'health_demo_full_history_v1' (riconoscibile e cleanable)
--    - non tocca i seed `d1s-demo-janapr-v1-seed` esistenti né i panel
--      caricati via /api/health/upload-document
--
--  Idempotente: cleanup + INSERT ad ogni esecuzione (solo righe demo).
-- =====================================================================

DO $$
DECLARE
  v_email text := 'rova.ma79@gmail.com';
  v_uid uuid;
  v_athlete uuid;
  v_source text := 'health_demo_full_history_v1';
  v_dates date[] := ARRAY['2026-01-15','2026-02-15','2026-03-15','2026-04-15']::date[];
  v_d date;
  v_idx int;
  v_total int := 0;
BEGIN
  -- 1) Resolve athlete_id
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth.users email % non trovata', v_email;
  END IF;

  SELECT aup.athlete_id INTO v_athlete
  FROM public.app_user_profiles aup
  WHERE aup.user_id = v_uid LIMIT 1;
  IF v_athlete IS NULL THEN
    SELECT ap.id INTO v_athlete
    FROM public.athlete_profiles ap
    WHERE lower(ap.email) = lower(v_email)
    ORDER BY ap.updated_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_athlete IS NULL THEN
    RAISE EXCEPTION 'Nessun athlete_id per email %', v_email;
  END IF;

  RAISE NOTICE 'Demo full-history per % (athlete_id=%)', v_email, v_athlete;

  -- 2) Cleanup solo righe demo precedenti (idempotente)
  DELETE FROM public.biomarker_panels
  WHERE athlete_id = v_athlete AND source = v_source;

  -- 3) Loop: per ogni mese, INSERT 6 panel (uno per tipo) con valori canonici.
  --    I valori variano leggermente per dare un trend (es. methylation che migliora,
  --    oxidative stress che cala, microbiota diversità in salita).
  FOR v_idx IN 1..array_length(v_dates, 1) LOOP
    v_d := v_dates[v_idx];

    -- BLOOD ----------------------------------------------------------
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values) VALUES (
      v_athlete, 'blood', v_d, v_source,
      jsonb_build_object(
        'hb',                 round((14.4 + 0.10 * v_idx)::numeric, 2),
        'hematocrit',         round((43.0 + 0.30 * v_idx)::numeric, 1),
        'ferritin',           round((85 + 4 * v_idx)::numeric, 0),
        'vit_d',              round((34.0 + 1.5 * v_idx)::numeric, 1),
        'b12',                round((400 + 10 * v_idx)::numeric, 0),
        'folate',             round((11.0 + 0.4 * v_idx)::numeric, 1),
        'glucose',            round((89.0 - 0.6 * v_idx)::numeric, 1),
        'hba1c',              round((5.20 - 0.02 * v_idx)::numeric, 2),
        'crp_mg_l',           round((1.20 - 0.10 * v_idx)::numeric, 2),
        'total_cholesterol',  round((188 - 1.5 * v_idx)::numeric, 0),
        'ldl',                round((108 - 1.5 * v_idx)::numeric, 0),
        'hdl',                round((54 + 1.0 * v_idx)::numeric, 0),
        'triglycerides',      round((96 - 2.0 * v_idx)::numeric, 0),
        'ast',                22, 'alt', 18, 'ggt', 18,
        'creatinine',         0.95,
        'urea',               34,
        'sodium',             140, 'potassium', 4.3, 'magnesium', 2.1, 'calcium', 9.6,
        'homocysteine',       round((9.0 - 0.2 * v_idx)::numeric, 2),
        'tsh',                round((1.80 - 0.05 * v_idx)::numeric, 2),
        'health_score_ematici', round((85 + 1.5 * v_idx)::numeric, 0),
        'health_score_totale',  round((84 + 1.5 * v_idx)::numeric, 0),
        'import', jsonb_build_object('status','demo_canonical','source','health_demo_full_history_v1','note','demo seed values; canonical write')
      )
    );

    -- MICROBIOTA -----------------------------------------------------
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values) VALUES (
      v_athlete, 'microbiota', v_d + interval '2 days', v_source,
      jsonb_build_object(
        'firmicutes_pct',         round((50.0 + 0.6 * v_idx)::numeric, 1),
        'bacteroidetes_pct',      round((33.0 - 0.3 * v_idx)::numeric, 1),
        'proteobacteria_pct',     round((7.0 - 0.3 * v_idx)::numeric, 1),
        'actinobacteria_pct',     round((7.5 + 0.2 * v_idx)::numeric, 1),
        'verrucomicrobia_pct',    round((1.5 + 0.1 * v_idx)::numeric, 2),
        'diversity_shannon',      round((3.30 + 0.10 * v_idx)::numeric, 2),
        'diversity_simpson',      round((0.86 + 0.01 * v_idx)::numeric, 3),
        'dysbiosis_index',        round((30 - 2.0 * v_idx)::numeric, 0),
        'akkermansia_pct',        round((1.8 + 0.18 * v_idx)::numeric, 2),
        'faecalibacterium_pct',   round((9.5 + 0.5 * v_idx)::numeric, 2),
        'bifidobacterium_pct',    round((4.0 + 0.25 * v_idx)::numeric, 2),
        'lactobacillus_pct',      round((0.45 + 0.05 * v_idx)::numeric, 2),
        'roseburia_pct',          round((3.0 + 0.15 * v_idx)::numeric, 2),
        'prevotella_pct',         round((6.0 + 0.20 * v_idx)::numeric, 2),
        'butyrate_producers_pct', round((25 + 1.2 * v_idx)::numeric, 1),
        'lps_producers_pct',      round((9.0 - 0.30 * v_idx)::numeric, 1),
        'scfa_score',             round((68 + 1.5 * v_idx)::numeric, 0),
        'health_score_microbiota', round((76 + 2 * v_idx)::numeric, 0),
        'diversity_score',        round((72 + 1.5 * v_idx)::numeric, 0),
        'import', jsonb_build_object('status','demo_canonical','source','health_demo_full_history_v1','note','demo seed values; canonical write')
      )
    );

    -- EPIGENETICS ----------------------------------------------------
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values) VALUES (
      v_athlete, 'epigenetics', v_d + interval '3 days', v_source,
      jsonb_build_object(
        'methylation_score',          round((73 + 1.4 * v_idx)::numeric, 0),
        'biological_age_years',       round((33.5 - 0.4 * v_idx)::numeric, 1),
        'chronological_age_years',    36,
        'biological_age_delta',       round((-2.5 - 0.4 * v_idx)::numeric, 1),
        'pace_of_aging',              round((1.00 - 0.02 * v_idx)::numeric, 3),
        'horvath_clock',              round((33.5 - 0.3 * v_idx)::numeric, 1),
        'hannum_clock',               round((34.0 - 0.3 * v_idx)::numeric, 1),
        'phenoage',                   round((33.0 - 0.4 * v_idx)::numeric, 1),
        'grim_age',                   round((35.0 - 0.3 * v_idx)::numeric, 1),
        'telomere_length_kb',         round((7.9 + 0.1 * v_idx)::numeric, 2),
        'epigenetic_oxidative_stress', round((30 - 1.6 * v_idx)::numeric, 0),
        'epigenetic_detox',           round((68 + 1.2 * v_idx)::numeric, 0),
        'epigenetic_repair',          round((76 + 1.5 * v_idx)::numeric, 0),
        'inflammaging_score',         round((33 - 1.5 * v_idx)::numeric, 0),
        'mitochondrial_score',        round((72 + 1.2 * v_idx)::numeric, 0),
        'longevity_score',            round((81 + 1.0 * v_idx)::numeric, 0),
        'oxidative_methylation',      round((28 - 1.5 * v_idx)::numeric, 0),
        'health_score_epigenetica',   round((80 + 1.5 * v_idx)::numeric, 0),
        'import', jsonb_build_object('status','demo_canonical','source','health_demo_full_history_v1','note','demo seed values; canonical write')
      )
    );

    -- HORMONES -------------------------------------------------------
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values) VALUES (
      v_athlete, 'hormones', v_d + interval '4 days', v_source,
      jsonb_build_object(
        'cortisol_am',         round((14.5 - 0.20 * v_idx)::numeric, 2),
        'cortisol_pm',         round((6.2 - 0.15 * v_idx)::numeric, 2),
        'testosterone',        round((550 + 8 * v_idx)::numeric, 0),
        'testosterone_free',   round((11.8 + 0.20 * v_idx)::numeric, 2),
        'estradiol',           round((30 + 0.4 * v_idx)::numeric, 1),
        'progesterone',        round((0.6 + 0.02 * v_idx)::numeric, 2),
        'lh',                  round((4.2 + 0.10 * v_idx)::numeric, 2),
        'fsh',                 round((3.8 + 0.10 * v_idx)::numeric, 2),
        'prolactin',           round((9.0 - 0.15 * v_idx)::numeric, 2),
        'tsh',                 round((1.80 - 0.05 * v_idx)::numeric, 2),
        'ft3',                 round((3.20 + 0.05 * v_idx)::numeric, 2),
        'ft4',                 round((1.20 + 0.02 * v_idx)::numeric, 2),
        'dhea_s',              round((260 + 6 * v_idx)::numeric, 0),
        'igf1',                round((180 + 4 * v_idx)::numeric, 0),
        'gh',                  round((0.40 + 0.02 * v_idx)::numeric, 3),
        'melatonin_night',     round((35 + 1.0 * v_idx)::numeric, 1),
        'insulin',             round((7.5 - 0.2 * v_idx)::numeric, 2),
        'homa_ir',             round((1.55 - 0.04 * v_idx)::numeric, 3),
        'leptin',              round((4.5 - 0.1 * v_idx)::numeric, 2),
        'ghrelin',             round((85 + 1.5 * v_idx)::numeric, 1),
        'import', jsonb_build_object('status','demo_canonical','source','health_demo_full_history_v1','note','demo seed values; canonical write')
      )
    );

    -- INFLAMMATION ---------------------------------------------------
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values) VALUES (
      v_athlete, 'inflammation', v_d + interval '5 days', v_source,
      jsonb_build_object(
        'crp_mg_l',           round((1.30 - 0.10 * v_idx)::numeric, 2),
        'esr_mm_h',           round((8 - 0.5 * v_idx)::numeric, 0),
        'il6',                round((1.80 - 0.10 * v_idx)::numeric, 2),
        'il1b',               round((1.10 - 0.05 * v_idx)::numeric, 2),
        'il10',               round((2.5 + 0.1 * v_idx)::numeric, 2),
        'tnf_alpha',          round((7.5 - 0.20 * v_idx)::numeric, 2),
        'oxidized_ldl',       round((48 - 1.5 * v_idx)::numeric, 1),
        'homocysteine',       round((9.0 - 0.20 * v_idx)::numeric, 2),
        'fibrinogen',         round((265 - 4.0 * v_idx)::numeric, 0),
        'fecal_calprotectin', round((22 - 0.6 * v_idx)::numeric, 0),
        'lpa',                round((18 - 0.3 * v_idx)::numeric, 1),
        'neopterin',          round((6.0 + 0.05 * v_idx)::numeric, 2),
        'asma_score',         round((78 + 1.5 * v_idx)::numeric, 0),
        'import', jsonb_build_object('status','demo_canonical','source','health_demo_full_history_v1','note','demo seed values; canonical write')
      )
    );

    -- OXIDATIVE STRESS -----------------------------------------------
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values) VALUES (
      v_athlete, 'oxidative_stress', v_d + interval '6 days', v_source,
      jsonb_build_object(
        'd_roms',         round((305 - 5.0 * v_idx)::numeric, 0),
        'bap',            round((2300 + 20 * v_idx)::numeric, 0),
        'bap_score',      round((2300 + 20 * v_idx)::numeric, 0),
        'glutathione',    round((0.95 + 0.03 * v_idx)::numeric, 3),
        'sod',            round((1180 + 15 * v_idx)::numeric, 0),
        'catalase',       round((26000 + 500 * v_idx)::numeric, 0),
        'gpx',            round((35 + 0.8 * v_idx)::numeric, 1),
        'vitamin_e',      round((11.5 + 0.3 * v_idx)::numeric, 2),
        'vitamin_c',      round((9.0 + 0.2 * v_idx)::numeric, 2),
        'coq10',          round((1.30 + 0.04 * v_idx)::numeric, 3),
        'mda',            round((2.10 - 0.06 * v_idx)::numeric, 2),
        '8_ohdg',         round((4.50 - 0.10 * v_idx)::numeric, 2),
        'ros_total',      round((45 - 1.0 * v_idx)::numeric, 1),
        'total_antioxidant_capacity', round((78 + 1.0 * v_idx)::numeric, 1),
        'import', jsonb_build_object('status','demo_canonical','source','health_demo_full_history_v1','note','demo seed values; canonical write')
      )
    );

    v_total := v_total + 6;
  END LOOP;

  RAISE NOTICE 'Phase 1 full-history: inseriti % panel (% mesi × 6 tipi).', v_total, array_length(v_dates,1);
END;
$$;

-- =====================================================================
--  PHASE 2 — CAUSAL LAYER (extraction_runs + observations + nodes/edges)
--
--  Replica in SQL ciò che la pipeline canonica
--  `runHealthDeterministicPostProcess` produce dopo un upload reale:
--    - `extraction_runs` (audit decode)
--    - `lab_observations` / `hormone_observations` /
--      `microbiota_observations` / `epigenetic_observations`
--    - `athlete_system_nodes` + `athlete_system_edges` (causal graph)
--    - `bioenergetics_responses` (interpretation hints)
--    - `observation_lineage` (provenienza panel→run→observation/node)
--
--  Tutto è derivato dai panel demo (source = 'health_demo_full_history_v1')
--  creati nella Phase 1. Idempotente: pulisce le righe demo precedenti
--  riconoscibili via `extraction_runs.parser_version = 'health-demo-seed-v1'`.
-- =====================================================================

-- A) Estensione idempotente del dictionary per gli alias usati dal seed.
--    Il dictionary è il single source of truth: ci aggiungo alias mancanti
--    (es. `dhea_s` → marker `dhea`, `d_roms` → marker `roms_carr`).
update public.health_marker_dictionary
   set aliases = (select array_agg(distinct a) from unnest(aliases || array['dhea_s']) a),
       updated_at = now()
 where marker_key = 'dhea';

update public.health_marker_dictionary
   set aliases = (select array_agg(distinct a) from unnest(aliases || array['d_roms']) a),
       updated_at = now()
 where marker_key = 'roms_carr';

update public.health_marker_dictionary
   set aliases = (select array_agg(distinct a) from unnest(aliases || array['bap_score']) a),
       updated_at = now()
 where marker_key = 'bap_umol';

DO $$
DECLARE
  v_email text := 'rova.ma79@gmail.com';
  v_uid uuid;
  v_athlete uuid;
  v_seed_source text := 'health_demo_full_history_v1';
  v_parser text := 'health-demo-seed-v1';
  v_panel record;
  v_run_id uuid;
  v_obs_id uuid;
  v_marker_key text;
  v_unit text;
  v_label text;
  v_axis text;
  v_key text;
  v_val text;
  v_value numeric;
  v_taxon_key text;
  v_taxon_rank text;
  v_observed_at timestamptz;
  v_obs_count int := 0;
  v_lineage_count int := 0;
  v_node_count int := 0;
  v_edge_count int := 0;
  v_edge_cross int := 0;
  v_response_count int := 0;
BEGIN
  -- 1) Resolve athlete (stessa logica della Phase 1)
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth.users email % non trovata', v_email;
  END IF;
  SELECT aup.athlete_id INTO v_athlete
    FROM public.app_user_profiles aup
   WHERE aup.user_id = v_uid LIMIT 1;
  IF v_athlete IS NULL THEN
    SELECT ap.id INTO v_athlete
      FROM public.athlete_profiles ap
     WHERE lower(ap.email) = lower(v_email)
     ORDER BY ap.updated_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_athlete IS NULL THEN
    RAISE EXCEPTION 'Nessun athlete_id per email %', v_email;
  END IF;

  -- 2) Cleanup idempotente delle derived rows precedenti (solo demo).
  DELETE FROM public.observation_lineage
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = v_parser
     );
  DELETE FROM public.lab_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = v_parser
     );
  DELETE FROM public.hormone_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = v_parser
     );
  DELETE FROM public.microbiota_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = v_parser
     );
  DELETE FROM public.epigenetic_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (
       SELECT id FROM public.extraction_runs
        WHERE athlete_id = v_athlete AND parser_version = v_parser
     );
  DELETE FROM public.athlete_system_nodes
   WHERE athlete_id = v_athlete
     AND state ? '_demo_seed'
     AND state->>'_demo_seed' = v_seed_source;
  DELETE FROM public.athlete_system_edges
   WHERE athlete_id = v_athlete
     AND metadata ? '_demo_seed'
     AND metadata->>'_demo_seed' = v_seed_source;
  DELETE FROM public.bioenergetics_responses
   WHERE athlete_id = v_athlete
     AND response_key LIKE 'demo_seed_%';
  DELETE FROM public.extraction_runs
   WHERE athlete_id = v_athlete AND parser_version = v_parser;

  -- 3) Loop sui panel demo: per ognuno crea extraction_run + observations + lineage.
  FOR v_panel IN
    SELECT * FROM public.biomarker_panels
     WHERE athlete_id = v_athlete AND source = v_seed_source
     ORDER BY sample_date
  LOOP
    v_observed_at := (v_panel.sample_date::text || 'T00:00:00.000Z')::timestamptz;

    -- 3.1) extraction_run (audit del decode che -- in produzione -- avrebbe prodotto i valori)
    INSERT INTO public.extraction_runs (
      athlete_id, panel_id, source_kind, parser_version, status, source_hash, quality_report
    ) VALUES (
      v_athlete, v_panel.id, 'manual', v_parser, 'parsed_full',
      'demo:' || v_panel.id::text,
      jsonb_build_object(
        'panel_type', v_panel.type,
        'sample_date', v_panel.sample_date,
        'demo_seed', v_seed_source,
        'note', 'Synthetic canonical row injected via PASTE_DEMO_HEALTH_FULL_HISTORY (Phase 2)'
      )
    ) RETURNING id INTO v_run_id;

    -- 3.2) lineage panel→extraction_run
    INSERT INTO public.observation_lineage (
      athlete_id, extraction_run_id, source_table, source_id, target_table, target_id, relation, metadata
    ) VALUES (
      v_athlete, v_run_id, 'biomarker_panels', v_panel.id, 'extraction_runs', v_run_id, 'created_extraction_run',
      jsonb_build_object('parser_version', v_parser, 'source_kind', 'manual', '_demo_seed', v_seed_source)
    );
    v_lineage_count := v_lineage_count + 1;

    -- 3.3) Lab observations: per ogni chiave numerica del panel cerca il marker_key tramite key/aliases.
    --      Solo per panel non-microbiota (microbiota ha schema dedicato).
    IF v_panel.type IN ('blood','inflammation','oxidative_stress','epigenetics','hormones') THEN
      FOR v_key, v_val IN
        SELECT k, val
          FROM jsonb_each_text(v_panel.values - 'import' - 'vlm_proposals' - 'vlm_pending_validation') AS e(k, val)
         WHERE val ~ '^-?[0-9]+(\.[0-9]+)?$'
      LOOP
        v_value := v_val::numeric;
        v_marker_key := NULL;
        SELECT marker_key, unit, label
          INTO v_marker_key, v_unit, v_label
          FROM public.health_marker_dictionary
         WHERE panel_type = v_panel.type
           AND (marker_key = v_key OR aliases @> ARRAY[v_key])
         LIMIT 1;

        IF v_marker_key IS NOT NULL THEN
          INSERT INTO public.lab_observations (
            athlete_id, panel_id, extraction_run_id, marker_key, value_num,
            unit, raw_label, observed_at, confidence
          ) VALUES (
            v_athlete, v_panel.id, v_run_id, v_marker_key, v_value,
            v_unit, v_label, v_panel.sample_date, 0.95
          ) RETURNING id INTO v_obs_id;

          INSERT INTO public.observation_lineage (
            athlete_id, extraction_run_id, source_table, source_id, target_table, target_id, relation
          ) VALUES (
            v_athlete, v_run_id, 'extraction_runs', v_run_id, 'lab_observations', v_obs_id, 'extracted_observation'
          );
          v_obs_count := v_obs_count + 1;
          v_lineage_count := v_lineage_count + 1;

          -- 3.3.1) Per panel hormones, scrive anche su hormone_observations con asse coerente.
          IF v_panel.type = 'hormones' THEN
            v_axis := CASE
              WHEN v_marker_key IN ('cortisol_am','cortisol_pm','dhea') THEN 'hpa'
              WHEN v_marker_key IN ('testosterone') THEN 'hpg'
              WHEN v_marker_key IN ('tsh','t3','t4') THEN 'thyroid'
              ELSE 'other'
            END;
            INSERT INTO public.hormone_observations (
              athlete_id, panel_id, extraction_run_id, axis, marker_key, value_num, unit, observed_at, confidence
            ) VALUES (
              v_athlete, v_panel.id, v_run_id, v_axis, v_marker_key, v_value, v_unit, v_panel.sample_date, 0.95
            ) RETURNING id INTO v_obs_id;

            INSERT INTO public.observation_lineage (
              athlete_id, extraction_run_id, source_table, source_id, target_table, target_id, relation
            ) VALUES (
              v_athlete, v_run_id, 'extraction_runs', v_run_id, 'hormone_observations', v_obs_id, 'extracted_observation'
            );
            v_obs_count := v_obs_count + 1;
            v_lineage_count := v_lineage_count + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- 3.4) Microbiota observations: deriva taxon_key da chiavi `<taxon>_pct`.
    IF v_panel.type = 'microbiota' THEN
      FOR v_key, v_val IN
        SELECT k, val
          FROM jsonb_each_text(v_panel.values - 'import' - 'vlm_proposals' - 'vlm_pending_validation') AS e(k, val)
         WHERE k LIKE '%_pct'
           AND val ~ '^-?[0-9]+(\.[0-9]+)?$'
      LOOP
        v_value := v_val::numeric;
        v_taxon_key := regexp_replace(v_key, '_pct$', '');
        v_taxon_rank := CASE v_taxon_key
          WHEN 'firmicutes' THEN 'phylum'
          WHEN 'bacteroidetes' THEN 'phylum'
          WHEN 'proteobacteria' THEN 'phylum'
          WHEN 'actinobacteria' THEN 'phylum'
          WHEN 'verrucomicrobia' THEN 'phylum'
          WHEN 'akkermansia' THEN 'genus'
          WHEN 'faecalibacterium' THEN 'genus'
          WHEN 'bifidobacterium' THEN 'genus'
          WHEN 'lactobacillus' THEN 'genus'
          WHEN 'roseburia' THEN 'genus'
          WHEN 'prevotella' THEN 'genus'
          ELSE 'other'
        END;
        INSERT INTO public.microbiota_observations (
          athlete_id, panel_id, extraction_run_id, taxon_key, taxon_rank, domain_kind,
          abundance_pct, unit, observed_at, confidence, metadata
        ) VALUES (
          v_athlete, v_panel.id, v_run_id, v_taxon_key, v_taxon_rank, 'bacteria',
          v_value, '%', v_panel.sample_date, 0.92,
          jsonb_build_object('label', initcap(replace(v_taxon_key, '_', ' ')), '_demo_seed', v_seed_source)
        ) RETURNING id INTO v_obs_id;

        INSERT INTO public.observation_lineage (
          athlete_id, extraction_run_id, source_table, source_id, target_table, target_id, relation
        ) VALUES (
          v_athlete, v_run_id, 'extraction_runs', v_run_id, 'microbiota_observations', v_obs_id, 'extracted_observation'
        );
        v_obs_count := v_obs_count + 1;
        v_lineage_count := v_lineage_count + 1;
      END LOOP;
    END IF;

    -- 3.5) Epigenetic observation aggregata (1 row sintetica per panel).
    IF v_panel.type = 'epigenetics' AND (v_panel.values ? 'methylation_score') THEN
      v_value := (v_panel.values->>'methylation_score')::numeric;
      INSERT INTO public.epigenetic_observations (
        athlete_id, panel_id, extraction_run_id, methylation_flag, direction,
        value_num, observed_at, confidence, metadata
      ) VALUES (
        v_athlete, v_panel.id, v_run_id, 'overall_methylation',
        CASE WHEN v_value >= 70 THEN 'up' ELSE 'down' END,
        v_value, v_panel.sample_date, 0.85,
        jsonb_build_object(
          'biological_age_delta', v_panel.values->'biological_age_delta',
          'pace_of_aging', v_panel.values->'pace_of_aging',
          'epigenetic_detox', v_panel.values->'epigenetic_detox',
          'epigenetic_repair', v_panel.values->'epigenetic_repair',
          '_demo_seed', v_seed_source
        )
      ) RETURNING id INTO v_obs_id;

      INSERT INTO public.observation_lineage (
        athlete_id, extraction_run_id, source_table, source_id, target_table, target_id, relation
      ) VALUES (
        v_athlete, v_run_id, 'extraction_runs', v_run_id, 'epigenetic_observations', v_obs_id, 'extracted_observation'
      );
      v_obs_count := v_obs_count + 1;
      v_lineage_count := v_lineage_count + 1;
    END IF;

    -- 3.6) Causal nodes (graph atleta), uno per pattern presente in questo panel.
    IF (v_panel.values ? 'glucose') OR (v_panel.values ? 'hba1c') OR (v_panel.values ? 'glicemia') THEN
      INSERT INTO public.athlete_system_nodes (
        athlete_id, node_key, area, label, state, observed_at
      ) VALUES (
        v_athlete, 'glycemic_environment', 'biochimica', 'Ambiente glicemico',
        jsonb_build_object(
          'glicemia', v_panel.values->'glucose',
          'hba1c', v_panel.values->'hba1c',
          '_demo_seed', v_seed_source,
          'panel_id', v_panel.id
        ),
        v_observed_at
      ) ON CONFLICT (athlete_id, node_key, observed_at) DO NOTHING;
      v_node_count := v_node_count + 1;
    END IF;

    IF (v_panel.values ? 'crp_mg_l') OR (v_panel.values ? 'il6') OR (v_panel.values ? 'tnf_alpha') THEN
      INSERT INTO public.athlete_system_nodes (
        athlete_id, node_key, area, label, state, observed_at
      ) VALUES (
        v_athlete, 'inflammatory_pressure', 'biochimica', 'Pressione infiammatoria',
        jsonb_build_object(
          'crp_mg_l', v_panel.values->'crp_mg_l',
          'il6', v_panel.values->'il6',
          'tnf_alpha', v_panel.values->'tnf_alpha',
          '_demo_seed', v_seed_source,
          'panel_id', v_panel.id
        ),
        v_observed_at
      ) ON CONFLICT (athlete_id, node_key, observed_at) DO NOTHING;
      v_node_count := v_node_count + 1;
    END IF;

    IF (v_panel.values ? 'cortisol_am') OR (v_panel.values ? 'cortisol_pm') THEN
      INSERT INTO public.athlete_system_nodes (
        athlete_id, node_key, area, label, state, observed_at
      ) VALUES (
        v_athlete, 'hpa_axis_load', 'neuroendocrino', 'Carico asse HPA',
        jsonb_build_object(
          'cortisol_am', v_panel.values->'cortisol_am',
          'cortisol_pm', v_panel.values->'cortisol_pm',
          '_demo_seed', v_seed_source,
          'panel_id', v_panel.id
        ),
        v_observed_at
      ) ON CONFLICT (athlete_id, node_key, observed_at) DO NOTHING;
      v_node_count := v_node_count + 1;
    END IF;

    IF v_panel.type = 'microbiota' THEN
      INSERT INTO public.athlete_system_nodes (
        athlete_id, node_key, area, label, state, observed_at
      ) VALUES (
        v_athlete, 'microbiota_profile', 'microbiotica', 'Profilo microbiotico',
        jsonb_build_object(
          'diversity_shannon', v_panel.values->'diversity_shannon',
          'dysbiosis_index', v_panel.values->'dysbiosis_index',
          'firmicutes_pct', v_panel.values->'firmicutes_pct',
          'bacteroidetes_pct', v_panel.values->'bacteroidetes_pct',
          'akkermansia_pct', v_panel.values->'akkermansia_pct',
          '_demo_seed', v_seed_source,
          'panel_id', v_panel.id
        ),
        v_observed_at
      ) ON CONFLICT (athlete_id, node_key, observed_at) DO NOTHING;
      v_node_count := v_node_count + 1;
    END IF;

    IF v_panel.type = 'epigenetics' THEN
      INSERT INTO public.athlete_system_nodes (
        athlete_id, node_key, area, label, state, observed_at
      ) VALUES (
        v_athlete, 'epigenetic_profile', 'genetica', 'Profilo epigenetico',
        jsonb_build_object(
          'methylation_score', v_panel.values->'methylation_score',
          'biological_age_delta', v_panel.values->'biological_age_delta',
          'pace_of_aging', v_panel.values->'pace_of_aging',
          'epigenetic_detox', v_panel.values->'epigenetic_detox',
          'epigenetic_repair', v_panel.values->'epigenetic_repair',
          '_demo_seed', v_seed_source,
          'panel_id', v_panel.id
        ),
        v_observed_at
      ) ON CONFLICT (athlete_id, node_key, observed_at) DO NOTHING;
      v_node_count := v_node_count + 1;
    END IF;

    -- 3.7) Edge intra-panel: per inflammation panel, lega hpa_axis_load al panel stesso (se esiste).
    --      Resta intra-mese (stesso observed_at) tra inflammation e hpa.
    IF v_panel.type = 'inflammation' THEN
      INSERT INTO public.athlete_system_edges (
        athlete_id, from_node_key, to_node_key, effect_sign, confidence,
        evidence_refs, rule_key, rule_version, time_window, metadata, observed_at
      )
      SELECT
        v_athlete, 'hpa_axis_load', 'inflammatory_pressure', 'risk_up', 0.62,
        jsonb_build_array(jsonb_build_object('panel_id', v_panel.id, 'extraction_run_id', v_run_id)),
        NULL, 'v1', 'acute_0_72h',
        jsonb_build_object('source', 'demo_seed', '_demo_seed', v_seed_source),
        v_observed_at
      WHERE EXISTS (
        SELECT 1 FROM public.athlete_system_nodes n
        WHERE n.athlete_id = v_athlete
          AND n.node_key = 'hpa_axis_load'
          AND n.state->>'_demo_seed' = v_seed_source
          AND n.observed_at BETWEEN v_observed_at - INTERVAL '20 days' AND v_observed_at + INTERVAL '20 days'
      );
      v_edge_count := v_edge_count + 1;
    END IF;
  END LOOP;

  -- 4) Edge cross-panel: glycemic_environment ↔ microbiota_profile per ogni mese in cui esistono entrambi.
  --    Replica la regola `slow_carb_sulfur_aa_microbiota_risk` del causal_rule_catalog.
  WITH paired AS (
    SELECT DISTINCT n.observed_at AS gly_at, m.observed_at AS mic_at
      FROM public.athlete_system_nodes n
      JOIN public.athlete_system_nodes m
        ON m.athlete_id = n.athlete_id
       AND m.node_key = 'microbiota_profile'
       AND m.state->>'_demo_seed' = v_seed_source
       AND m.observed_at BETWEEN n.observed_at - INTERVAL '15 days' AND n.observed_at + INTERVAL '15 days'
     WHERE n.athlete_id = v_athlete
       AND n.node_key = 'glycemic_environment'
       AND n.state->>'_demo_seed' = v_seed_source
  )
  INSERT INTO public.athlete_system_edges (
    athlete_id, from_node_key, to_node_key, effect_sign, confidence,
    evidence_refs, rule_key, rule_version, time_window, metadata, observed_at
  )
  SELECT
    v_athlete, 'glycemic_environment', 'microbiota_profile', 'modulate', 0.66,
    jsonb_build_array(jsonb_build_object('athlete_id', v_athlete, 'phase', 'demo_seed')),
    'slow_carb_sulfur_aa_microbiota_risk', 'v1', 'post_recovery_0_24h',
    jsonb_build_object('source', 'demo_seed', '_demo_seed', v_seed_source),
    paired.gly_at
    FROM paired;
  GET DIAGNOSTICS v_edge_cross = ROW_COUNT;

  -- 5) Bioenergetics responses: 1 per mese in cui esiste microbiota_profile.
  INSERT INTO public.bioenergetics_responses (
    athlete_id, response_key, category, title, description,
    trigger_refs, mitigation_refs, severity, confidence, observed_at
  )
  SELECT
    v_athlete,
    'demo_seed_microbiota_glycemic_balance_' || to_char(p.sample_date, 'YYYY_MM'),
    'opportunity',
    'Equilibrio glicemico × microbiota in evoluzione',
    'Indice di disbiosi calante e ambiente glicemico stabile suggeriscono finestra metabolica favorevole per finalizzazione recupero e fueling preciso.',
    jsonb_build_array(
      jsonb_build_object('node', 'glycemic_environment', 'panel_date', p.sample_date),
      jsonb_build_object('node', 'microbiota_profile', 'panel_date', p.sample_date)
    ),
    jsonb_build_array(
      jsonb_build_object('lever', 'timing_cho'),
      jsonb_build_object('lever', 'fiber_diversity'),
      jsonb_build_object('lever', 'fermentation_tolerance_review')
    ),
    'low', 0.7,
    (p.sample_date::text || 'T00:00:00.000Z')::timestamptz
    FROM public.biomarker_panels p
   WHERE p.athlete_id = v_athlete
     AND p.source = v_seed_source
     AND p.type = 'microbiota';
  GET DIAGNOSTICS v_response_count = ROW_COUNT;

  RAISE NOTICE 'Phase 2 completata: % observations · % lineage rows · % nodes · % intra-edges · % cross-edges · % responses',
    v_obs_count, v_lineage_count, v_node_count, v_edge_count, v_edge_cross, v_response_count;
END;
$$;

-- =====================================================================
--  VERIFICA FINALE: una SELECT che fa vedere lo stato completo
-- =====================================================================
WITH ath AS (
  SELECT coalesce(
    (SELECT athlete_id FROM public.app_user_profiles
       WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'rova.ma79@gmail.com' LIMIT 1)),
    (SELECT id FROM public.athlete_profiles WHERE lower(email) = 'rova.ma79@gmail.com' ORDER BY updated_at DESC NULLS LAST LIMIT 1)
  ) AS athlete_id
)
SELECT
  (SELECT count(*) FROM public.biomarker_panels       WHERE athlete_id = (SELECT athlete_id FROM ath) AND source = 'health_demo_full_history_v1') AS panels,
  (SELECT count(*) FROM public.extraction_runs        WHERE athlete_id = (SELECT athlete_id FROM ath) AND parser_version = 'health-demo-seed-v1') AS extraction_runs,
  (SELECT count(*) FROM public.lab_observations       WHERE athlete_id = (SELECT athlete_id FROM ath) AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE parser_version = 'health-demo-seed-v1')) AS lab_obs,
  (SELECT count(*) FROM public.hormone_observations   WHERE athlete_id = (SELECT athlete_id FROM ath) AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE parser_version = 'health-demo-seed-v1')) AS hormone_obs,
  (SELECT count(*) FROM public.microbiota_observations WHERE athlete_id = (SELECT athlete_id FROM ath) AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE parser_version = 'health-demo-seed-v1')) AS microbiota_obs,
  (SELECT count(*) FROM public.epigenetic_observations WHERE athlete_id = (SELECT athlete_id FROM ath) AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE parser_version = 'health-demo-seed-v1')) AS epigenetic_obs,
  (SELECT count(*) FROM public.athlete_system_nodes   WHERE athlete_id = (SELECT athlete_id FROM ath) AND state->>'_demo_seed' = 'health_demo_full_history_v1') AS causal_nodes,
  (SELECT count(*) FROM public.athlete_system_edges   WHERE athlete_id = (SELECT athlete_id FROM ath) AND metadata->>'_demo_seed' = 'health_demo_full_history_v1') AS causal_edges,
  (SELECT count(*) FROM public.bioenergetics_responses WHERE athlete_id = (SELECT athlete_id FROM ath) AND response_key LIKE 'demo_seed_%') AS responses,
  (SELECT count(*) FROM public.observation_lineage    WHERE athlete_id = (SELECT athlete_id FROM ath) AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE parser_version = 'health-demo-seed-v1')) AS lineage_rows;
