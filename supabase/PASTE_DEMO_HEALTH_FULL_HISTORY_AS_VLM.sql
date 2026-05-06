-- =====================================================================
--  DEMO ONLY — Health storico completo come VLM shadow (rova.ma79)
--
--  Trasforma i 24 panel `health_demo_full_history_v1` (canonici flat)
--  in 24 panel VLM shadow, IDENTICA shape ai 3 PDF VLM che già popolano
--  le card. Strategia pragmatica: leva qualunque ambiguità sul lettore
--  flat e va dritti sul percorso `vlm_proposals[]` che vediamo funzionare.
--
--  Output:
--    - biomarker_panels.values = { vlm_proposals: [...], vlm_pending_validation: false,
--                                   import: { status: 'vlm_proposed', vlm: {...} } }
--    - biomarker_panels.source = 'health_demo_vlm_shadow_v1'
--    - interpretation_staging_runs = 24 righe pending_validation (history demo)
--    - vlm_pending_validation = false → niente banner di review (demo pulita)
--
--  Idempotente: cleanup + INSERT.
--  Trend: i valori cambiano leggermente mese su mese per linee storiche.
-- =====================================================================

DO $$
DECLARE
  v_email text := 'rova.ma79@gmail.com';
  v_uid uuid;
  v_athlete uuid;
  v_seed_old text := 'health_demo_full_history_v1';
  v_seed_new text := 'health_demo_vlm_shadow_v1';
  v_dates date[] := ARRAY['2026-01-15','2026-02-15','2026-03-15','2026-04-15']::date[];
  v_d date;
  v_idx int;
  v_panel_id uuid;
  v_proposals jsonb;
  v_patches jsonb;
  v_avg_conf numeric;
  v_inserted int := 0;
