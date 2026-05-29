-- Pro 2 — Vitality module: Empathy Coin ledger (append-only).
-- Coins earned per "efficient day". Balance + tier (Bronze/Silver/Gold) are DERIVED (sum), never stored.
-- Idempotent per (athlete_id, earned_for_date, reason) so re-running the award job cannot double-credit.
-- Append-only: SELECT + INSERT policies only (no UPDATE/DELETE for athletes/coaches).
-- See docs/VITALITY_HEALTH_INDEX_AND_COIN.md.

CREATE TABLE IF NOT EXISTS public.empathy_coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athlete_profiles (id) ON DELETE CASCADE,
  user_id uuid,
  earned_for_date date NOT NULL,
  coins integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'efficient_day',
  epi_score numeric(5,2),
  ledger_version text NOT NULL DEFAULT 'coin_v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empathy_coin_ledger_unique_award UNIQUE (athlete_id, earned_for_date, reason)
);

CREATE INDEX IF NOT EXISTS idx_empathy_coin_ledger_athlete_created
  ON public.empathy_coin_ledger (athlete_id, created_at DESC);

COMMENT ON TABLE public.empathy_coin_ledger IS
  'Append-only Empathy Coin ledger. Balance/tier are derived sums. Idempotent per athlete/day/reason. Audit base for certification.';

ALTER TABLE public.empathy_coin_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empathy_coin_ledger_select_scoped" ON public.empathy_coin_ledger;
CREATE POLICY "empathy_coin_ledger_select_scoped"
  ON public.empathy_coin_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = empathy_coin_ledger.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = empathy_coin_ledger.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "empathy_coin_ledger_insert_scoped" ON public.empathy_coin_ledger;
CREATE POLICY "empathy_coin_ledger_insert_scoped"
  ON public.empathy_coin_ledger
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = empathy_coin_ledger.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = empathy_coin_ledger.athlete_id
          ))
        )
    )
  );
