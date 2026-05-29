-- Pro 2 — Longevity & Fitness module: daily subjective check-in (reality ingest).
-- One row per (athlete_id, checkin_date). Subjective 1-5 scales + illness/symptom flags.
-- Canonical key athlete_id; feeds EPI engine + Empathy Coin. See docs/LONGEVITY_FITNESS_INDEX_AND_COIN.md.
-- RLS pattern mirrors 011_systemic_modulation_snapshots.sql (private owner OR linked coach).

CREATE TABLE IF NOT EXISTS public.athlete_daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athlete_profiles (id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  energy smallint CHECK (energy IS NULL OR (energy BETWEEN 1 AND 5)),
  mood smallint CHECK (mood IS NULL OR (mood BETWEEN 1 AND 5)),
  sleep_quality smallint CHECK (sleep_quality IS NULL OR (sleep_quality BETWEEN 1 AND 5)),
  soreness smallint CHECK (soreness IS NULL OR (soreness BETWEEN 1 AND 5)),
  stress smallint CHECK (stress IS NULL OR (stress BETWEEN 1 AND 5)),
  motivation smallint CHECK (motivation IS NULL OR (motivation BETWEEN 1 AND 5)),
  illness_flags text[] NOT NULL DEFAULT '{}'::text[],
  note text,
  source text NOT NULL DEFAULT 'self_report',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT athlete_daily_checkins_unique_day UNIQUE (athlete_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_athlete_daily_checkins_athlete_date
  ON public.athlete_daily_checkins (athlete_id, checkin_date DESC);

COMMENT ON TABLE public.athlete_daily_checkins IS
  'Longevity & Fitness daily subjective check-in (reality ingest): mood/energy/sleep/soreness/stress + illness flags. Feeds EPI engine; not a parallel twin store.';
COMMENT ON COLUMN public.athlete_daily_checkins.illness_flags IS
  'Malaise/symptom flags: fever, headache, sore_throat, gi_upset, cold_flu, injury, other. Presence => illness day (efficiency target suspended).';

ALTER TABLE public.athlete_daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "athlete_daily_checkins_select_scoped" ON public.athlete_daily_checkins;
CREATE POLICY "athlete_daily_checkins_select_scoped"
  ON public.athlete_daily_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = athlete_daily_checkins.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = athlete_daily_checkins.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "athlete_daily_checkins_insert_scoped" ON public.athlete_daily_checkins;
CREATE POLICY "athlete_daily_checkins_insert_scoped"
  ON public.athlete_daily_checkins
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = athlete_daily_checkins.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = athlete_daily_checkins.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "athlete_daily_checkins_update_scoped" ON public.athlete_daily_checkins;
CREATE POLICY "athlete_daily_checkins_update_scoped"
  ON public.athlete_daily_checkins
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = athlete_daily_checkins.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = athlete_daily_checkins.athlete_id
          ))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = athlete_daily_checkins.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = athlete_daily_checkins.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "athlete_daily_checkins_delete_scoped" ON public.athlete_daily_checkins;
CREATE POLICY "athlete_daily_checkins_delete_scoped"
  ON public.athlete_daily_checkins
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = athlete_daily_checkins.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = athlete_daily_checkins.athlete_id
          ))
        )
    )
  );