BEGIN
  -- Resolve athlete
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth.users email % non trovata', v_email; END IF;
  SELECT aup.athlete_id INTO v_athlete FROM public.app_user_profiles aup WHERE aup.user_id = v_uid LIMIT 1;
  IF v_athlete IS NULL THEN
    SELECT ap.id INTO v_athlete FROM public.athlete_profiles ap
     WHERE lower(ap.email) = lower(v_email) ORDER BY ap.updated_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_athlete IS NULL THEN RAISE EXCEPTION 'Nessun athlete_id per %', v_email; END IF;

  -- Cleanup: rimuove i 24 panel canonici precedenti + le righe causal derivate.
  DELETE FROM public.observation_lineage
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1');
  DELETE FROM public.lab_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1');
  DELETE FROM public.hormone_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1');
  DELETE FROM public.microbiota_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1');
  DELETE FROM public.epigenetic_observations
   WHERE athlete_id = v_athlete
     AND extraction_run_id IN (SELECT id FROM public.extraction_runs WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1');
  DELETE FROM public.athlete_system_nodes
   WHERE athlete_id = v_athlete AND state ? '_demo_seed' AND state->>'_demo_seed' = v_seed_old;
  DELETE FROM public.athlete_system_edges
   WHERE athlete_id = v_athlete AND metadata ? '_demo_seed' AND metadata->>'_demo_seed' = v_seed_old;
  DELETE FROM public.bioenergetics_responses
   WHERE athlete_id = v_athlete AND response_key LIKE 'demo_seed_%';
  DELETE FROM public.extraction_runs WHERE athlete_id = v_athlete AND parser_version = 'health-demo-seed-v1';

  -- Cancella eventuali staging runs precedenti del demo history-as-vlm
  DELETE FROM public.interpretation_staging_runs
   WHERE athlete_id = v_athlete
     AND trigger_source IN ('health_demo_history_as_vlm_seed','health_demo_vlm_shadow_seed_history');

  -- Cancella i panel canonici (se esistono) e quelli history-as-vlm precedenti
  DELETE FROM public.biomarker_panels
   WHERE athlete_id = v_athlete AND source IN (v_seed_old, v_seed_new);

  -- Loop: 4 mesi × 6 tipi = 24 panel VLM shadow
  FOR v_idx IN 1..array_length(v_dates,1) LOOP
    v_d := v_dates[v_idx];

    -- ============== BLOOD ==============
    v_proposals := jsonb_build_array(
      jsonb_build_object('field','hb','value',round((14.4 + 0.10*v_idx)::numeric,2),'unit','g/dL','reference_range',jsonb_build_object('low',13.0,'high',17.0),'confidence',0.94,'notes',null),
      jsonb_build_object('field','hematocrit','value',round((43.0 + 0.30*v_idx)::numeric,1),'unit','%','reference_range',jsonb_build_object('low',40.0,'high',50.0),'confidence',0.93,'notes',null),
      jsonb_build_object('field','ferritin','value',(85 + 4*v_idx),'unit','ng/mL','reference_range',jsonb_build_object('low',30,'high',300),'confidence',0.93,'notes',null),
      jsonb_build_object('field','vit_d','value',round((34.0 + 1.5*v_idx)::numeric,1),'unit','ng/mL','reference_range',jsonb_build_object('low',30,'high',60),'confidence',0.95,'notes','25-OH-D'),
      jsonb_build_object('field','b12','value',(400 + 10*v_idx),'unit','pg/mL','reference_range',jsonb_build_object('low',200,'high',900),'confidence',0.92,'notes',null),
      jsonb_build_object('field','folate','value',round((11.0 + 0.4*v_idx)::numeric,1),'unit','ng/mL','reference_range',jsonb_build_object('low',3.0,'high',20.0),'confidence',0.90,'notes',null),
      jsonb_build_object('field','glucose','value',round((89.0 - 0.6*v_idx)::numeric,1),'unit','mg/dL','reference_range',jsonb_build_object('low',70,'high',99),'confidence',0.96,'notes','fasting'),
      jsonb_build_object('field','hba1c','value',round((5.20 - 0.02*v_idx)::numeric,2),'unit','%','reference_range',jsonb_build_object('low',null,'high',5.7),'confidence',0.93,'notes',null),
      jsonb_build_object('field','crp_mg_l','value',round((1.20 - 0.10*v_idx)::numeric,2),'unit','mg/L','reference_range',jsonb_build_object('low',null,'high',5.0),'confidence',0.91,'notes','hs-CRP'),
      jsonb_build_object('field','total_cholesterol','value',(188 - 1.5*v_idx)::int,'unit','mg/dL','reference_range',jsonb_build_object('low',null,'high',200),'confidence',0.93,'notes',null),
      jsonb_build_object('field','ldl','value',(108 - 1.5*v_idx)::int,'unit','mg/dL','reference_range',jsonb_build_object('low',null,'high',130),'confidence',0.92,'notes',null),
      jsonb_build_object('field','hdl','value',(54 + 1.0*v_idx)::int,'unit','mg/dL','reference_range',jsonb_build_object('low',40,'high',null),'confidence',0.93,'notes',null),
      jsonb_build_object('field','triglycerides','value',(96 - 2.0*v_idx)::int,'unit','mg/dL','reference_range',jsonb_build_object('low',null,'high',150),'confidence',0.92,'notes',null),
      jsonb_build_object('field','ast','value',22,'unit','U/L','reference_range',jsonb_build_object('low',null,'high',40),'confidence',0.91,'notes',null),
      jsonb_build_object('field','alt','value',18,'unit','U/L','reference_range',jsonb_build_object('low',null,'high',41),'confidence',0.91,'notes',null),
      jsonb_build_object('field','ggt','value',18,'unit','U/L','reference_range',jsonb_build_object('low',null,'high',60),'confidence',0.90,'notes',null),
      jsonb_build_object('field','creatinine','value',0.95,'unit','mg/dL','reference_range',jsonb_build_object('low',0.7,'high',1.3),'confidence',0.92,'notes',null),
      jsonb_build_object('field','homocysteine','value',round((9.0 - 0.2*v_idx)::numeric,2),'unit','umol/L','reference_range',jsonb_build_object('low',null,'high',15.0),'confidence',0.88,'notes',null),
      jsonb_build_object('field','tsh','value',round((1.80 - 0.05*v_idx)::numeric,2),'unit','mUI/L','reference_range',jsonb_build_object('low',0.4,'high',4.0),'confidence',0.93,'notes',null)
    );
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values)
    VALUES (
      v_athlete, 'blood', v_d, v_seed_new,
      jsonb_build_object(
        'vlm_proposals', v_proposals,
        'vlm_pending_validation', false,
        'import', jsonb_build_object(
          'status','vlm_proposed','source','health_demo_history_as_vlm','filename','demo_blood_'||to_char(v_d,'YYYY_MM')||'.pdf','mime','application/pdf',
          'vlm', jsonb_build_object('provider','demo_seed','model','pro2-shadow-v1','field_count', jsonb_array_length(v_proposals),'quality_notes', jsonb_build_array('demo seed history'))
        )
      )
    ) RETURNING id INTO v_panel_id;
    -- staging run
    SELECT round(avg((p->>'confidence')::numeric)::numeric, 3) INTO v_avg_conf FROM jsonb_array_elements(v_proposals) p;
    SELECT jsonb_agg(jsonb_build_object('target','health.blood','action','set_field','field',p->>'field','proposed_value',p->'value','unit',p->>'unit','reference_range',p->'reference_range','confidence',(p->>'confidence')::numeric,'notes',p->>'notes')) INTO v_patches FROM jsonb_array_elements(v_proposals) p;
    INSERT INTO public.interpretation_staging_runs (athlete_id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence)
    VALUES (v_athlete,'health','pending_validation','health_demo_history_as_vlm_seed',
      jsonb_build_array(jsonb_build_object('table','biomarker_panels','id',v_panel_id::text)),
      jsonb_build_object('panel_type','blood','sample_date',v_d,'vlm_provider','demo_seed','vlm_model','pro2-shadow-v1','field_count',jsonb_array_length(v_proposals),'demo_seed',true),
      v_patches, v_avg_conf);
    v_inserted := v_inserted + 1;

    -- ============== MICROBIOTA ==============
    v_proposals := jsonb_build_array(
      jsonb_build_object('field','firmicutes_pct','value',round((50.0 + 0.6*v_idx)::numeric,1),'unit','%','reference_range',jsonb_build_object('low',40,'high',65),'confidence',0.92,'notes',null),
      jsonb_build_object('field','bacteroidetes_pct','value',round((33.0 - 0.3*v_idx)::numeric,1),'unit','%','reference_range',jsonb_build_object('low',20,'high',45),'confidence',0.92,'notes',null),
      jsonb_build_object('field','proteobacteria_pct','value',round((7.0 - 0.3*v_idx)::numeric,1),'unit','%','reference_range',jsonb_build_object('low',null,'high',10),'confidence',0.90,'notes',null),
      jsonb_build_object('field','actinobacteria_pct','value',round((7.5 + 0.2*v_idx)::numeric,1),'unit','%','reference_range',jsonb_build_object('low',1,'high',15),'confidence',0.90,'notes',null),
      jsonb_build_object('field','verrucomicrobia_pct','value',round((1.5 + 0.1*v_idx)::numeric,2),'unit','%','reference_range',jsonb_build_object('low',null,'high',5),'confidence',0.86,'notes',null),
      jsonb_build_object('field','diversity_shannon','value',round((3.30 + 0.10*v_idx)::numeric,2),'unit',null,'reference_range',jsonb_build_object('low',2.5,'high',4.5),'confidence',0.90,'notes','alpha diversity'),
      jsonb_build_object('field','diversity_simpson','value',round((0.86 + 0.01*v_idx)::numeric,3),'unit',null,'reference_range',jsonb_build_object('low',0.7,'high',0.95),'confidence',0.88,'notes',null),
      jsonb_build_object('field','dysbiosis_index','value',(30 - 2*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',null,'high',40),'confidence',0.86,'notes','0-100, basso = sano'),
      jsonb_build_object('field','akkermansia_pct','value',round((1.8 + 0.18*v_idx)::numeric,2),'unit','%','reference_range',jsonb_build_object('low',0.5,'high',5),'confidence',0.86,'notes',null),
      jsonb_build_object('field','faecalibacterium_pct','value',round((9.5 + 0.5*v_idx)::numeric,2),'unit','%','reference_range',jsonb_build_object('low',5,'high',18),'confidence',0.89,'notes',null),
      jsonb_build_object('field','bifidobacterium_pct','value',round((4.0 + 0.25*v_idx)::numeric,2),'unit','%','reference_range',jsonb_build_object('low',1,'high',8),'confidence',0.87,'notes',null),
      jsonb_build_object('field','lactobacillus_pct','value',round((0.45 + 0.05*v_idx)::numeric,2),'unit','%','reference_range',jsonb_build_object('low',0.1,'high',2),'confidence',0.85,'notes',null),
      jsonb_build_object('field','roseburia_pct','value',round((3.0 + 0.15*v_idx)::numeric,2),'unit','%','reference_range',jsonb_build_object('low',1,'high',6),'confidence',0.84,'notes',null),
      jsonb_build_object('field','prevotella_pct','value',round((6.0 + 0.20*v_idx)::numeric,2),'unit','%','reference_range',jsonb_build_object('low',null,'high',12),'confidence',0.85,'notes',null),
      jsonb_build_object('field','butyrate_producers_pct','value',round((25 + 1.2*v_idx)::numeric,1),'unit','%','reference_range',jsonb_build_object('low',15,'high',40),'confidence',0.86,'notes',null),
      jsonb_build_object('field','lps_producers_pct','value',round((9.0 - 0.30*v_idx)::numeric,1),'unit','%','reference_range',jsonb_build_object('low',null,'high',10),'confidence',0.84,'notes',null),
      jsonb_build_object('field','scfa_score','value',(68 + 1.5*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.84,'notes',null)
    );
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values)
    VALUES (
      v_athlete, 'microbiota', v_d + interval '2 days', v_seed_new,
      jsonb_build_object(
        'vlm_proposals', v_proposals,
        'vlm_pending_validation', false,
        'import', jsonb_build_object(
          'status','vlm_proposed','source','health_demo_history_as_vlm','filename','demo_microbiota_'||to_char(v_d,'YYYY_MM')||'.pdf','mime','application/pdf',
          'vlm', jsonb_build_object('provider','demo_seed','model','pro2-shadow-v1','field_count', jsonb_array_length(v_proposals),'quality_notes', jsonb_build_array('demo seed history'))
        )
      )
    ) RETURNING id INTO v_panel_id;
    SELECT round(avg((p->>'confidence')::numeric)::numeric, 3) INTO v_avg_conf FROM jsonb_array_elements(v_proposals) p;
    SELECT jsonb_agg(jsonb_build_object('target','health.microbiota','action','set_field','field',p->>'field','proposed_value',p->'value','unit',p->>'unit','reference_range',p->'reference_range','confidence',(p->>'confidence')::numeric,'notes',p->>'notes')) INTO v_patches FROM jsonb_array_elements(v_proposals) p;
    INSERT INTO public.interpretation_staging_runs (athlete_id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence)
    VALUES (v_athlete,'health','pending_validation','health_demo_history_as_vlm_seed',
      jsonb_build_array(jsonb_build_object('table','biomarker_panels','id',v_panel_id::text)),
      jsonb_build_object('panel_type','microbiota','sample_date',v_d + interval '2 days','vlm_provider','demo_seed','vlm_model','pro2-shadow-v1','field_count',jsonb_array_length(v_proposals),'demo_seed',true),
      v_patches, v_avg_conf);
    v_inserted := v_inserted + 1;

    -- ============== EPIGENETICS ==============
    v_proposals := jsonb_build_array(
      jsonb_build_object('field','methylation_score','value',(73 + 1.4*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.91,'notes','0-100'),
      jsonb_build_object('field','biological_age_years','value',round((33.5 - 0.4*v_idx)::numeric,1),'unit','years','reference_range',null,'confidence',0.94,'notes',null),
      jsonb_build_object('field','chronological_age_years','value',36,'unit','years','reference_range',null,'confidence',0.99,'notes',null),
      jsonb_build_object('field','biological_age_delta','value',round((-2.5 - 0.4*v_idx)::numeric,1),'unit','years','reference_range',null,'confidence',0.93,'notes','bio < crono = positivo'),
      jsonb_build_object('field','pace_of_aging','value',round((1.00 - 0.02*v_idx)::numeric,3),'unit',null,'reference_range',jsonb_build_object('low',0.7,'high',1.3),'confidence',0.89,'notes','DunedinPACE'),
      jsonb_build_object('field','horvath_clock','value',round((33.5 - 0.3*v_idx)::numeric,1),'unit','years','reference_range',null,'confidence',0.88,'notes',null),
      jsonb_build_object('field','hannum_clock','value',round((34.0 - 0.3*v_idx)::numeric,1),'unit','years','reference_range',null,'confidence',0.87,'notes',null),
      jsonb_build_object('field','phenoage','value',round((33.0 - 0.4*v_idx)::numeric,1),'unit','years','reference_range',null,'confidence',0.86,'notes',null),
      jsonb_build_object('field','grim_age','value',round((35.0 - 0.3*v_idx)::numeric,1),'unit','years','reference_range',null,'confidence',0.85,'notes',null),
      jsonb_build_object('field','telomere_length_kb','value',round((7.9 + 0.1*v_idx)::numeric,2),'unit','kb','reference_range',jsonb_build_object('low',6.0,'high',10.5),'confidence',0.84,'notes',null),
      jsonb_build_object('field','epigenetic_oxidative_stress','value',(30 - 1.6*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',null,'high',50),'confidence',0.88,'notes','basso = meglio'),
      jsonb_build_object('field','epigenetic_detox','value',(68 + 1.2*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.88,'notes','alto = meglio'),
      jsonb_build_object('field','epigenetic_repair','value',(76 + 1.5*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.89,'notes','alto = meglio'),
      jsonb_build_object('field','inflammaging_score','value',(33 - 1.5*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',null,'high',50),'confidence',0.86,'notes',null),
      jsonb_build_object('field','mitochondrial_score','value',(72 + 1.2*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.85,'notes',null),
      jsonb_build_object('field','longevity_score','value',(81 + 1.0*v_idx)::int,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.84,'notes',null)
    );
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values)
    VALUES (
      v_athlete, 'epigenetics', v_d + interval '3 days', v_seed_new,
      jsonb_build_object(
        'vlm_proposals', v_proposals,
        'vlm_pending_validation', false,
        'import', jsonb_build_object(
          'status','vlm_proposed','source','health_demo_history_as_vlm','filename','demo_epigenetics_'||to_char(v_d,'YYYY_MM')||'.pdf','mime','application/pdf',
          'vlm', jsonb_build_object('provider','demo_seed','model','pro2-shadow-v1','field_count', jsonb_array_length(v_proposals),'quality_notes', jsonb_build_array('demo seed history'))
        )
      )
    ) RETURNING id INTO v_panel_id;
    SELECT round(avg((p->>'confidence')::numeric)::numeric, 3) INTO v_avg_conf FROM jsonb_array_elements(v_proposals) p;
    SELECT jsonb_agg(jsonb_build_object('target','health.epigenetics','action','set_field','field',p->>'field','proposed_value',p->'value','unit',p->>'unit','reference_range',p->'reference_range','confidence',(p->>'confidence')::numeric,'notes',p->>'notes')) INTO v_patches FROM jsonb_array_elements(v_proposals) p;
    INSERT INTO public.interpretation_staging_runs (athlete_id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence)
    VALUES (v_athlete,'health','pending_validation','health_demo_history_as_vlm_seed',
      jsonb_build_array(jsonb_build_object('table','biomarker_panels','id',v_panel_id::text)),
      jsonb_build_object('panel_type','epigenetics','sample_date',v_d + interval '3 days','vlm_provider','demo_seed','vlm_model','pro2-shadow-v1','field_count',jsonb_array_length(v_proposals),'demo_seed',true),
      v_patches, v_avg_conf);
    v_inserted := v_inserted + 1;

    -- ============== HORMONES ==============
    v_proposals := jsonb_build_array(
      jsonb_build_object('field','cortisol_am','value',round((14.5 - 0.20*v_idx)::numeric,2),'unit','ug/dL','reference_range',jsonb_build_object('low',6,'high',23),'confidence',0.93,'notes','08:00'),
      jsonb_build_object('field','cortisol_pm','value',round((6.2 - 0.15*v_idx)::numeric,2),'unit','ug/dL','reference_range',jsonb_build_object('low',2.5,'high',12),'confidence',0.91,'notes','20:00'),
      jsonb_build_object('field','testosterone','value',(550 + 8*v_idx)::int,'unit','ng/dL','reference_range',jsonb_build_object('low',300,'high',1000),'confidence',0.92,'notes','total'),
      jsonb_build_object('field','testosterone_free','value',round((11.8 + 0.20*v_idx)::numeric,2),'unit','pg/mL','reference_range',jsonb_build_object('low',7.2,'high',24.0),'confidence',0.86,'notes',null),
      jsonb_build_object('field','estradiol','value',round((30 + 0.4*v_idx)::numeric,1),'unit','pg/mL','reference_range',jsonb_build_object('low',7,'high',42),'confidence',0.85,'notes',null),
      jsonb_build_object('field','lh','value',round((4.2 + 0.10*v_idx)::numeric,2),'unit','mUI/mL','reference_range',jsonb_build_object('low',1.7,'high',8.6),'confidence',0.87,'notes',null),
      jsonb_build_object('field','fsh','value',round((3.8 + 0.10*v_idx)::numeric,2),'unit','mUI/mL','reference_range',jsonb_build_object('low',1.5,'high',12),'confidence',0.87,'notes',null),
      jsonb_build_object('field','prolactin','value',round((9.0 - 0.15*v_idx)::numeric,2),'unit','ng/mL','reference_range',jsonb_build_object('low',2,'high',18),'confidence',0.88,'notes',null),
      jsonb_build_object('field','tsh','value',round((1.80 - 0.05*v_idx)::numeric,2),'unit','mUI/L','reference_range',jsonb_build_object('low',0.4,'high',4.0),'confidence',0.93,'notes',null),
      jsonb_build_object('field','ft3','value',round((3.20 + 0.05*v_idx)::numeric,2),'unit','pg/mL','reference_range',jsonb_build_object('low',2.3,'high',4.2),'confidence',0.90,'notes',null),
      jsonb_build_object('field','ft4','value',round((1.20 + 0.02*v_idx)::numeric,2),'unit','ng/dL','reference_range',jsonb_build_object('low',0.8,'high',1.8),'confidence',0.91,'notes',null),
      jsonb_build_object('field','dhea_s','value',(260 + 6*v_idx)::int,'unit','ug/dL','reference_range',jsonb_build_object('low',80,'high',560),'confidence',0.88,'notes',null),
      jsonb_build_object('field','igf1','value',(180 + 4*v_idx)::int,'unit','ng/mL','reference_range',jsonb_build_object('low',115,'high',280),'confidence',0.89,'notes',null),
      jsonb_build_object('field','melatonin_night','value',round((35 + 1.0*v_idx)::numeric,1),'unit','pg/mL','reference_range',jsonb_build_object('low',10,'high',60),'confidence',0.84,'notes','03:00'),
      jsonb_build_object('field','insulin','value',round((7.5 - 0.2*v_idx)::numeric,2),'unit','uUI/mL','reference_range',jsonb_build_object('low',2,'high',24),'confidence',0.86,'notes',null),
      jsonb_build_object('field','homa_ir','value',round((1.55 - 0.04*v_idx)::numeric,3),'unit',null,'reference_range',jsonb_build_object('low',null,'high',2.5),'confidence',0.84,'notes',null),
      jsonb_build_object('field','leptin','value',round((4.5 - 0.1*v_idx)::numeric,2),'unit','ng/mL','reference_range',jsonb_build_object('low',1,'high',9),'confidence',0.83,'notes',null)
    );
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values)
    VALUES (
      v_athlete, 'hormones', v_d + interval '4 days', v_seed_new,
      jsonb_build_object(
        'vlm_proposals', v_proposals,
        'vlm_pending_validation', false,
        'import', jsonb_build_object(
          'status','vlm_proposed','source','health_demo_history_as_vlm','filename','demo_hormones_'||to_char(v_d,'YYYY_MM')||'.pdf','mime','application/pdf',
          'vlm', jsonb_build_object('provider','demo_seed','model','pro2-shadow-v1','field_count', jsonb_array_length(v_proposals),'quality_notes', jsonb_build_array('demo seed history'))
        )
      )
    ) RETURNING id INTO v_panel_id;
    SELECT round(avg((p->>'confidence')::numeric)::numeric, 3) INTO v_avg_conf FROM jsonb_array_elements(v_proposals) p;
    SELECT jsonb_agg(jsonb_build_object('target','health.hormones','action','set_field','field',p->>'field','proposed_value',p->'value','unit',p->>'unit','reference_range',p->'reference_range','confidence',(p->>'confidence')::numeric,'notes',p->>'notes')) INTO v_patches FROM jsonb_array_elements(v_proposals) p;
    INSERT INTO public.interpretation_staging_runs (athlete_id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence)
    VALUES (v_athlete,'health','pending_validation','health_demo_history_as_vlm_seed',
      jsonb_build_array(jsonb_build_object('table','biomarker_panels','id',v_panel_id::text)),
      jsonb_build_object('panel_type','hormones','sample_date',v_d + interval '4 days','vlm_provider','demo_seed','vlm_model','pro2-shadow-v1','field_count',jsonb_array_length(v_proposals),'demo_seed',true),
      v_patches, v_avg_conf);
    v_inserted := v_inserted + 1;

    -- ============== INFLAMMATION ==============
    v_proposals := jsonb_build_array(
      jsonb_build_object('field','crp_mg_l','value',round((1.30 - 0.10*v_idx)::numeric,2),'unit','mg/L','reference_range',jsonb_build_object('low',null,'high',5.0),'confidence',0.93,'notes','hs-CRP'),
      jsonb_build_object('field','esr_mm_h','value',(8 - 0.5*v_idx)::int,'unit','mm/h','reference_range',jsonb_build_object('low',null,'high',20),'confidence',0.90,'notes','VES'),
      jsonb_build_object('field','il6','value',round((1.80 - 0.10*v_idx)::numeric,2),'unit','pg/mL','reference_range',jsonb_build_object('low',null,'high',7.0),'confidence',0.86,'notes',null),
      jsonb_build_object('field','il1b','value',round((1.10 - 0.05*v_idx)::numeric,2),'unit','pg/mL','reference_range',jsonb_build_object('low',null,'high',5.0),'confidence',0.85,'notes',null),
      jsonb_build_object('field','il10','value',round((2.5 + 0.1*v_idx)::numeric,2),'unit','pg/mL','reference_range',jsonb_build_object('low',null,'high',12),'confidence',0.84,'notes','antiinfiammatoria'),
      jsonb_build_object('field','tnf_alpha','value',round((7.5 - 0.20*v_idx)::numeric,2),'unit','pg/mL','reference_range',jsonb_build_object('low',null,'high',15),'confidence',0.85,'notes',null),
      jsonb_build_object('field','oxidized_ldl','value',round((48 - 1.5*v_idx)::numeric,1),'unit','U/L','reference_range',jsonb_build_object('low',null,'high',60),'confidence',0.86,'notes',null),
      jsonb_build_object('field','homocysteine','value',round((9.0 - 0.20*v_idx)::numeric,2),'unit','umol/L','reference_range',jsonb_build_object('low',null,'high',15),'confidence',0.88,'notes',null),
      jsonb_build_object('field','fibrinogen','value',(265 - 4*v_idx)::int,'unit','mg/dL','reference_range',jsonb_build_object('low',200,'high',400),'confidence',0.88,'notes',null),
      jsonb_build_object('field','fecal_calprotectin','value',round((22 - 0.6*v_idx)::numeric,1),'unit','ug/g','reference_range',jsonb_build_object('low',null,'high',50),'confidence',0.84,'notes',null),
      jsonb_build_object('field','lpa','value',round((18 - 0.3*v_idx)::numeric,1),'unit','mg/dL','reference_range',jsonb_build_object('low',null,'high',30),'confidence',0.83,'notes','lipoprotein(a)')
    );
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values)
    VALUES (
      v_athlete, 'inflammation', v_d + interval '5 days', v_seed_new,
      jsonb_build_object(
        'vlm_proposals', v_proposals,
        'vlm_pending_validation', false,
        'import', jsonb_build_object(
          'status','vlm_proposed','source','health_demo_history_as_vlm','filename','demo_inflammation_'||to_char(v_d,'YYYY_MM')||'.pdf','mime','application/pdf',
          'vlm', jsonb_build_object('provider','demo_seed','model','pro2-shadow-v1','field_count', jsonb_array_length(v_proposals),'quality_notes', jsonb_build_array('demo seed history'))
        )
      )
    ) RETURNING id INTO v_panel_id;
    SELECT round(avg((p->>'confidence')::numeric)::numeric, 3) INTO v_avg_conf FROM jsonb_array_elements(v_proposals) p;
    SELECT jsonb_agg(jsonb_build_object('target','health.inflammation','action','set_field','field',p->>'field','proposed_value',p->'value','unit',p->>'unit','reference_range',p->'reference_range','confidence',(p->>'confidence')::numeric,'notes',p->>'notes')) INTO v_patches FROM jsonb_array_elements(v_proposals) p;
    INSERT INTO public.interpretation_staging_runs (athlete_id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence)
    VALUES (v_athlete,'health','pending_validation','health_demo_history_as_vlm_seed',
      jsonb_build_array(jsonb_build_object('table','biomarker_panels','id',v_panel_id::text)),
      jsonb_build_object('panel_type','inflammation','sample_date',v_d + interval '5 days','vlm_provider','demo_seed','vlm_model','pro2-shadow-v1','field_count',jsonb_array_length(v_proposals),'demo_seed',true),
      v_patches, v_avg_conf);
    v_inserted := v_inserted + 1;

    -- ============== OXIDATIVE STRESS ==============
    v_proposals := jsonb_build_array(
      jsonb_build_object('field','d_roms','value',(305 - 5*v_idx)::int,'unit','U_CARR','reference_range',jsonb_build_object('low',250,'high',300),'confidence',0.92,'notes','radicali liberi'),
      jsonb_build_object('field','bap','value',(2300 + 20*v_idx)::int,'unit','uM','reference_range',jsonb_build_object('low',2200,'high',3000),'confidence',0.91,'notes','antiossidanti'),
      jsonb_build_object('field','glutathione','value',round((0.95 + 0.03*v_idx)::numeric,3),'unit','mmol/L','reference_range',jsonb_build_object('low',0.6,'high',1.4),'confidence',0.88,'notes','GSH ridotto'),
      jsonb_build_object('field','sod','value',(1180 + 15*v_idx)::int,'unit','U/g_Hb','reference_range',jsonb_build_object('low',900,'high',1600),'confidence',0.87,'notes',null),
      jsonb_build_object('field','catalase','value',(26000 + 500*v_idx)::int,'unit','U/g_Hb','reference_range',jsonb_build_object('low',20000,'high',35000),'confidence',0.86,'notes',null),
      jsonb_build_object('field','gpx','value',round((35 + 0.8*v_idx)::numeric,1),'unit','U/g_Hb','reference_range',jsonb_build_object('low',25,'high',60),'confidence',0.85,'notes',null),
      jsonb_build_object('field','vitamin_e','value',round((11.5 + 0.3*v_idx)::numeric,2),'unit','mg/L','reference_range',jsonb_build_object('low',5.5,'high',17),'confidence',0.86,'notes',null),
      jsonb_build_object('field','vitamin_c','value',round((9.0 + 0.2*v_idx)::numeric,2),'unit','mg/L','reference_range',jsonb_build_object('low',5.0,'high',15),'confidence',0.85,'notes',null),
      jsonb_build_object('field','coq10','value',round((1.30 + 0.04*v_idx)::numeric,3),'unit','mg/L','reference_range',jsonb_build_object('low',0.5,'high',2.0),'confidence',0.84,'notes',null),
      jsonb_build_object('field','mda','value',round((2.10 - 0.06*v_idx)::numeric,2),'unit','umol/L','reference_range',jsonb_build_object('low',null,'high',3.5),'confidence',0.83,'notes','malondialdehyde'),
      jsonb_build_object('field','8_ohdg','value',round((4.50 - 0.10*v_idx)::numeric,2),'unit','ng/mL','reference_range',jsonb_build_object('low',null,'high',8),'confidence',0.82,'notes','danno DNA ossidativo')
    );
    INSERT INTO public.biomarker_panels (athlete_id, type, sample_date, source, values)
    VALUES (
      v_athlete, 'oxidative_stress', v_d + interval '6 days', v_seed_new,
      jsonb_build_object(
        'vlm_proposals', v_proposals,
        'vlm_pending_validation', false,
        'import', jsonb_build_object(
          'status','vlm_proposed','source','health_demo_history_as_vlm','filename','demo_oxidative_'||to_char(v_d,'YYYY_MM')||'.pdf','mime','application/pdf',
          'vlm', jsonb_build_object('provider','demo_seed','model','pro2-shadow-v1','field_count', jsonb_array_length(v_proposals),'quality_notes', jsonb_build_array('demo seed history'))
        )
      )
    ) RETURNING id INTO v_panel_id;
    SELECT round(avg((p->>'confidence')::numeric)::numeric, 3) INTO v_avg_conf FROM jsonb_array_elements(v_proposals) p;
    SELECT jsonb_agg(jsonb_build_object('target','health.oxidative_stress','action','set_field','field',p->>'field','proposed_value',p->'value','unit',p->>'unit','reference_range',p->'reference_range','confidence',(p->>'confidence')::numeric,'notes',p->>'notes')) INTO v_patches FROM jsonb_array_elements(v_proposals) p;
    INSERT INTO public.interpretation_staging_runs (athlete_id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence)
    VALUES (v_athlete,'health','pending_validation','health_demo_history_as_vlm_seed',
      jsonb_build_array(jsonb_build_object('table','biomarker_panels','id',v_panel_id::text)),
      jsonb_build_object('panel_type','oxidative_stress','sample_date',v_d + interval '6 days','vlm_provider','demo_seed','vlm_model','pro2-shadow-v1','field_count',jsonb_array_length(v_proposals),'demo_seed',true),
      v_patches, v_avg_conf);
    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE 'Done. % panel VLM shadow inseriti (4 mesi × 6 tipi).', v_inserted;
END;
$$;

-- =====================================================================
--  Verifica finale: panel + staging runs creati per la demo VLM history
-- =====================================================================
WITH ath AS (
  SELECT coalesce(
    (SELECT athlete_id FROM public.app_user_profiles
       WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'rova.ma79@gmail.com' LIMIT 1)),
    (SELECT id FROM public.athlete_profiles WHERE lower(email) = 'rova.ma79@gmail.com' ORDER BY updated_at DESC NULLS LAST LIMIT 1)
  ) AS athlete_id
)
SELECT
  type,
  count(*) AS panels,
  sum(jsonb_array_length(values->'vlm_proposals')) AS total_proposals,
  array_agg(sample_date::text ORDER BY sample_date) AS dates
FROM public.biomarker_panels
WHERE athlete_id = (SELECT athlete_id FROM ath)
  AND source = 'health_demo_vlm_shadow_v1'
GROUP BY type
ORDER BY type;
