-- Garmin Health API — notifiche push in ingresso (metadata + callbackURL verso pull API Garmin).
-- Inserimento solo da route server con SUPABASE_SERVICE_ROLE_KEY (RLS senza policy utente).
-- Se il DB è condiviso con V1, applicare questa migration una sola volta.

CREATE TABLE IF NOT EXISTS public.garmin_push_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  endpoint_kind text NOT NULL,
  content_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  token_fingerprints text[] NOT NULL DEFAULT '{}'::text[]
);

CREATE INDEX IF NOT EXISTS idx_garmin_push_receipts_created
  ON public.garmin_push_receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_garmin_push_receipts_kind_created
  ON public.garmin_push_receipts (endpoint_kind, created_at DESC);

COMMENT ON TABLE public.garmin_push_receipts IS 'Ricezione push Garmin Connect Developer; payload con userAccessToken redatti; step successivo = pull file da callbackURL con OAuth utente.';

ALTER TABLE public.garmin_push_receipts ENABLE ROW LEVEL SECURITY;
