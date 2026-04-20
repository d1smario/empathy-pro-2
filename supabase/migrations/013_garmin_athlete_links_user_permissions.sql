-- Snapshot permessi utente Health API (GET /rest/user/permissions) dopo OAuth.

ALTER TABLE public.garmin_athlete_links
  ADD COLUMN IF NOT EXISTS user_permissions jsonb;

COMMENT ON COLUMN public.garmin_athlete_links.user_permissions IS
  'Elenco permessi concessi (GET wellness-api/rest/user/permissions). Aggiornabile da webhook userPermissions.';
