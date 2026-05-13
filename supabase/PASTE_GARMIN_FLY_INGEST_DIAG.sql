-- Garmin / Fly ingest — diagnostica rapida (Supabase SQL Editor, service role o ruolo con SELECT sulle tabelle).
-- Dopo deploy Fly: verifica se le push arrivano (receipts) e se la coda pull / FIT gira (jobs, blob, enrich).
-- Non modificare dati: solo SELECT.

-- ═══ 1) Push receipts: conteggi rolling (se tutti zero → Fly non persiste o Garmin non colpisce l’URL) ═══
SELECT
  count(*) FILTER (WHERE created_at >= now() - interval '1 hour') AS receipts_last_1h,
  count(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS receipts_last_24h,
  count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS receipts_last_7d,
  count(*) AS receipts_all_time
FROM public.garmin_push_receipts;

-- ═══ 2) Push per endpoint_kind (ultime 24h) — cerca righe con activityDetails (tipico Fly ingest) ═══
SELECT
  endpoint_kind,
  count(*) AS n
FROM public.garmin_push_receipts
WHERE created_at >= now() - interval '24 hours'
GROUP BY 1
ORDER BY n DESC, 1;

-- ═══ 3) Ultime 15 push receipts (timestamp + tipo; payload troncato) ═══
SELECT
  id,
  created_at,
  endpoint_kind,
  content_type,
  left(payload::text, 240) AS payload_prefix
FROM public.garmin_push_receipts
ORDER BY created_at DESC
LIMIT 15;

-- ═══ 4) Coda pull: stato ultima 24h ═══
SELECT
  status,
  count(*) AS n
FROM public.garmin_pull_jobs
WHERE created_at >= now() - interval '24 hours'
GROUP BY 1
ORDER BY n DESC;

-- ═══ 5) Job pull recenti (activityFile / follow-up) con esito enrich se presente ═══
SELECT
  id,
  created_at,
  updated_at,
  status,
  stream_key,
  endpoint_kind,
  http_status,
  left(coalesce(error_message, ''), 120) AS err_short,
  (response_body->'garmin_binary_enrich_run'->>'outcome') AS enrich_outcome,
  (response_body->'garmin_binary_enrich_run'->>'executed_workout_id') AS enrich_workout_id,
  left((response_body->'garmin_binary_enrich_run'->>'message'), 80) AS enrich_msg
FROM public.garmin_pull_jobs
WHERE created_at >= now() - interval '48 hours'
  AND (
    coalesce(stream_key, '') ILIKE '%activityFile%'
    OR endpoint_kind ILIKE '%activityFile%'
    OR endpoint_kind ILIKE '%follow_up%'
  )
ORDER BY updated_at DESC
LIMIT 25;

-- ═══ 6) Blob FIT archiviati (migration 046) — ultimi record (+ http job se serve) ═══
SELECT
  b.id,
  b.created_at,
  b.athlete_id,
  b.extension,
  b.byte_length,
  j.http_status AS pull_job_http_status,
  left(coalesce(b.storage_path, ''), 100) AS path_prefix
FROM public.garmin_pull_binary_objects b
LEFT JOIN public.garmin_pull_jobs j ON j.id = b.pull_job_id
ORDER BY b.created_at DESC
LIMIT 15;

-- ═══ 7) Sessioni Garmin materializzate (ultime 24h) ═══
SELECT
  count(*) AS executed_garmin_rows_24h
FROM public.executed_workouts
WHERE created_at >= now() - interval '24 hours'
  AND coalesce(external_id, '') ILIKE 'garmin_api:%';

-- ═══ 8) Opzionale: filtra push solo “activityDetails” (path Fly tipico) ═══
SELECT
  count(*) AS activity_details_push_24h
FROM public.garmin_push_receipts
WHERE created_at >= now() - interval '24 hours'
  AND (
    endpoint_kind ILIKE '%activityDetails%'
    OR endpoint_kind ILIKE '%activity_detail%'
  );
