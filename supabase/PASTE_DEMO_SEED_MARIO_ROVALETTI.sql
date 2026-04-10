-- =============================================================================
-- EMPATHY Pro 2.0 — Demo seed (dati sintetici)
-- =============================================================================
-- Copia allineata al canone V1: nextjs-empathy-pro/supabase/PASTE_DEMO_SEED_MARIO_ROVALETTI.sql
-- (stesso contenuto operativo; duplicata qui per repo separato, v. empathy_v1_pro2_repo_separation).
--
-- Target: utente con email m@d1s.ch (Mario Rovaletti).
-- Risolve athlete_id da app_user_profiles → auth.users, altrimenti athlete_profiles.email.
--
-- Esegui in Supabase SQL Editor con ruolo che possa leggere auth.users e scrivere public.*
-- (di solito dashboard / service role). Non committare dati reali sensibili.
--
-- Ancora fissa demo: 9 aprile 2026 + storico 15 giorni (anchor e 14 giorni indietro) per
-- allenamenti, Whoop (sonno/HRV/strain/recovery) e biomarker. Modifica v_anchor se serve un altro “oggi”.
--
-- Idempotenza: prima rimuove solo righe con external_id / external_ref che iniziano
-- con 'mario-rova-demo-' per QUELL'athlete_id (vedi sezione CLEANUP).
--
-- Dati inseriti:
--   • Profilo atleta (nome) + fisiologia base (FTP, HRV baseline, glicemia baseline)
--   • Training: planned_workouts (finestra) + executed_workouts (glicemia, SmO2, core temp in trace)
--   • device_sync_exports provider whoop (sonno, HRV, strain, recovery — notturno)
--   • connected_devices (whoop)
--   • biomarker_panels: sangue, microbiota, epigenetica
--   • twin_states (stato twin sintetico)
--
-- Calendario: stesso contratto DB di V1 — planned + executed per athlete_id nel range mese.
-- Vedi commento calendario nel seed V1 (nextjs-empathy-pro) per atleta attivo / mese / sessionStorage.
-- =============================================================================
--
-- Se vedi errore 23514 su device_sync_exports_provider_check: applicare
-- supabase/migrations/005_device_sync_exports_provider_ecosystem.sql oppure il blocco seguente
-- riallinea il CHECK (stessa lista V1 migrations/028_*; idempotente).

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
  v_email text := 'm@d1s.ch';
  v_athlete uuid;
  v_uid uuid;
  d date;
  i int;
  v_planned uuid;
  v_day text;
  v_anchor date := '2026-04-09'::date;
  v_hist_days int := 14; -- 0..14 inclusi = 15 giorni di storia (fino a v_anchor)
