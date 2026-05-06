-- =====================================================================
--  DEMO ONLY — Empathy Pro 2.0 (Health module)
--  Iniezione di "shadow VLM proposals" su panel `biomarker_panels` lasciati
--  in `needs_manual_review` (PDF non leggibili dal parser, file in storage,
--  VLM non chiamato). Popola la stessa shape che la pipeline canonica
--  produce (`apps/web/lib/health/health-document-pipeline.ts`):
--    panel.values.vlm_proposals[]  + vlm_pending_validation = true
--    panel.values.import.status    = 'vlm_proposed'
--    interpretation_staging_runs   = pending_validation
--
--  Convogliato sulla pipeline esistente (no parallel lines):
--    - chiavi e shape allineate a `persistHealthVlmStagingRun`
--    - i grafici Health leggono via `readNum` con fallback su `vlm_proposals`
--    - la conferma resta nella review canonica `/health/staging/<runId>`
--
--  Target: SOLO l'atleta corrispondente a v_email.
--  Non lascia tracce in produzione: trigger_source 'health_demo_vlm_shadow_seed'.
-- =====================================================================

DO $$
DECLARE
  v_email text := 'rova.ma79@gmail.com';
  v_uid uuid;
  v_athlete uuid;
  v_panel record;
  v_proposals jsonb;
  v_patches jsonb;
  v_avg_conf numeric;
  v_field_count int;
  v_inserted int := 0;
  v_skipped int := 0;
