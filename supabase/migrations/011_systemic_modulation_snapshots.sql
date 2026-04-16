-- Pro 2 — Livello 8: snapshot di modulazione sistemica (neuroendocrino, microbiota, epigenetica, omiche).
-- Richiede tabella canonica `athlete_profiles` (V1 / schema condiviso). Contratto: `docs/EMPATHY_LAYER8_SYSTEMIC_MODULATION.md`.

CREATE TABLE IF NOT EXISTS public.systemic_modulation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athlete_profiles (id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  algorithm_version text NOT NULL DEFAULT 'l8_v0',
  source text NOT NULL DEFAULT 'unknown',
  axes text[] NOT NULL DEFAULT '{}'::text[],
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_systemic_mod_snapshots_athlete_captured
  ON public.systemic_modulation_snapshots (athlete_id, captured_at DESC);

COMMENT ON TABLE public.systemic_modulation_snapshots IS
  'L8 systemic modulation: versioned JSON snapshot + axes; feeds athlete memory / twin modulation — not a parallel twin store.';

COMMENT ON COLUMN public.systemic_modulation_snapshots.axes IS
  'Logical axes present in this snapshot, e.g. neuroendocrine, microbiota, epigenetic, omics_rollup.';

COMMENT ON COLUMN public.systemic_modulation_snapshots.payload IS
  'Evolving contract (see EMPATHY_LAYER8_SYSTEMIC_MODULATION.md); unknown keys ignored by consumers.';

ALTER TABLE public.systemic_modulation_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "systemic_modulation_snapshots_select_scoped" ON public.systemic_modulation_snapshots;
CREATE POLICY "systemic_modulation_snapshots_select_scoped"
  ON public.systemic_modulation_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = systemic_modulation_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = systemic_modulation_snapshots.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "systemic_modulation_snapshots_insert_scoped" ON public.systemic_modulation_snapshots;
CREATE POLICY "systemic_modulation_snapshots_insert_scoped"
  ON public.systemic_modulation_snapshots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = systemic_modulation_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = systemic_modulation_snapshots.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "systemic_modulation_snapshots_update_scoped" ON public.systemic_modulation_snapshots;
CREATE POLICY "systemic_modulation_snapshots_update_scoped"
  ON public.systemic_modulation_snapshots
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = systemic_modulation_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = systemic_modulation_snapshots.athlete_id
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
          (aup.role = 'private' AND aup.athlete_id = systemic_modulation_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = systemic_modulation_snapshots.athlete_id
          ))
        )
    )
  );

DROP POLICY IF EXISTS "systemic_modulation_snapshots_delete_scoped" ON public.systemic_modulation_snapshots;
CREATE POLICY "systemic_modulation_snapshots_delete_scoped"
  ON public.systemic_modulation_snapshots
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM app_user_profiles aup
      WHERE aup.user_id = auth.uid()
        AND (
          (aup.role = 'private' AND aup.athlete_id = systemic_modulation_snapshots.athlete_id)
          OR
          (aup.role = 'coach' AND EXISTS (
            SELECT 1
            FROM coach_athletes ca
            WHERE ca.coach_user_id = auth.uid()
              AND ca.athlete_id = systemic_modulation_snapshots.athlete_id
          ))
        )
    )
  );
