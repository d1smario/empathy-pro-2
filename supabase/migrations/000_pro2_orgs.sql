-- Organizzazioni multitenant (coach / inviti Pro 2).
-- UUID seed = default runtime se `EMPATHY_COACH_ATHLETES_ORG_ID` non è impostato (vedi `lib/coach-org-id.ts`).

CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.orgs (id, name)
VALUES (
  '00000000-0000-4000-8000-000000000001'::uuid,
  'EMPATHY default organization'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.orgs IS 'Scope coach↔atleta e FK su coach_invitations; seed id allineato a coachOrgIdForDb()';
