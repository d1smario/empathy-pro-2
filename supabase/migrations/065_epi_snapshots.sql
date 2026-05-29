-- Pro 2 — Vitality module: EPI (Empathy Physiological Index) snapshots.
-- Versioned projection (NOT a parallel twin). One row per (athlete_id, snapshot_date, algorithm_version).
-- Stores score + per-pillar breakdown + data tier + illness flag + INPUT PROVENANCE for
-- reproducibility/certification (see docs/VITALITY_HEALTH_INDEX_AND_COIN.md sec.5).
-- RLS mirrors 011_systemic_modulation_snapshots.sql.

CREATE TABLE IF NOT EXISTS public.epi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athlete_profiles (id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  algorithm_version text NOT NULL DEFAULT 'epi_v1',
  epi_score numeric(5,2) NOT NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0,
  data_tier text NOT NULL DEFAULT 'none',
  illness_flag boolean NOT NULL DEFAULT false,
  efficient_day boolean NOT NULL DEFAULT false,
  pillars jsonb NOT NULL DEFAULT '[]'::jsonb,
  inputs_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epi_snapshots_unique_day_version UNIQUE (athlete_id, snapshot_date, algorithm_version)
);

CREATE INDEX IF NOT EXISTS idx_epi_snapshots_athlete_date
  ON public.epi_snapshots (athlete_id, snapshot_date DESC);

COMMENT ON TABLE public.epi_snapshots IS
  'Versioned EPI projection: deterministic Health Index per day. Reproducible via algorithm_version + inputs_provenance. Not a parallel twin.';
COMMENT ON COLUMN public.epi_snapshots.inputs_provenance IS
  'Which pillars/inputs were present and the subjective/illness context for this score (audit trail for efficacy studies).';

ALTER TABLE public.epi_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "epi_snapshots_select_scoped" ON public.epi_snapshots;
CREATE POLICY "epi_snapshots_select_scoped"
  ON public.epi_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = epi_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = epi_snapshots.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "epi_snapshots_insert_scoped" ON public.epi_snapshots;
CREATE POLICY "epi_snapshots_insert_scoped"
  ON public.epi_snapshots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = epi_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = epi_snapshots.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "epi_snapshots_update_scoped" ON public.epi_snapshots;
CREATE POLICY "epi_snapshots_update_scoped"
  ON public.epi_snapshots
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = epi_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = epi_snapshots.athlete_id
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
          (aup.role = 'private' AND aup.athlete_id = epi_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = epi_snapshots.athlete_id
          ))
        )
    )
  );
