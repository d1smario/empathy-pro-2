-- Allinea `coach_athletes` a Pro 2 (PK org_id + coach + athlete).
-- Richiede `000_pro2_orgs.sql` e la tabella `coach_athletes` già creata da `001_pro2_v1_canonical_prereq_read_spine.sql` (parità V1 `004_auth_user_context.sql`).

ALTER TABLE public.coach_athletes
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs (id) ON DELETE CASCADE;

UPDATE public.coach_athletes
SET org_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE org_id IS NULL;

ALTER TABLE public.coach_athletes
  ALTER COLUMN org_id SET DEFAULT '00000000-0000-4000-8000-000000000001'::uuid;

ALTER TABLE public.coach_athletes
  ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE public.coach_athletes DROP CONSTRAINT IF EXISTS coach_athletes_pkey;

ALTER TABLE public.coach_athletes
  ADD PRIMARY KEY (org_id, coach_user_id, athlete_id);

CREATE INDEX IF NOT EXISTS idx_coach_athletes_coach_org ON public.coach_athletes (coach_user_id, org_id);
