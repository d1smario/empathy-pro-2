-- Staging privato per import manuale Training (FIT/TCX/GPX/CSV/JSON/…) via upload diretto al Storage,
-- così il body non transita sul limite ~4.5 MB delle Vercel Functions.
-- Nome bucket default: `empathy_training_manual_imports` (override con TRAINING_MANUAL_IMPORTS_BUCKET).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empathy_training_manual_imports',
  'empathy_training_manual_imports',
  false,
  52428800,
  ARRAY[
    'application/octet-stream',
    'application/gzip',
    'application/x-gzip',
    'application/vnd.garmin.fit',
    'text/xml',
    'application/xml',
    'application/gpx+xml',
    'application/tcx+xml',
    'text/csv',
    'application/json',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
