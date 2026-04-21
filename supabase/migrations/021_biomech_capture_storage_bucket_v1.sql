-- Parità V1 → Pro 2 (L4.r biomech storage): equivalente a
--   nextjs-empathy-pro/supabase/migrations/023_biomech_capture_storage_bucket.sql
-- Bucket privato per video/foto cattura (signed URL + service role nelle route).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'biomech-capture',
  'biomech-capture',
  false,
  524288000,
  ARRAY['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
