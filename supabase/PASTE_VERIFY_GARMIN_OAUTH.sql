-- Verifica allineamento schema + link Garmin (Supabase SQL Editor).
-- Non seleziona i token in chiaro: solo flag di presenza e metadati.
-- Nella sezione (3) sostituisci l'UUID placeholder con l'atleta reale (es. da Profile / URL).

-- 1) Tabelle attese (migrations 006–008, 012)
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'garmin_push_receipts',
    'garmin_pull_jobs',
    'garmin_athlete_links'
  )
ORDER BY table_name;

-- 2) Colonne garmin_athlete_links (OAuth2 + refresh expiry da 012)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'garmin_athlete_links'
ORDER BY ordinal_position;

-- 3) Stato link per un atleta (nessun secret in output)
--    Sostituisci l'UUID tra apici prima di eseguire.
SELECT
  athlete_id,
  garmin_user_id,
  updated_at,
  token_expires_at,
  oauth_refresh_expires_at,
  scope,
  (oauth_access_token IS NOT NULL) AS has_access_token,
  (oauth_refresh_token IS NOT NULL) AS has_refresh_token
FROM public.garmin_athlete_links
WHERE athlete_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- Se la query sopra non restituisce righe → OAuth callback non ha ancora persistito (o atleta sbagliato).

-- 4) Vincolo unicità garmin_user_id (conflitto = stesso account Garmin su due atleti)
SELECT garmin_user_id, count(*) AS athlete_count
FROM public.garmin_athlete_links
GROUP BY garmin_user_id
HAVING count(*) > 1;