BEGIN
  -- 1) Resolve athlete_id (auth.users -> app_user_profiles -> athlete_profiles)
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth.users email % non trovata', v_email;
  END IF;

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
    RAISE EXCEPTION 'Nessun athlete_id per email %', v_email;
  END IF;

  RAISE NOTICE 'Seed VLM shadow per % (athlete_id=%)', v_email, v_athlete;

  -- 2) Loop sui panel `needs_manual_review` dell'atleta senza valori canonici
  FOR v_panel IN
    SELECT bp.id, bp.type, bp.sample_date, bp.values
    FROM public.biomarker_panels bp
    WHERE bp.athlete_id = v_athlete
      AND bp.type IN ('blood','microbiota','epigenetics','hormones','inflammation','oxidative_stress')
      AND coalesce(bp.values->'import'->>'status', '') IN ('needs_manual_review','failed','')
      AND (
        bp.values IS NULL
        OR (
          SELECT count(*)::int FROM jsonb_object_keys(bp.values) k
          WHERE k.k NOT IN ('import','vlm_proposals','vlm_pending_validation')
        ) = 0
      )
    ORDER BY bp.created_at DESC
  LOOP
    -- 3) Costruisci `vlm_proposals` realistiche per il tipo
    IF v_panel.type = 'blood' THEN
      v_proposals := jsonb_build_array(
        jsonb_build_object('field','hb','value',14.8,'unit','g/dL','reference_range',jsonb_build_object('low',13.0,'high',17.0),'confidence',0.92,'notes',null),
        jsonb_build_object('field','hematocrit','value',44.0,'unit','%','reference_range',jsonb_build_object('low',40.0,'high',50.0),'confidence',0.90,'notes',null),
        jsonb_build_object('field','ferritin','value',95,'unit','ng/mL','reference_range',jsonb_build_object('low',30,'high',300),'confidence',0.91,'notes',null),
        jsonb_build_object('field','vit_d','value',38,'unit','ng/mL','reference_range',jsonb_build_object('low',30,'high',60),'confidence',0.93,'notes','25-OH-D'),
        jsonb_build_object('field','b12','value',410,'unit','pg/mL','reference_range',jsonb_build_object('low',200,'high',900),'confidence',0.90,'notes',null),
        jsonb_build_object('field','glucose','value',88,'unit','mg/dL','reference_range',jsonb_build_object('low',70,'high',99),'confidence',0.95,'notes','fasting'),
        jsonb_build_object('field','crp_mg_l','value',0.7,'unit','mg/L','reference_range',jsonb_build_object('low',null,'high',5.0),'confidence',0.88,'notes','hs-CRP'),
        jsonb_build_object('field','total_cholesterol','value',182,'unit','mg/dL','reference_range',jsonb_build_object('low',null,'high',200),'confidence',0.93,'notes',null),
        jsonb_build_object('field','ldl','value',102,'unit','mg/dL','reference_range',jsonb_build_object('low',null,'high',130),'confidence',0.92,'notes',null),
        jsonb_build_object('field','hdl','value',58,'unit','mg/dL','reference_range',jsonb_build_object('low',40,'high',null),'confidence',0.93,'notes',null),
        jsonb_build_object('field','triglycerides','value',88,'unit','mg/dL','reference_range',jsonb_build_object('low',null,'high',150),'confidence',0.92,'notes',null),
        jsonb_build_object('field','ast','value',22,'unit','U/L','reference_range',jsonb_build_object('low',null,'high',40),'confidence',0.90,'notes',null),
        jsonb_build_object('field','alt','value',18,'unit','U/L','reference_range',jsonb_build_object('low',null,'high',41),'confidence',0.90,'notes',null),
        jsonb_build_object('field','creatinine','value',0.95,'unit','mg/dL','reference_range',jsonb_build_object('low',0.7,'high',1.3),'confidence',0.91,'notes',null),
        jsonb_build_object('field','homocysteine','value',8.2,'unit','umol/L','reference_range',jsonb_build_object('low',null,'high',15.0),'confidence',0.86,'notes',null),
        jsonb_build_object('field','tsh','value',1.6,'unit','mUI/L','reference_range',jsonb_build_object('low',0.4,'high',4.0),'confidence',0.92,'notes',null)
      );
    ELSIF v_panel.type = 'microbiota' THEN
      v_proposals := jsonb_build_array(
        jsonb_build_object('field','firmicutes_pct','value',52,'unit','%','reference_range',jsonb_build_object('low',40,'high',65),'confidence',0.92,'notes',null),
        jsonb_build_object('field','bacteroidetes_pct','value',32,'unit','%','reference_range',jsonb_build_object('low',20,'high',45),'confidence',0.92,'notes',null),
        jsonb_build_object('field','proteobacteria_pct','value',6,'unit','%','reference_range',jsonb_build_object('low',null,'high',10),'confidence',0.90,'notes',null),
        jsonb_build_object('field','actinobacteria_pct','value',8,'unit','%','reference_range',jsonb_build_object('low',1,'high',15),'confidence',0.90,'notes',null),
        jsonb_build_object('field','diversity_shannon','value',3.6,'unit',null,'reference_range',jsonb_build_object('low',2.5,'high',4.5),'confidence',0.88,'notes','alpha diversity'),
        jsonb_build_object('field','akkermansia_pct','value',2.4,'unit','%','reference_range',jsonb_build_object('low',0.5,'high',5),'confidence',0.85,'notes',null),
        jsonb_build_object('field','faecalibacterium_pct','value',11.2,'unit','%','reference_range',jsonb_build_object('low',5,'high',18),'confidence',0.88,'notes',null),
        jsonb_build_object('field','bifidobacterium_pct','value',4.8,'unit','%','reference_range',jsonb_build_object('low',1,'high',8),'confidence',0.86,'notes',null),
        jsonb_build_object('field','lactobacillus_pct','value',0.6,'unit','%','reference_range',jsonb_build_object('low',0.1,'high',2),'confidence',0.84,'notes',null),
        jsonb_build_object('field','butyrate_producers_pct','value',28,'unit','%','reference_range',jsonb_build_object('low',15,'high',40),'confidence',0.85,'notes',null),
        jsonb_build_object('field','dysbiosis_index','value',22,'unit',null,'reference_range',jsonb_build_object('low',null,'high',40),'confidence',0.83,'notes','0-100, basso = sano')
      );
    ELSIF v_panel.type = 'epigenetics' THEN
      v_proposals := jsonb_build_array(
        jsonb_build_object('field','methylation_score','value',78,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.91,'notes','0-100'),
        jsonb_build_object('field','biological_age_years','value',32,'unit','years','reference_range',null,'confidence',0.94,'notes',null),
        jsonb_build_object('field','chronological_age_years','value',36,'unit','years','reference_range',null,'confidence',0.99,'notes',null),
        jsonb_build_object('field','biological_age_delta','value',-4,'unit','years','reference_range',null,'confidence',0.92,'notes','bio < crono = positivo'),
        jsonb_build_object('field','pace_of_aging','value',0.92,'unit',null,'reference_range',jsonb_build_object('low',0.7,'high',1.3),'confidence',0.89,'notes','DunedinPACE; <1 = aging più lento'),
        jsonb_build_object('field','epigenetic_oxidative_stress','value',24,'unit',null,'reference_range',jsonb_build_object('low',null,'high',50),'confidence',0.88,'notes','0-100 basso = meglio'),
        jsonb_build_object('field','epigenetic_detox','value',72,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.88,'notes','0-100 alto = meglio'),
        jsonb_build_object('field','epigenetic_repair','value',81,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.89,'notes','0-100 alto = meglio'),
        jsonb_build_object('field','horvath_clock','value',32.5,'unit','years','reference_range',null,'confidence',0.87,'notes',null),
        jsonb_build_object('field','inflammaging_score','value',28,'unit',null,'reference_range',jsonb_build_object('low',null,'high',50),'confidence',0.86,'notes',null),
        jsonb_build_object('field','mitochondrial_score','value',76,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.85,'notes',null),
        jsonb_build_object('field','telomere_length_kb','value',8.2,'unit','kb','reference_range',jsonb_build_object('low',6.0,'high',10.5),'confidence',0.84,'notes',null),
        jsonb_build_object('field','longevity_score','value',85,'unit',null,'reference_range',jsonb_build_object('low',50,'high',100),'confidence',0.84,'notes',null)
      );
    ELSIF v_panel.type = 'hormones' THEN
      v_proposals := jsonb_build_array(
        jsonb_build_object('field','cortisol_am','value',14.0,'unit','ug/dL','reference_range',jsonb_build_object('low',6,'high',23),'confidence',0.93,'notes','08:00'),
        jsonb_build_object('field','cortisol_pm','value',5.5,'unit','ug/dL','reference_range',jsonb_build_object('low',2.5,'high',12),'confidence',0.91,'notes','20:00'),
        jsonb_build_object('field','testosterone','value',580,'unit','ng/dL','reference_range',jsonb_build_object('low',300,'high',1000),'confidence',0.92,'notes','total'),
        jsonb_build_object('field','testosterone_free','value',12.5,'unit','pg/mL','reference_range',jsonb_build_object('low',7.2,'high',24.0),'confidence',0.86,'notes',null),
        jsonb_build_object('field','tsh','value',1.6,'unit','mUI/L','reference_range',jsonb_build_object('low',0.4,'high',4.0),'confidence',0.93,'notes',null),
        jsonb_build_object('field','ft3','value',3.4,'unit','pg/mL','reference_range',jsonb_build_object('low',2.3,'high',4.2),'confidence',0.90,'notes',null),
        jsonb_build_object('field','ft4','value',1.3,'unit','ng/dL','reference_range',jsonb_build_object('low',0.8,'high',1.8),'confidence',0.91,'notes',null),
        jsonb_build_object('field','dhea_s','value',280,'unit','ug/dL','reference_range',jsonb_build_object('low',80,'high',560),'confidence',0.88,'notes',null),
        jsonb_build_object('field','igf1','value',195,'unit','ng/mL','reference_range',jsonb_build_object('low',115,'high',280),'confidence',0.89,'notes',null),
        jsonb_build_object('field','prolactin','value',8.0,'unit','ng/mL','reference_range',jsonb_build_object('low',2,'high',18),'confidence',0.86,'notes',null),
        jsonb_build_object('field','insulin','value',6.5,'unit','uUI/mL','reference_range',jsonb_build_object('low',2,'high',24),'confidence',0.86,'notes',null),
        jsonb_build_object('field','homa_ir','value',1.4,'unit',null,'reference_range',jsonb_build_object('low',null,'high',2.5),'confidence',0.84,'notes',null)
      );
    ELSIF v_panel.type = 'inflammation' THEN
      v_proposals := jsonb_build_array(
        jsonb_build_object('field','crp_mg_l','value',0.9,'unit','mg/L','reference_range',jsonb_build_object('low',null,'high',5.0),'confidence',0.93,'notes','hs-CRP'),
        jsonb_build_object('field','esr_mm_h','value',6,'unit','mm/h','reference_range',jsonb_build_object('low',null,'high',20),'confidence',0.90,'notes','VES'),
        jsonb_build_object('field','il6','value',1.4,'unit','pg/mL','reference_range',jsonb_build_object('low',null,'high',7.0),'confidence',0.86,'notes',null),
        jsonb_build_object('field','tnf_alpha','value',6.5,'unit','pg/mL','reference_range',jsonb_build_object('low',null,'high',15),'confidence',0.85,'notes',null),
        jsonb_build_object('field','il10','value',2.8,'unit','pg/mL','reference_range',jsonb_build_object('low',null,'high',12),'confidence',0.84,'notes',null),
        jsonb_build_object('field','homocysteine','value',8.2,'unit','umol/L','reference_range',jsonb_build_object('low',null,'high',15),'confidence',0.88,'notes',null),
        jsonb_build_object('field','oxidized_ldl','value',42,'unit','U/L','reference_range',jsonb_build_object('low',null,'high',60),'confidence',0.86,'notes',null),
        jsonb_build_object('field','fibrinogen','value',245,'unit','mg/dL','reference_range',jsonb_build_object('low',200,'high',400),'confidence',0.88,'notes',null)
      );
    ELSIF v_panel.type = 'oxidative_stress' THEN
      v_proposals := jsonb_build_array(
        jsonb_build_object('field','d_roms','value',285,'unit','U_CARR','reference_range',jsonb_build_object('low',250,'high',300),'confidence',0.92,'notes','radicali liberi'),
        jsonb_build_object('field','bap','value',2350,'unit','uM','reference_range',jsonb_build_object('low',2200,'high',3000),'confidence',0.91,'notes','antiossidanti'),
        jsonb_build_object('field','glutathione','value',1.05,'unit','mmol/L','reference_range',jsonb_build_object('low',0.6,'high',1.4),'confidence',0.88,'notes','GSH ridotto'),
        jsonb_build_object('field','sod','value',1240,'unit','U/g_Hb','reference_range',jsonb_build_object('low',900,'high',1600),'confidence',0.87,'notes',null),
        jsonb_build_object('field','catalase','value',28000,'unit','U/g_Hb','reference_range',jsonb_build_object('low',20000,'high',35000),'confidence',0.86,'notes',null),
        jsonb_build_object('field','gpx','value',38,'unit','U/g_Hb','reference_range',jsonb_build_object('low',25,'high',60),'confidence',0.85,'notes',null),
        jsonb_build_object('field','vitamin_e','value',12.5,'unit','mg/L','reference_range',jsonb_build_object('low',5.5,'high',17),'confidence',0.86,'notes',null),
        jsonb_build_object('field','vitamin_c','value',9.8,'unit','mg/L','reference_range',jsonb_build_object('low',5.0,'high',15),'confidence',0.85,'notes',null),
        jsonb_build_object('field','coq10','value',1.4,'unit','mg/L','reference_range',jsonb_build_object('low',0.5,'high',2.0),'confidence',0.84,'notes',null),
        jsonb_build_object('field','mda','value',1.8,'unit','umol/L','reference_range',jsonb_build_object('low',null,'high',3.5),'confidence',0.83,'notes','malondialdehyde')
      );
    ELSE
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_field_count := jsonb_array_length(v_proposals);
    SELECT round(avg((p->>'confidence')::numeric)::numeric, 3)
      INTO v_avg_conf
      FROM jsonb_array_elements(v_proposals) p;

    -- 4) UPDATE biomarker_panels.values con shadow proposals (preserva `import.*` esistente)
    UPDATE public.biomarker_panels bp
    SET
      source = 'health_demo_vlm_shadow_v1',
      values = (
        jsonb_set(
          jsonb_set(
            coalesce(bp.values, '{}'::jsonb) - 'vlm_proposals' - 'vlm_pending_validation',
            '{vlm_proposals}', v_proposals, true
          ),
          '{vlm_pending_validation}', 'true'::jsonb, true
        )
        || jsonb_build_object(
          'import',
          coalesce(bp.values->'import', '{}'::jsonb) || jsonb_build_object(
            'status', 'vlm_proposed',
            'note', 'Shadow VLM (demo seed): proposte da confermare in /health/staging/<runId>.',
            'vlm', jsonb_build_object(
              'provider', 'demo_seed',
              'model', 'pro2-shadow-v1',
              'detected_provider', null,
              'field_count', v_field_count,
              'quality_notes', jsonb_build_array('demo seed values; promote via review apply')
            )
          )
        )
      )
    WHERE bp.id = v_panel.id
      AND bp.athlete_id = v_athlete;

    -- 5) Costruisci `proposed_structured_patches` per `interpretation_staging_runs`
    SELECT jsonb_agg(
      jsonb_build_object(
        'target', 'health.' || v_panel.type,
        'action', 'set_field',
        'field', p->>'field',
        'proposed_value',
          CASE
            WHEN jsonb_typeof(p->'value') = 'number' THEN p->'value'
            ELSE to_jsonb(p->>'value')
          END,
        'unit', p->>'unit',
        'reference_range', p->'reference_range',
        'confidence', (p->>'confidence')::numeric,
        'notes', p->>'notes'
      )
    )
    INTO v_patches
    FROM jsonb_array_elements(v_proposals) p;

    INSERT INTO public.interpretation_staging_runs (
      athlete_id, domain, status, trigger_source, source_refs,
      candidate_bundle, proposed_structured_patches, confidence
    ) VALUES (
      v_athlete,
      'health',
      'pending_validation',
      'health_demo_vlm_shadow_seed',
      jsonb_build_array(jsonb_build_object('table', 'biomarker_panels', 'id', v_panel.id::text)),
      jsonb_build_object(
        'panel_type', v_panel.type,
        'sample_date', v_panel.sample_date,
        'vlm_provider', 'demo_seed',
        'vlm_model', 'pro2-shadow-v1',
        'detected_provider', null,
        'quality_notes', jsonb_build_array('demo seed; promote via apply'),
        'field_count', v_field_count,
        'demo_seed', true
      ),
      v_patches,
      v_avg_conf
    );

    v_inserted := v_inserted + 1;
    RAISE NOTICE '  * panel % (%) → % proposte (avg conf %)',
      v_panel.id, v_panel.type, v_field_count, v_avg_conf;
  END LOOP;

  RAISE NOTICE 'Done. Panel aggiornati con shadow VLM: %, skipped: %', v_inserted, v_skipped;
END;
$$;
