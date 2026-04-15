-- 009 (parte A): funzione lookup per email normalizzata — sicura anche con email duplicate in tabella.
-- L’indice univoco è in 010: eseguire 010 solo dopo deduplica (o su DB senza duplicati per stessa email normalizzata).

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
