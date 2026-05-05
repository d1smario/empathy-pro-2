-- =============================================================================
-- EMPATHY Pro 2.0 — Demo seed completo (gennaio-aprile 2026)
-- =============================================================================
-- Target: account contact@d1s.ch
-- Obiettivo: dataset demo realistico per presentazioni clienti/investitori, senza
--            conflitto con pianificazione futura (solo date passate).
--
-- Include:
--   - Planned + executed multisport (cycling, running, swimming, xc_ski)
--   - Device exports: whoop / cgm / garmin / wahoo / strava
--   - Recovery continuo: sonno (tot/deep/rem/light), FC notturna, HRV notturna
--   - Trace workout con core temp, SmO2, sodio/potassio sudore, VO2/VCO2
--   - Biomarker panels (glucosio, lattato, NAD, testosterone, NO)
--   - Twin snapshots periodici
--
-- Sicurezza:
--   - Idempotente: cleanup solo righe con prefisso demo "d1s-demo-janapr-v1-"
--   - Scope stretto: solo athlete_id risolto da contact@d1s.ch
-- =============================================================================

ALTER TABLE public.device_sync_exports DROP CONSTRAINT IF EXISTS device_sync_exports_provider_check;

ALTER TABLE public.device_sync_exports ADD CONSTRAINT device_sync_exports_provider_check
  CHECK (
    provider IN (
      'garmin',
      'garmin_connectiq',
      'trainingpeaks',
      'strava',
      'wahoo',
      'coros',
      'polar',
      'whoop',
      'oura',
      'cgm',
      'suunto',
      'apple_watch',
      'zwift',
      'hammerhead',
      'other'
    )
  );

