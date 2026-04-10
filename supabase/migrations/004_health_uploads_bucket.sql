-- Bucket privato per PDF/immagini Health (upload server-side con service role).
-- Nome default allineato a `HEALTH_UPLOADS_BUCKET=empathy_health_uploads` in `.env.example`.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empathy_health_uploads',
  'empathy_health_uploads',
  false,
  12582912,
  ARRAY[
    'application/pdf',
    'application/x-pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
