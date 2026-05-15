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

-- ═══ 9) Test rapido “un solo cliente” — zero variabili, una riga riepilogo (ultimi 7 giorni) ═══
SELECT
  (SELECT max(created_at) FROM public.garmin_push_receipts) AS last_push_any,
  (SELECT max(created_at)
   FROM public.garmin_push_receipts
   WHERE endpoint_kind ILIKE '%activityDetails%' OR endpoint_kind ILIKE '%activity_detail%') AS last_activity_details_push,
  (SELECT count(*)::int FROM public.garmin_push_receipts WHERE created_at >= now() - interval '7 days') AS receipts_7d,
  (SELECT count(*)::int FROM public.garmin_pull_jobs WHERE created_at >= now() - interval '7 days') AS pull_jobs_7d,
  (SELECT count(*)::int
   FROM public.garmin_pull_jobs
   WHERE created_at >= now() - interval '7 days'
     AND (coalesce(stream_key, '') ILIKE '%activityFile%' OR endpoint_kind ILIKE '%activityFile%')) AS activityfile_jobs_7d,
  (SELECT count(*)::int
   FROM public.garmin_pull_jobs
   WHERE created_at >= now() - interval '7 days'
     AND status = 'completed'
     AND (coalesce(stream_key, '') ILIKE '%activityFile%' OR endpoint_kind ILIKE '%activityFile%')) AS activityfile_completed_7d,
  (SELECT count(*)::int
   FROM public.executed_workouts
   WHERE created_at >= now() - interval '7 days'
     AND coalesce(external_id, '') ILIKE 'garmin_api:%') AS executed_garmin_7d,
  (SELECT max(created_at) FROM public.executed_workouts WHERE coalesce(external_id, '') ILIKE 'garmin_api:%') AS last_executed_garmin;

-- ═══ 10) Ultima push activityDetails + job su quella receipt + workout se l’id nel JSON coincide ═══
WITH last_r AS (
  SELECT
    id,
    created_at,
    endpoint_kind,
    coalesce(
      nullif(trim(payload->>'activityId'), ''),
      nullif(trim(payload->>'activityID'), ''),
      nullif(trim(payload->>'summaryId'), ''),
      nullif(trim(payload->>'summaryID'), '')
    ) AS bare_id
  FROM public.garmin_push_receipts
  WHERE endpoint_kind ILIKE '%activityDetails%' OR endpoint_kind ILIKE '%activity_detail%'
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  r.id AS receipt_id,
  r.created_at AS receipt_at,
  r.endpoint_kind,
  r.bare_id,
  CASE WHEN r.bare_id IS NOT NULL AND length(r.bare_id) > 0 THEN 'garmin_api:' || r.bare_id END AS external_id_guess,
  j.id AS pull_job_id,
  j.stream_key,
  j.endpoint_kind AS job_kind,
  j.status AS job_status,
  j.http_status,
  (j.response_body->'garmin_binary_enrich_run'->>'executed_workout_id') AS enrich_ew_id,
  ew.id AS executed_workout_id,
  ew.external_id AS ew_external_id,
  ew.created_at AS ew_created_at
FROM last_r r
LEFT JOIN public.garmin_pull_jobs j ON j.receipt_id = r.id
LEFT JOIN public.executed_workouts ew
  ON r.bare_id IS NOT NULL
 AND length(trim(r.bare_id)) > 0
 AND ew.external_id = ('garmin_api:' || trim(r.bare_id))
ORDER BY j.created_at NULLS LAST;

-- ═══ 11) Pipeline unica: Garmin “ci rimanda il file” → storage → decode/enrich → grafici/mappa ═══
-- Flusso atteso (Vercel pull runner, non Fly): GET activityFile → body binario → riga
-- `garmin_pull_binary_objects` + `response_body` con `garminWellnessBinaryResponse` + opzionale
-- `garmin_binary_enrich_run` (outcome merged | parse_error | no_executed_row | …) → merge su
-- `executed_workouts.trace_summary` (chiavi hr_series_bpm, route_series_geo, …).
-- Cosa guardare:
--   • job_status failed / http_status ≠ 2xx → Garmin non ha dato il file o auth/token.
--   • binary_object_id NULL ma is_binary_wrapper true → upload storage fallito o bucket mancante (env).
--   • enrich_outcome no_executed_row → FIT ok ma non trovata riga summary da agganciare (external_id).
--   • enrich_outcome parse_error → decoder FIT/GPX fallito (message).
--   • hr_series_len / route_geo_len = 0 dopo merged → file senza stream utili o merge non applicato.

SELECT
  j.id AS pull_job_id,
  j.created_at AS job_created,
  j.updated_at AS job_updated,
  j.athlete_id,
  j.status AS job_status,
  j.http_status,
  j.stream_key,
  j.endpoint_kind,
  left(j.callback_url, 140) AS callback_url_prefix,
  left(coalesce(j.error_message, ''), 220) AS job_error_prefix,
  (j.response_body->>'garminWellnessBinaryResponse') AS resp_binary_marker,
  (j.response_body->>'stored') AS resp_stored,
  (j.response_body->>'storage_bucket') AS resp_storage_bucket,
  left(coalesce(j.response_body->>'storage_path', ''), 80) AS resp_storage_path_prefix,
  (j.response_body->'garmin_binary_enrich_run'->>'outcome') AS enrich_outcome,
  (j.response_body->'garmin_binary_enrich_run'->>'match') AS enrich_match,
  left(coalesce(j.response_body->'garmin_binary_enrich_run'->>'message', ''), 200) AS enrich_message_prefix,
  (j.response_body->'garmin_binary_enrich_run'->>'executed_workout_id') AS enrich_executed_workout_id,
  b.id AS binary_object_id,
  b.byte_length AS blob_bytes,
  b.extension AS blob_extension,
  (b.fit_extract IS NOT NULL) AS blob_has_fit_extract,
  ew.id AS executed_workout_id,
  ew.external_id AS ew_external_id,
  CASE WHEN jsonb_typeof(ew.trace_summary->'hr_series_bpm') = 'array'
    THEN jsonb_array_length(ew.trace_summary->'hr_series_bpm') END AS hr_series_len,
  CASE WHEN jsonb_typeof(ew.trace_summary->'route_series_geo') = 'array'
    THEN jsonb_array_length(ew.trace_summary->'route_series_geo') END AS route_geo_len,
  CASE WHEN jsonb_typeof(ew.trace_summary->'power_series_w') = 'array'
    THEN jsonb_array_length(ew.trace_summary->'power_series_w') END AS power_series_len,
  (SELECT count(*)::int FROM public.executed_workout_series s WHERE s.executed_workout_id = ew.id) AS hd_table_rows
FROM public.garmin_pull_jobs j
LEFT JOIN public.garmin_pull_binary_objects b ON b.pull_job_id = j.id
LEFT JOIN public.executed_workouts ew
  ON (j.response_body->'garmin_binary_enrich_run'->>'executed_workout_id') IS NOT NULL
 AND length(trim(j.response_body->'garmin_binary_enrich_run'->>'executed_workout_id')) > 0
 AND ew.id::text = trim(j.response_body->'garmin_binary_enrich_run'->>'executed_workout_id')
WHERE j.created_at >= now() - interval '14 days'
  AND (
    coalesce(j.stream_key, '') ILIKE '%activityFile%'
    OR j.callback_url ILIKE '%/activityFile%'
    OR j.callback_url ILIKE '%activityfile%'
    OR j.endpoint_kind ILIKE '%activityFile%'
  )
ORDER BY j.updated_at DESC
LIMIT 30;
