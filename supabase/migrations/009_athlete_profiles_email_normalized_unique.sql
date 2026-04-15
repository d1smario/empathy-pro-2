-- Idempotenza profilo atleta per email: lookup normalizzato + vincolo univoco.
-- Se CREATE UNIQUE INDEX fallisce per righe duplicate (stesso lower(trim(email))),
-- deduplica i dati nel progetto (reassign FK → un solo id → delete duplicati) poi riesegui.

CREATE OR REPLACE FUNCTION public.athlete_profile_id_by_normalized_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ap.id
  FROM public.athlete_profiles ap
  WHERE p_email IS NOT NULL
    AND length(trim(p_email)) > 0
    AND ap.email IS NOT NULL
    AND length(trim(ap.email)) > 0
    AND lower(trim(ap.email)) = lower(trim(p_email))
  ORDER BY ap.created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.athlete_profile_id_by_normalized_email(text) IS
  'Prima riga athlete_profiles per email normalizzata (lower(trim)); usata da ensure-profile.';

GRANT EXECUTE ON FUNCTION public.athlete_profile_id_by_normalized_email(text) TO anon, authenticated, service_role;

CREATE UNIQUE INDEX IF NOT EXISTS uq_athlete_profiles_email_normalized
  ON public.athlete_profiles (lower(trim(email)))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;
