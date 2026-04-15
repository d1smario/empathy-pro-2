-- 010 (parte B): vincolo univoco su email normalizzata.
-- Fallisce con ERROR 23505 se esistono ancora più righe con lo stesso lower(trim(email)).
-- In quel caso eseguire prima: supabase/PASTE_DEDUPE_ATHLETE_EMAIL_THEN_INDEX_009.sql
-- (oppure deduplica manuale) poi rilanciare solo questo file.

CREATE UNIQUE INDEX IF NOT EXISTS uq_athlete_profiles_email_normalized
  ON public.athlete_profiles (lower(trim(email)))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;
