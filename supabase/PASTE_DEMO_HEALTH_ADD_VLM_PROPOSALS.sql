-- =====================================================================
--  DEMO ONLY — patch: aggiunge `vlm_proposals[]` a TUTTI i 24 panel demo
--  full_history (rova.ma79). NON tocca le chiavi flat esistenti: aggiunge
--  solo una "doppia rete" che il fallback `readNum()` lato UI già sa leggere
--  (verificato in produzione: il flusso VLM shadow ha popolato le card).
--
--  Idempotente: il `||` su jsonb sovrascrive le chiavi `vlm_proposals` e
--  `vlm_pending_validation` ad ogni esecuzione.
--
--  Pattern: ogni chiave flat numerica del panel diventa una proposta VLM
--  con confidence=0.95 (canonical synthetic). `vlm_pending_validation=false`
--  evita di mostrare il banner di review.
-- =====================================================================

DO $$
DECLARE
  v_email text := 'rova.ma79@gmail.com';
  v_uid uuid;
  v_athlete uuid;
  v_panel record;
  v_proposals jsonb;
  v_count int := 0;
BEGIN
  -- Resolve athlete_id (stessa logica degli altri seed)
  SELECT u.id INTO v_uid FROM auth.users u WHERE lower(u.email) = lower(v_email) LIMIT 1;
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth.users email % non trovata', v_email; END IF;
  SELECT aup.athlete_id INTO v_athlete FROM public.app_user_profiles aup WHERE aup.user_id = v_uid LIMIT 1;
  IF v_athlete IS NULL THEN
    SELECT ap.id INTO v_athlete FROM public.athlete_profiles ap WHERE lower(ap.email) = lower(v_email)
      ORDER BY ap.updated_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_athlete IS NULL THEN RAISE EXCEPTION 'Nessun athlete_id per %', v_email; END IF;

  -- Loop sui 24 panel demo: deriva vlm_proposals[] dalle chiavi flat numeriche.
  FOR v_panel IN
    SELECT * FROM public.biomarker_panels
     WHERE athlete_id = v_athlete AND source = 'health_demo_full_history_v1'
  LOOP
    -- Costruisce array {field, value, unit, reference_range, confidence, notes}
    -- da TUTTE le chiavi numeriche del panel (esclude import/vlm_*).
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'field', t.k,
          'value', t.v,
          'unit', null,
          'reference_range', null,
          'confidence', 0.95,
          'notes', 'demo seed canonical (mirrored as proposal)'
        )
      ),
      '[]'::jsonb
    ) INTO v_proposals
      FROM jsonb_each(v_panel.values) AS t(k, v)
     WHERE t.k NOT IN ('import','vlm_proposals','vlm_pending_validation')
       AND jsonb_typeof(t.v) = 'number';

    -- Merge: aggiunge vlm_proposals + vlm_pending_validation. Mantiene flat keys e import.
    UPDATE public.biomarker_panels
       SET values = values || jsonb_build_object(
             'vlm_proposals', v_proposals,
             'vlm_pending_validation', false
           ),
           updated_at = now()
     WHERE id = v_panel.id;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Patch applicato a % panel (vlm_proposals derivate dalle chiavi flat).', v_count;
END;
$$;

-- =====================================================================
--  Verifica finale: dimmi quanti panel hanno vlm_proposals e quante proposte
--  in totale per ogni tipo.
-- =====================================================================
SELECT
  type,
  count(*) FILTER (WHERE values ? 'vlm_proposals' AND jsonb_array_length(values->'vlm_proposals') > 0) AS panels_with_proposals,
  sum(coalesce(jsonb_array_length(values->'vlm_proposals'), 0)) AS total_proposals
FROM public.biomarker_panels
WHERE source = 'health_demo_full_history_v1'
  AND athlete_id = (
    SELECT athlete_id FROM public.app_user_profiles
     WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'rova.ma79@gmail.com' LIMIT 1)
  )
GROUP BY type
ORDER BY type;
