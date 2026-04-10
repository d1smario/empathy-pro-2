-- Job di pull verso callbackURL Garmin (dopo push). Richiede OAuth 1.0a consumer da portale → API Pull Token / API Configuration.
-- Contiene user_access_token in chiaro: solo service role; nessuna policy SELECT per utenti finali.

CREATE TABLE IF NOT EXISTS public.garmin_pull_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  receipt_id uuid REFERENCES public.garmin_push_receipts (id) ON DELETE SET NULL,
  stream_key text,
  endpoint_kind text NOT NULL,
  callback_url text NOT NULL,
  user_access_token text NOT NULL,
  query_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fetching', 'completed', 'failed')),
  http_status int,
  response_body jsonb,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_garmin_pull_jobs_pending
  ON public.garmin_pull_jobs (created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_garmin_pull_jobs_receipt
  ON public.garmin_pull_jobs (receipt_id);

COMMENT ON TABLE public.garmin_pull_jobs IS 'Coda pull Health API: firma OAuth1 con consumer key/secret + userAccessToken dalla push.';

ALTER TABLE public.garmin_pull_jobs ENABLE ROW LEVEL SECURITY;