DO $$
DECLARE
  v_email text := 'contact@d1s.ch';
  v_uid uuid;
  v_athlete uuid;
  v_prefix text := 'd1s-demo-janapr-v1-';
  v_start date := '2026-01-01'::date;
  v_end date := '2026-04-30'::date;
  d date;
  v_day text;
  v_day_idx int := 0;
  v_planned uuid;
  v_sport text;
  v_type text;
  v_duration int;
  v_tss numeric;
  v_kj numeric;
  v_kcal numeric;
  v_sleep_total numeric;
  v_sleep_deep numeric;
  v_sleep_rem numeric;
  v_sleep_light numeric;
  v_resting_hr numeric;
  v_hrv numeric;
  v_core_temp numeric;
  v_smo2 numeric;
  v_na_sweat numeric;
  v_k_sweat numeric;
  v_vo2 numeric;
  v_vco2 numeric;
  v_glucose numeric;
  v_lactate numeric;
  v_nad numeric;
  v_testosterone numeric;
  v_no_index numeric;
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
    RAISE EXCEPTION
      'Nessun athlete_id trovato per email %. Verifica signup e app_user_profiles / athlete_profiles.',
      v_email;
  END IF;

  RAISE NOTICE 'Seed demo (%): athlete_id = %', v_prefix, v_athlete;

  -- CLEANUP (solo righe demo con prefisso)
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

  -- Profilo / baseline
  UPDATE public.athlete_profiles
  SET
    first_name = COALESCE(NULLIF(trim(first_name), ''), 'D1S'),
    last_name = COALESCE(NULLIF(trim(last_name), ''), 'Demo'),
    email = COALESCE(NULLIF(trim(email), ''), v_email),
    height_cm = COALESCE(height_cm, 180),
    weight_kg = COALESCE(weight_kg, 73.2),
    resting_hr_bpm = COALESCE(resting_hr_bpm, 47),
    max_hr_bpm = COALESCE(max_hr_bpm, 189),
    updated_at = now()
  WHERE id = v_athlete;

  INSERT INTO public.physiological_profiles (
    athlete_id,
    ftp_watts,
    lt1_watts,
    lt2_watts,
    vo2max_ml_min_kg,
    baseline_hrv_ms,
    baseline_hrv_std,
    baseline_temp_c,
    baseline_glucose_mmol,
    updated_at
  )
  VALUES (
    v_athlete,
    292,
    202,
    252,
    59.2,
    58.0,
    10.5,
    36.8,
    5.0,
    now()
  )
  ON CONFLICT (athlete_id) DO UPDATE SET
    ftp_watts = EXCLUDED.ftp_watts,
    lt1_watts = EXCLUDED.lt1_watts,
    lt2_watts = EXCLUDED.lt2_watts,
    vo2max_ml_min_kg = EXCLUDED.vo2max_ml_min_kg,
    baseline_hrv_ms = EXCLUDED.baseline_hrv_ms,
    baseline_hrv_std = EXCLUDED.baseline_hrv_std,
    baseline_temp_c = EXCLUDED.baseline_temp_c,
    baseline_glucose_mmol = EXCLUDED.baseline_glucose_mmol,
    updated_at = now();

  -- Connected devices demo
  INSERT INTO public.connected_devices (
    athlete_id, provider, external_id, provider_account_id, device_model, device_name, connection_status, last_sync_at, enabled, metadata, updated_at
  )
  VALUES
    (v_athlete, 'whoop',  v_prefix || 'device-whoop',  v_prefix || 'acct-whoop',  'WHOOP 4.0', 'Whoop Band', 'active', now(), true, jsonb_build_object('demo_seed', true), now()),
    (v_athlete, 'garmin', v_prefix || 'device-garmin', v_prefix || 'acct-garmin', 'Edge 1040', 'Garmin Edge', 'active', now(), true, jsonb_build_object('demo_seed', true), now()),
    (v_athlete, 'wahoo',  v_prefix || 'device-wahoo',  v_prefix || 'acct-wahoo',  'ELEMNT ROAM', 'Wahoo Roam', 'active', now(), true, jsonb_build_object('demo_seed', true), now()),
    (v_athlete, 'strava', v_prefix || 'device-strava', v_prefix || 'acct-strava', 'Strava API', 'Strava Cloud', 'active', now(), true, jsonb_build_object('demo_seed', true), now()),
    (v_athlete, 'cgm',    v_prefix || 'device-cgm',    v_prefix || 'acct-cgm',    'Dexcom Demo', 'CGM Stream', 'active', now(), true, jsonb_build_object('demo_seed', true), now());

  -- Timeline gen-apr: planned + executed + device streams
  FOR d IN SELECT gs::date FROM generate_series(v_start::timestamp, v_end::timestamp, interval '1 day') gs LOOP
    v_day_idx := v_day_idx + 1;
    v_day := to_char(d, 'YYYY-MM-DD');

    -- Recupero notturno daily (whoop-like)
    v_sleep_total := 6.6 + ((v_day_idx % 11) * 0.18);
    v_sleep_deep := 1.0 + ((v_day_idx % 6) * 0.11);
    v_sleep_rem := 1.2 + ((v_day_idx % 5) * 0.10);
    v_sleep_light := GREATEST(2.8, v_sleep_total - v_sleep_deep - v_sleep_rem);
    v_resting_hr := 45 + (v_day_idx % 8);
    v_hrv := 49 + (v_day_idx % 14) * 1.6;

    INSERT INTO public.device_sync_exports (
      athlete_id, provider, sync_kind, status, external_ref, payload, created_at, updated_at, ingested_at, processed_at
    )
    VALUES (
      v_athlete,
      'whoop',
      'pull',
      'done',
      v_prefix || 'whoop-' || v_day,
      jsonb_build_object(
        'adapterKey', 'whoop:recovery:api_sync',
        'sourcePayload', jsonb_build_object(
          'summary_date', v_day,
          'sleep_hours', round(v_sleep_total, 2),
          'sleep_deep_hours', round(v_sleep_deep, 2),
          'sleep_rem_hours', round(v_sleep_rem, 2),
          'sleep_light_hours', round(v_sleep_light, 2),
          'resting_hr_bpm', v_resting_hr,
          'hrv_rmssd_ms', round(v_hrv, 1),
          'recovery_score', 63 + (v_day_idx % 30),
          'strain_score', round(8.2 + (v_day_idx % 9) * 0.55, 2),
          'skin_temp_c', round(33.8 + (v_day_idx % 4) * 0.15, 2)
        ),
        'realityIngestion', jsonb_build_object(
          'canonicalPreview', jsonb_build_object(
            'source_date', v_day,
            'sleep_hours', round(v_sleep_total, 2),
            'sleep_deep_hours', round(v_sleep_deep, 2),
            'sleep_rem_hours', round(v_sleep_rem, 2),
            'sleep_light_hours', round(v_sleep_light, 2),
            'resting_hr_bpm', v_resting_hr,
            'hrv_rmssd_ms', round(v_hrv, 1)
          )
        )
      ),
      timezone('UTC', d::timestamp + interval '06:15'),
      now(),
      timezone('UTC', d::timestamp + interval '06:18'),
      timezone('UTC', d::timestamp + interval '06:19')
    );

    -- CGM daily stream
    v_glucose := 4.7 + ((v_day_idx % 10) * 0.14);
    INSERT INTO public.device_sync_exports (
      athlete_id, provider, sync_kind, status, external_ref, payload, created_at, updated_at, ingested_at, processed_at
    )
    VALUES (
      v_athlete,
      'cgm',
      'pull',
      'done',
      v_prefix || 'cgm-' || v_day,
      jsonb_build_object(
        'adapterKey', 'cgm:daily:summary',
        'sourcePayload', jsonb_build_object(
          'date', v_day,
          'glucose_mmol_l_avg', round(v_glucose, 2),
          'time_in_range_pct', 82 + (v_day_idx % 14),
          'glucose_variability_cv', round(16.0 + (v_day_idx % 6) * 1.2, 2)
        )
      ),
      timezone('UTC', d::timestamp + interval '07:10'),
      now(),
      timezone('UTC', d::timestamp + interval '07:12'),
      timezone('UTC', d::timestamp + interval '07:13')
    );

    -- Solo 4 giorni settimana pianificati (lun-mar-gio-sab) per evidenziare pattern
    IF extract(isodow FROM d) IN (1, 2, 4, 6) THEN
      CASE (v_day_idx % 4)
        WHEN 1 THEN v_sport := 'cycling';
        WHEN 2 THEN v_sport := 'running';
        WHEN 3 THEN v_sport := 'swimming';
        ELSE v_sport := 'xc_ski';
      END CASE;

      v_type := CASE
        WHEN (v_day_idx % 6) IN (0, 1) THEN 'endurance'
        WHEN (v_day_idx % 6) IN (2, 3) THEN 'tempo'
        ELSE 'vo2max'
      END;

      v_duration := 55 + ((v_day_idx % 8) * 9);
      v_tss := 58 + ((v_day_idx % 9) * 8);
      v_kj := 1500 + ((v_day_idx % 11) * 160);
      v_kcal := 480 + ((v_day_idx % 10) * 42);

      INSERT INTO public.planned_workouts (
        athlete_id, date, type, duration_minutes, tss_target, kj_target, kcal_target, zone_split, adaptive_goal, notes, created_at, updated_at
      )
      VALUES (
        v_athlete,
        d,
        v_type,
        v_duration,
        v_tss,
        v_kj,
        v_kcal,
        jsonb_build_object('z1', 22, 'z2', 38, 'z3', 26, 'z4', 10, 'z5', 4),
        'demo_consistency_build',
        v_prefix || 'planned-' || v_day || '-' || v_sport,
        now(),
        now()
      )
      RETURNING id INTO v_planned;

      -- completion ~78%: alcuni planned restano non eseguiti per mostrare differenza.
      IF (v_day_idx % 9) NOT IN (0, 4) THEN
        v_core_temp := 37.2 + ((v_day_idx % 5) * 0.12);
        v_smo2 := 82.0 + ((v_day_idx % 7) * 1.4);
        v_na_sweat := 640 + ((v_day_idx % 9) * 38);
        v_k_sweat := 172 + ((v_day_idx % 6) * 12);
        v_vo2 := 3.15 + ((v_day_idx % 8) * 0.11);
        v_vco2 := 2.85 + ((v_day_idx % 8) * 0.10);
        v_lactate := 1.7 + ((v_day_idx % 7) * 0.23);

        INSERT INTO public.executed_workouts (
          athlete_id,
          planned_workout_id,
          date,
          started_at,
          ended_at,
          duration_minutes,
          tss,
          kj,
          kcal,
          trace_summary,
          lactate_mmoll,
          glucose_mmol,
          smo2,
          subjective_notes,
          source,
          external_id,
          created_at,
          updated_at
        )
        VALUES (
          v_athlete,
          v_planned,
          d,
          timezone('UTC', d::timestamp + interval '07:05'),
          timezone('UTC', d::timestamp + interval '07:05' + make_interval(mins => GREATEST(35, v_duration - 4))),
          GREATEST(35, v_duration - 4),
          round((v_tss * (0.88 + ((v_day_idx % 5) * 0.04))), 2),
          round((v_kj * (0.9 + ((v_day_idx % 4) * 0.03))), 2),
          round((v_kcal * (0.9 + ((v_day_idx % 4) * 0.03))), 2),
          jsonb_build_object(
            'demo_seed', true,
            'demo_dataset', 'jan_apr_2026',
            'sport', v_sport,
            'core_temp_c', round(v_core_temp, 2),
            'skin_temp_c', round(33.7 + ((v_day_idx % 4) * 0.17), 2),
            'smo2_avg_pct', round(v_smo2, 1),
            'sodium_sweat_mg_l', v_na_sweat,
            'potassium_sweat_mg_l', v_k_sweat,
            'vo2_l_min', round(v_vo2, 2),
            'vco2_l_min', round(v_vco2, 2),
            'rer', round((v_vco2 / NULLIF(v_vo2, 0)), 3),
            'resting_hr_bpm', v_resting_hr,
            'hrv_rmssd_ms', round(v_hrv, 1),
            'sleep_hours', round(v_sleep_total, 2),
            'sleep_deep_hours', round(v_sleep_deep, 2),
            'sleep_rem_hours', round(v_sleep_rem, 2),
            'sleep_light_hours', round(v_sleep_light, 2),
            'import_quality', jsonb_build_object(
              'quality_status', 'high',
              'coverage_pct', 90 + (v_day_idx % 9),
              'missing_channels', jsonb_build_array(),
              'recommended_inputs', jsonb_build_array()
            )
          ),
          round(v_lactate, 2),
          round(v_glucose, 2),
          round(v_smo2, 1),
          'Demo eseguito: dataset sintetico multisport con segnali recovery + bioenergetics.',
          'import',
          v_prefix || 'executed-' || v_day || '-' || v_sport,
          now(),
          now()
        );

        -- Inseriamo anche sync export provider sport per timeline integrazioni
        IF v_sport = 'cycling' THEN
          INSERT INTO public.device_sync_exports (
            athlete_id, provider, sync_kind, status, external_ref, payload, created_at, updated_at
          ) VALUES (
            v_athlete, 'garmin', 'pull', 'done', v_prefix || 'garmin-' || v_day,
            jsonb_build_object('activity_date', v_day, 'sport', v_sport, 'duration_minutes', v_duration, 'tss', v_tss, 'power_avg_w', 220 + (v_day_idx % 35)),
            timezone('UTC', d::timestamp + interval '10:30'), now()
          );
        ELSIF v_sport = 'running' THEN
          INSERT INTO public.device_sync_exports (
            athlete_id, provider, sync_kind, status, external_ref, payload, created_at, updated_at
          ) VALUES (
            v_athlete, 'strava', 'pull', 'done', v_prefix || 'strava-' || v_day,
            jsonb_build_object('activity_date', v_day, 'sport', v_sport, 'duration_minutes', v_duration, 'distance_km', round(8.2 + (v_day_idx % 8) * 0.9, 2)),
            timezone('UTC', d::timestamp + interval '10:45'), now()
          );
        ELSE
          INSERT INTO public.device_sync_exports (
            athlete_id, provider, sync_kind, status, external_ref, payload, created_at, updated_at
          ) VALUES (
            v_athlete, 'wahoo', 'pull', 'done', v_prefix || 'wahoo-' || v_day,
            jsonb_build_object('activity_date', v_day, 'sport', v_sport, 'duration_minutes', v_duration, 'kcal', v_kcal),
            timezone('UTC', d::timestamp + interval '11:00'), now()
          );
        END IF;
      END IF;
    END IF;

    -- Snapshot twin settimanale (domenica)
    IF extract(isodow FROM d) = 7 THEN
      INSERT INTO public.twin_states (
        athlete_id, as_of, fitness_chronic, fatigue_acute, readiness, recovery_debt, glycogen_status,
        autonomic_strain, glycolytic_strain, oxidative_bottleneck, redox_stress_index, thermal_stress,
        sleep_recovery, gi_tolerance, inflammation_risk, adaptation_score, expected_adaptation,
        real_adaptation, divergence_score, intervention_score, created_at
      )
      VALUES (
        v_athlete,
        timezone('UTC', d::timestamp + interval '20:30'),
        62 + (v_day_idx % 15),
        30 + (v_day_idx % 18),
        66 + (v_day_idx % 16),
        9 + (v_day_idx % 8),
        63 + (v_day_idx % 20),
        19 + (v_day_idx % 10),
        24 + (v_day_idx % 10),
        16 + (v_day_idx % 10),
        20 + (v_day_idx % 11),
        12 + (v_day_idx % 8),
        65 + (v_day_idx % 17),
        58 + (v_day_idx % 14),
        19 + (v_day_idx % 12),
        61 + (v_day_idx % 18),
        56 + (v_day_idx % 16),
        52 + (v_day_idx % 15),
        15 + (v_day_idx % 9),
        12 + (v_day_idx % 9),
        now()
      );
    END IF;
  END LOOP;

  -- Biomarker/omics panel periodici (mensili, multi-dominio)
  FOR d IN SELECT gs::date FROM generate_series('2026-01-15'::timestamp, '2026-04-15'::timestamp, interval '1 month') gs LOOP
    v_day_idx := v_day_idx + 1;
    v_glucose := 4.8 + ((v_day_idx % 4) * 0.18);
    v_lactate := 1.55 + ((v_day_idx % 5) * 0.22);
    v_nad := 58 + ((v_day_idx % 6) * 3.0);
    v_testosterone := 520 + ((v_day_idx % 5) * 18);
    v_no_index := 68 + ((v_day_idx % 7) * 2.5);

    INSERT INTO public.biomarker_panels (
      athlete_id, type, sample_date, reported_at, values, flags, source, created_at, updated_at
    )
    VALUES (
      v_athlete,
      'blood',
      d,
      timezone('UTC', d::timestamp + interval '14:00'),
      jsonb_build_object(
        'glucose_mmol_l', round(v_glucose, 2),
        'lactate_mmol_l', round(v_lactate, 2),
        'nad_index', round(v_nad, 1),
        'testosterone_ng_dl', round(v_testosterone, 0),
        'nitric_oxide_index', round(v_no_index, 1),
        'vo2_l_min_lab', round(3.35 + ((v_day_idx % 4) * 0.12), 2),
        'vco2_l_min_lab', round(3.05 + ((v_day_idx % 4) * 0.11), 2),
        'cortisol_ug_dl', round(13.0 + ((v_day_idx % 4) * 0.9), 2)
      ),
      ARRAY[]::text[],
      v_prefix || 'seed',
      now(),
      now()
    );

    -- Pannello ormonale (asse stress/recupero)
    INSERT INTO public.biomarker_panels (
      athlete_id, type, sample_date, reported_at, values, flags, source, created_at, updated_at
    )
    VALUES (
      v_athlete,
      'hormonal',
      d + 1,
      timezone('UTC', (d + 1)::timestamp + interval '14:20'),
      jsonb_build_object(
        'testosterone_ng_dl', round(v_testosterone + 12, 0),
        'free_testosterone_pg_ml', round(88 + (v_day_idx % 6) * 4.5, 1),
        'cortisol_ug_dl', round(12.2 + (v_day_idx % 5) * 0.8, 2),
        'dhea_s_ug_dl', round(268 + (v_day_idx % 7) * 9.0, 1),
        'tsh_miu_l', round(1.35 + (v_day_idx % 4) * 0.12, 2),
        'free_t3_pg_ml', round(3.1 + (v_day_idx % 4) * 0.14, 2),
        'free_t4_ng_dl', round(1.12 + (v_day_idx % 3) * 0.06, 2),
        'lh_miu_ml', round(4.8 + (v_day_idx % 5) * 0.35, 2)
      ),
      ARRAY[]::text[],
      v_prefix || 'seed',
      now(),
      now()
    );

    -- Pannello microbiota/funzionale intestinale
    INSERT INTO public.biomarker_panels (
      athlete_id, type, sample_date, reported_at, values, flags, source, created_at, updated_at
    )
    VALUES (
      v_athlete,
      'microbiota',
      d + 2,
      timezone('UTC', (d + 2)::timestamp + interval '14:35'),
      jsonb_build_object(
        'shannon_index', round(3.35 + (v_day_idx % 4) * 0.16, 2),
        'simpson_index', round(0.88 + (v_day_idx % 4) * 0.01, 3),
        'firmicutes_bacteroidetes_ratio', round(1.52 + (v_day_idx % 5) * 0.09, 2),
        'akkermansia_pct', round(2.0 + (v_day_idx % 4) * 0.22, 2),
        'faecalibacterium_pct', round(6.4 + (v_day_idx % 5) * 0.35, 2),
        'bifidobacterium_pct', round(7.1 + (v_day_idx % 4) * 0.4, 2),
        'butyrate_pathway_score', round(72 + (v_day_idx % 6) * 2.2, 1),
        'zonulin_ng_ml', round(44 + (v_day_idx % 7) * 2.6, 1)
      ),
      ARRAY[]::text[],
      v_prefix || 'seed',
      now(),
      now()
    );

    -- Pannello epigenetico / aging-adaptation
    INSERT INTO public.biomarker_panels (
      athlete_id, type, sample_date, reported_at, values, flags, source, created_at, updated_at
    )
    VALUES (
      v_athlete,
      'epigenetics',
      d + 3,
      timezone('UTC', (d + 3)::timestamp + interval '14:50'),
      jsonb_build_object(
        'epigenetic_age_years', round(39.8 + (v_day_idx % 4) * 0.35, 2),
        'chronological_age_years', 38.0,
        'pace_of_aging', round(0.94 + (v_day_idx % 4) * 0.02, 2),
        'methylation_clock_residual', round(-1.4 + (v_day_idx % 5) * 0.22, 2),
        'inflammation_methylation_index', round(0.39 + (v_day_idx % 5) * 0.03, 2),
        'metabolic_methylation_score', round(0.54 + (v_day_idx % 5) * 0.03, 2),
        'mitochondrial_resilience_index', round(67 + (v_day_idx % 6) * 2.4, 1)
      ),
      ARRAY[]::text[],
      v_prefix || 'seed',
      now(),
      now()
    );

    -- Pannello performance lab (VO2/VCO2/ventilazione estesa)
    INSERT INTO public.biomarker_panels (
      athlete_id, type, sample_date, reported_at, values, flags, source, created_at, updated_at
    )
    VALUES (
      v_athlete,
      'performance_lab',
      d + 4,
      timezone('UTC', (d + 4)::timestamp + interval '15:05'),
      jsonb_build_object(
        'vo2_l_min', round(3.34 + (v_day_idx % 4) * 0.13, 2),
        'vco2_l_min', round(3.02 + (v_day_idx % 4) * 0.12, 2),
        'rer_peak', round(0.91 + (v_day_idx % 4) * 0.03, 3),
        've_l_min', round(102 + (v_day_idx % 6) * 3.8, 1),
        'o2_pulse_ml_beat', round(17.8 + (v_day_idx % 5) * 0.55, 2),
        'lactate_peak_mmol_l', round(6.4 + (v_day_idx % 4) * 0.5, 2)
      ),
      ARRAY[]::text[],
      v_prefix || 'seed',
      now(),
      now()
    );
  END LOOP;

  RAISE NOTICE 'Seed demo completato (%).', v_prefix;
  RAISE NOTICE 'Planned rows: %',
    (SELECT count(*)::int FROM public.planned_workouts WHERE athlete_id = v_athlete AND notes LIKE v_prefix || '%');
  RAISE NOTICE 'Executed rows: %',
    (SELECT count(*)::int FROM public.executed_workouts WHERE athlete_id = v_athlete AND external_id LIKE v_prefix || '%');
  RAISE NOTICE 'Device exports rows: %',
    (SELECT count(*)::int FROM public.device_sync_exports WHERE athlete_id = v_athlete AND external_ref LIKE v_prefix || '%');
  RAISE NOTICE 'Biomarker panels rows: %',
    (SELECT count(*)::int FROM public.biomarker_panels WHERE athlete_id = v_athlete AND source = v_prefix || 'seed');
