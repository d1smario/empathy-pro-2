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

  RAISE NOTICE 'Demo full-history: inseriti % panel (% mesi × 6 tipi).', v_total, array_length(v_dates,1);
END;
$$;
