-- Refresh OAuth2: scadenza refresh token nota; pull job senza userAccessToken (post-migrazione Garmin) → Bearer da link atleta.

ALTER TABLE public.garmin_athlete_links
  ADD COLUMN IF NOT EXISTS oauth_refresh_expires_at timestamptz;

COMMENT ON COLUMN public.garmin_athlete_links.oauth_refresh_expires_at IS 'Scadenza stimata refresh token (da refresh_token_expires_in Garmin, secondi da now).';

ALTER TABLE public.garmin_pull_jobs
  ALTER COLUMN user_access_token DROP NOT NULL;

COMMENT ON COLUMN public.garmin_pull_jobs.user_access_token IS 'OAuth1 user token dalla push; NULL se assente → GET callback con Bearer OAuth2 (athlete_id + garmin_athlete_links).';