END $$;

-- =============================================================================
-- VERIFICA RAPIDA POST-SEED (read-only)
-- =============================================================================
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
  (SELECT athlete_id FROM ath) AS athlete_id,
  (SELECT count(*) FROM public.planned_workouts pw JOIN ath a ON pw.athlete_id = a.athlete_id JOIN target t ON true WHERE pw.notes LIKE t.pfx || '%') AS planned_rows,
  (SELECT count(*) FROM public.executed_workouts ew JOIN ath a ON ew.athlete_id = a.athlete_id JOIN target t ON true WHERE ew.external_id LIKE t.pfx || '%') AS executed_rows,
  (SELECT count(*) FROM public.device_sync_exports dx JOIN ath a ON dx.athlete_id = a.athlete_id JOIN target t ON true WHERE dx.external_ref LIKE t.pfx || '%') AS device_rows,
  (SELECT count(*) FROM public.biomarker_panels bp JOIN ath a ON bp.athlete_id = a.athlete_id JOIN target t ON true WHERE bp.source = t.pfx || 'seed') AS biomarker_rows;

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
  COALESCE((ew.trace_summary ->> 'sport'), 'unknown') AS sport,
  count(*) AS executed_count
FROM public.executed_workouts ew
JOIN ath a ON ew.athlete_id = a.athlete_id
JOIN target t ON true
WHERE ew.external_id LIKE t.pfx || '%'
GROUP BY 1
ORDER BY 1;

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
  bp.type,
  count(*) AS panel_count,
  min(bp.sample_date) AS first_sample,
  max(bp.sample_date) AS last_sample
FROM public.biomarker_panels bp
JOIN ath a ON bp.athlete_id = a.athlete_id
JOIN target t ON true
WHERE bp.source = t.pfx || 'seed'
GROUP BY bp.type
ORDER BY bp.type;