BEGIN
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(v_email) LIMIT 1;

  SELECT aup.athlete_id INTO v_athlete
  FROM app_user_profiles aup
  WHERE aup.user_id = v_uid
  LIMIT 1;

  IF v_athlete IS NULL THEN
    SELECT ap.id INTO v_athlete
    FROM athlete_profiles ap
    WHERE lower(ap.email) = lower(v_email)
    ORDER BY ap.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_athlete IS NULL THEN
    RAISE EXCEPTION
      'Nessun athlete_id trovato per email %. Verifica signup e app_user_profiles.athlete_id o athlete_profiles.email.',
      v_email;
  END IF;

  RAISE NOTICE 'Demo seed: athlete_id = %', v_athlete;

  -- --- CLEANUP righe demo precedenti (solo prefisso mario-rova-demo-) ---------
  DELETE FROM executed_workouts
  WHERE athlete_id = v_athlete
    AND external_id IS NOT NULL
    AND external_id LIKE 'mario-rova-demo-%';

  DELETE FROM device_sync_exports
  WHERE athlete_id = v_athlete
    AND external_ref IS NOT NULL
    AND external_ref LIKE 'mario-rova-demo-%';

  DELETE FROM planned_workouts
  WHERE athlete_id = v_athlete
    AND notes IS NOT NULL
    AND notes LIKE 'mario-rova-demo%';

  DELETE FROM biomarker_panels
  WHERE athlete_id = v_athlete
    AND source = 'mario-rova-demo-seed';

  DELETE FROM connected_devices
  WHERE athlete_id = v_athlete
    AND provider = 'whoop'
    AND external_id = 'whoop-demo-mario-001';

  -- --- Profilo visivo --------------------------------------------------------
  UPDATE athlete_profiles
  SET
    first_name = COALESCE(NULLIF(trim(first_name), ''), 'Mario'),
    last_name = COALESCE(NULLIF(trim(last_name), ''), 'Rovaletti'),
    email = COALESCE(NULLIF(trim(email), ''), v_email),
    birth_date = COALESCE(birth_date, '1988-03-15'::date),
    sex = COALESCE(sex, 'male'),
    height_cm = COALESCE(height_cm, 178),
    weight_kg = COALESCE(weight_kg, 72.5),
    resting_hr_bpm = COALESCE(resting_hr_bpm, 48),
    max_hr_bpm = COALESCE(max_hr_bpm, 188),
    updated_at = now()
  WHERE id = v_athlete;

  -- --- Fisiologia canonica (UPSERT) -----------------------------------------
  INSERT INTO physiological_profiles (
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
    285,
    195,
    245,
    58.5, -- vo2max_ml_min_kg
    54.0, -- baseline_hrv_ms
    12.0, -- baseline_hrv_std
    36.9, -- baseline_temp_c
    5.1, -- baseline_glucose_mmol (mmol/L)
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

  -- --- Device Whoop collegato ------------------------------------------------
  INSERT INTO connected_devices (athlete_id, provider, external_id, last_sync_at, enabled)
  VALUES (v_athlete, 'whoop', 'whoop-demo-mario-001', now(), true);

  -- --- Whoop: 15 notti (sonno, HRV, strain, recovery) — device_sync_exports -----
  FOR i IN 0..v_hist_days LOOP
    d := (v_anchor - i);
    v_day := to_char(d, 'YYYY-MM-DD');
    INSERT INTO device_sync_exports (athlete_id, provider, payload, status, external_ref, created_at, updated_at)
    VALUES (
      v_athlete,
      'whoop',
      jsonb_build_object(
        'adapterKey', 'whoop:recovery:api_sync',
        'sourcePayload', jsonb_build_object(
          'date', v_day,
          'summary_date', v_day,
          'sleep_score', 68 + ((i * 3 + 7) % 28),
          'readiness_score', 62 + ((i * 5 + 11) % 32),
          'recovery_score', 60 + ((i * 4 + 9) % 34),
          'hrv_ms', 45 + ((i * 4) % 22) + (i % 3),
          'resting_hr_bpm', 46 + (i % 5),
          'total_sleep_minutes', 360 + ((i * 13) % 95),
          'strain_score', 8.2 + (i::numeric * 0.22) + ((i % 4) * 0.35),
          'core_temp_c', 36.75 + (i % 4) * 0.12,
          'skin_temp_c', 33.85 + (i % 5) * 0.1,
          'spo2_sleep_avg', 96.2 - (i % 4) * 0.25,
          'provider', 'whoop',
          'cycle_phase', 'light_sleep_deep_rem_synthetic'
        ),
        'realityIngestion', jsonb_build_object(
          'canonicalPreview', jsonb_build_object(
            'sleep_score', 68 + ((i * 3 + 7) % 28),
            'readiness_score', 62 + ((i * 5 + 11) % 32),
            'recovery_score', 60 + ((i * 4 + 9) % 34),
            'hrv_ms', 45 + ((i * 4) % 22) + (i % 3),
            'resting_hr_bpm', 46 + (i % 5),
            'sleep_duration_hours', round((360 + ((i * 13) % 95)) / 60.0, 2),
            'strain_score', 8.2 + (i::numeric * 0.22) + ((i % 4) * 0.35),
            'source_date', v_day
          )
        )
      ),
      'created',
      'mario-rova-demo-whoop-' || v_day,
      timezone('UTC', d::timestamp + interval '6 hours 30 minutes'),
      now()
    );
  END LOOP;

  -- --- Piani + eseguiti (15 giorni: da v_anchor indietro v_hist_days) ----------
  FOR i IN 0..v_hist_days LOOP
    d := (v_anchor - i);
    v_day := to_char(d, 'YYYY-MM-DD');

    INSERT INTO planned_workouts (
      athlete_id, date, type, duration_minutes, tss_target, kj_target, kcal_target,
      zone_split, adaptive_goal, notes, created_at, updated_at
    )
    VALUES (
      v_athlete,
      d::date,
      CASE WHEN i % 3 = 0 THEN 'endurance' WHEN i % 3 = 1 THEN 'tempo' ELSE 'vo2max' END,
      75 + (i * 5) % 45,
      68 + (i * 7) % 40,
      2100 + i * 120,
      650 + i * 35,
      '{"z1":25,"z2":35,"z3":30,"z4":10}'::jsonb,
      'aerobic_base',
      'mario-rova-demo planned ' || v_day,
      now(),
      now()
    )
    RETURNING id INTO v_planned;

    INSERT INTO executed_workouts (
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
      d::date,
      timezone('UTC', d::timestamp + interval '7 hours'),
      timezone('UTC', d::timestamp + interval '8 hours 20 minutes'),
      72 + (i * 4) % 30,
      64 + (i * 6) % 38,
      2050 + i * 100,
      620 + i * 30,
      jsonb_build_object(
        'demo_seed', true,
        'core_temp_c', 37.1 + (i % 4) * 0.2,
        'skin_temp_c', 34.2,
        'temperature_avg_c', 18.5,
        'hr_avg_bpm', 132 + (i * 2) % 28,
        'power_avg_w', 208 + (i * 3) % 45,
        'night_hrv_ms_prior', 48 + (i * 2) % 18,
        'glucose_mmol_session_avg', 4.85 + (i % 5) * 0.12,
        'smo2_min_pct', 84 + (i % 6),
        'import_schema_version', 'v1',
        'sport', 'cycling'
      ),
      2.0 + (i % 5) * 0.12,
      4.75 + (i % 6) * 0.1,
      87.0 - (i % 5) * 1.1,
      'Sessione demo sintetica — glicemia / SmO2 / lactato',
      'import',
      'mario-rova-demo-ex-' || v_day,
      now(),
      now()
    );
  END LOOP;

  -- Alcuni giorni futuri solo pianificati (nessun executed)
  FOR i IN 1..7 LOOP
    d := (v_anchor + i);
    v_day := to_char(d, 'YYYY-MM-DD');
    INSERT INTO planned_workouts (
      athlete_id, date, type, duration_minutes, tss_target, kj_target, kcal_target,
      notes, created_at, updated_at
    )
    VALUES (
      v_athlete,
      d::date,
      'endurance',
      90,
      72,
      2400,
      700,
      'mario-rova-demo future ' || v_day,
      now(),
      now()
    );
  END LOOP;

  -- --- Pannelli salute (sangue, microbiota, epigenetica) --------------------
  INSERT INTO biomarker_panels (athlete_id, type, sample_date, reported_at, values, flags, source, created_at, updated_at)
  VALUES
    (
      v_athlete,
      'blood',
      v_anchor - 5,
      now(),
      jsonb_build_object(
        'ferritina_ng_ml', 118,
        'hba1c_mmol_mol', 36,
        'fasting_glucose_mg_dl', 89,
        'crp_mg_l', 0.6,
        'vitamin_d_ng_ml', 42,
        'testosterone_ng_dl', 520,
        'cortisol_ug_dl', 14.2,
        'tsh_miu_l', 1.6
      ),
      ARRAY['attention']::text[],
      'mario-rova-demo-seed',
      now(),
      now()
    ),
    (
      v_athlete,
      'microbiota',
      v_anchor - 10,
      now(),
      jsonb_build_object(
        'shannon_index', 3.45,
        'firmicutes_bacteroidetes_ratio', 1.85,
        'akkermansia_pct', 2.1,
        'faecalibacterium_pct', 6.8,
        'diversity_score', 78,
        'inflammation_proxy_score', 22
      ),
      ARRAY[]::text[],
      'mario-rova-demo-seed',
      now(),
      now()
    ),
    (
      v_athlete,
      'epigenetics',
      v_anchor - 14,
      now(),
      jsonb_build_object(
        'epigenetic_age_years', 40.2,
        'chronological_age_years', 38,
        'pace_of_aging', 0.96,
        'methylation_clock_residual', -1.8,
        'inflammation_methylation_index', 0.42,
        'metabolic_methylation_score', 0.55
      ),
      ARRAY[]::text[],
      'mario-rova-demo-seed',
      now(),
      now()
    );

  -- --- Twin state sintetico ---------------------------------------------------
  INSERT INTO twin_states (
    athlete_id,
    as_of,
    fitness_chronic,
    fatigue_acute,
    readiness,
    recovery_debt,
    glycogen_status,
    autonomic_strain,
    glycolytic_strain,
    oxidative_bottleneck,
    redox_stress_index,
    thermal_stress,
    sleep_recovery,
    gi_tolerance,
    inflammation_risk,
    adaptation_score,
    expected_adaptation,
    real_adaptation,
    divergence_score,
    intervention_score,
    created_at
  )
  VALUES (
    v_athlete,
    timezone('UTC', v_anchor::timestamp + interval '20 hours'),
    72.5,
    38.0,
    76.0,
    12.0,
    68.0,
    22.0,
    28.0,
    18.0,
    24.0,
    15.0,
    71.0,
    62.0,
    22.0,
    64.0,
    58.0,
    52.0,
    18.0,
    14.0,
    now()
  );

  RAISE NOTICE 'Demo seed completato per athlete_id %', v_athlete;
  RAISE NOTICE
    'Conteggi mario-rova-demo su questo atleta → planned %, executed %, whoop_export % (attesi ~22 / 15 / 15)',
    (SELECT count(*)::int FROM planned_workouts WHERE athlete_id = v_athlete AND notes ILIKE 'mario-rova-demo%'),
    (SELECT count(*)::int FROM executed_workouts WHERE athlete_id = v_athlete AND external_id LIKE 'mario-rova-demo-%'),
    (SELECT count(*)::int FROM device_sync_exports WHERE athlete_id = v_athlete AND external_ref LIKE 'mario-rova-demo-%');
END $$;

-- twin_states: a ogni esecuzione viene aggiunta una riga storica (nessun cleanup automatico).
