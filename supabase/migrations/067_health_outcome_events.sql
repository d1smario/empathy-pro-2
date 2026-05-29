-- Pro 2 — Vitality / EPI: outcomes-ready linkage table (efficacy studies).
-- Append-only record of REAL-WORLD outcomes per athlete/period (work absences, illness episodes,
-- clinical markers, self-reported state) so EPI longitudinal snapshots + coin ledger can later be
-- correlated with outcomes (cohorts EPI high vs low) WITHOUT a destructive migration.
--
-- Scope guard: this table only RECORDS outcomes locally (athlete-owned, RLS). External sharing
-- with third parties (insurers/employers/welfare) is Phase 6 — OFF-APP and consent-gated — and is
-- NOT implemented here. `consent_for_research` prepares aggregate/anonymous studies only.
--
-- Not a parallel clinical store: structured biomarkers stay in biomarker_panels; rows here with
-- category 'clinical_marker' reference that data (via metadata) rather than duplicating it.
-- RLS mirrors 065_epi_snapshots.sql. Append-only like 066_empathy_coin_ledger.sql.

CREATE TABLE IF NOT EXISTS public.health_outcome_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athlete_profiles (id) ON DELETE CASCADE,
  user_id uuid,
  occurred_on date NOT NULL,
  period_end date,
  category text NOT NULL DEFAULT 'self_reported',
  metric_key text,
  value_numeric numeric,
  value_text text,
  unit text,
  source text NOT NULL DEFAULT 'self_report',
  consent_for_research boolean NOT NULL DEFAULT false,
  algorithm_context text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_outcome_events_category_chk
    CHECK (category IN ('work_absence', 'illness_episode', 'clinical_marker', 'self_reported', 'other')),
  CONSTRAINT health_outcome_events_period_chk
    CHECK (period_end IS NULL OR period_end >= occurred_on)
);

CREATE INDEX IF NOT EXISTS idx_health_outcome_events_athlete_date
  ON public.health_outcome_events (athlete_id, occurred_on DESC);

CREATE INDEX IF NOT EXISTS idx_health_outcome_events_category
  ON public.health_outcome_events (athlete_id, category);

COMMENT ON TABLE public.health_outcome_events IS
  'Append-only outcomes-ready linkage table for EPI efficacy studies (work absences, illness episodes, clinical markers, self-reported). Local recording only; external sharing is off-app Phase 6.';
COMMENT ON COLUMN public.health_outcome_events.consent_for_research IS
  'Athlete consent for inclusion in aggregate/anonymous efficacy studies. Default false; never implies external identifiable sharing.';
COMMENT ON COLUMN public.health_outcome_events.algorithm_context IS
  'EPI algorithm_version active when the outcome was recorded (reproducibility of any correlation).';

ALTER TABLE public.health_outcome_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_outcome_events_select_scoped" ON public.health_outcome_events;
CREATE POLICY "health_outcome_events_select_scoped"
  ON public.health_outcome_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = health_outcome_events.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = health_outcome_events.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "health_outcome_events_insert_scoped" ON public.health_outcome_events;
CREATE POLICY "health_outcome_events_insert_scoped"
  ON public.health_outcome_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = health_outcome_events.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = health_outcome_events.athlete_id
          ))
        )
    )
  );

-- Append-only: no UPDATE/DELETE policies (parity with empathy_coin_ledger). Corrections are new rows.
