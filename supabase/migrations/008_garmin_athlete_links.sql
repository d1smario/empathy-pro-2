-- Collegamento OAuth2 Garmin (PKCE) → athlete_profiles. Token solo server (service role).
-- Accoppiamento push: garmin_user_id nelle notifiche → athlete_id sui pull jobs.

CREATE TABLE IF NOT EXISTS public.garmin_athlete_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  athlete_id uuid NOT NULL REFERENCES public.athlete_profiles (id) ON DELETE CASCADE,
  garmin_user_id text NOT NULL,
  oauth_access_token text,
  oauth_refresh_token text NOT NULL,
  token_expires_at timestamptz,
  scope text,
  CONSTRAINT garmin_athlete_links_athlete_unique UNIQUE (athlete_id),
  CONSTRAINT garmin_athlete_links_garmin_user_unique UNIQUE (garmin_user_id)
);

CREATE INDEX IF NOT EXISTS idx_garmin_athlete_links_garmin_user
  ON public.garmin_athlete_links (garmin_user_id);

COMMENT ON TABLE public.garmin_athlete_links IS 'OAuth2 Garmin per atleta: refresh token e userId API; RLS senza policy utente (solo service role).';

ALTER TABLE public.garmin_athlete_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.garmin_pull_jobs
  ADD COLUMN IF NOT EXISTS athlete_id uuid REFERENCES public.athlete_profiles (id) ON DELETE SET NULL;

ALTER TABLE public.garmin_pull_jobs
  ADD COLUMN IF NOT EXISTS garmin_user_id text;

CREATE INDEX IF NOT EXISTS idx_garmin_pull_jobs_athlete_pending
  ON public.garmin_pull_jobs (athlete_id, created_at DESC)
  WHERE status = 'pending' AND athlete_id IS NOT NULL;

COMMENT ON COLUMN public.garmin_pull_jobs.athlete_id IS 'Risolto da garmin_user_id della push + garmin_athlete_links; usato per import executed_workouts.';
