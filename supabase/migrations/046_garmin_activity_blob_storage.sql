-- Blob attività Garmin (FIT/TCX/GPX/…) dopo GET su callback URL Health API → Storage privato + riga indice.
-- Naming bucket allineato a env GARMIN_ACTIVITY_BLOBS_BUCKET (default consigliato: garmin-activity-blobs).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'garmin-activity-blobs',
  'garmin-activity-blobs',
  false,
  52428800,
  ARRAY[
    'application/octet-stream',
    'application/vnd.garmin.fit',
    'application/gzip',
    'application/x-gzip',
    'text/xml',
    'application/xml',
    'application/gpx+xml',
    'application/tcx+xml'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.garmin_pull_binary_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pull_job_id uuid NOT NULL REFERENCES public.garmin_pull_jobs (id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.athlete_profiles (id) ON DELETE SET NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  content_type text,
  byte_length bigint NOT NULL CHECK (byte_length >= 0),
  sha256_hex text NOT NULL,
  extension text,
  endpoint_kind text,
  fit_extract jsonb,
  CONSTRAINT garmin_pull_binary_objects_pull_job_unique UNIQUE (pull_job_id)
);

CREATE INDEX IF NOT EXISTS idx_garmin_pull_binary_objects_athlete_created
  ON public.garmin_pull_binary_objects (athlete_id, created_at DESC);

COMMENT ON TABLE public.garmin_pull_binary_objects IS
  'Riferimento a file binario Garmin (FIT ecc.) caricato dopo pull job; accesso via service role / signed URL.';
COMMENT ON COLUMN public.garmin_pull_binary_objects.fit_extract IS
  'Riassunto opzionale da fit-file-parser (best-effort); null se non è FIT o parsing non tentato.';

ALTER TABLE public.garmin_pull_binary_objects ENABLE ROW LEVEL SECURITY;
