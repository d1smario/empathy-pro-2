-- Pro 2 — Subscription grants (accessi gratuiti concessi dall'admin).
--
-- Convoglia (NON parallelizza) il flusso billing canonico:
--   - billing_subscriptions = abbonamento Stripe pagato (status active/trialing).
--   - subscription_grants  = accesso gratuito concesso da platform admin per periodo
--     definito (testimonial 3/6/9 mesi, promo 1 mese, comp manuale).
--
-- Un unico resolver (`resolveUserAccessEntitlement`) legge entrambe e dice se
-- l'utente ha accesso. Niente percorsi paralleli.
--
-- Coach: NON usa questa tabella per "essere coach" — quello resta `app_user_profiles.platform_coach_status`
-- (già esistente, già protetto da trigger anti auto-elevation in 024). Un coach approved
-- può comunque NON avere entitlement come atleta: per usare la piattaforma come atleta
-- serve subscription o grant proprio. Anti-bypass del caso "mi iscrivo coach, mi alleno gratis".
--
-- Idempotente.

create table if not exists public.subscription_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('testimonial', 'promo', 'comp', 'beta')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  note text,
  granted_by_user_id uuid references auth.users (id) on delete set null,
  granted_by_email text,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users (id) on delete set null,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_grants_period_chk check (ends_at > starts_at)
);

create index if not exists idx_subscription_grants_user_active
  on public.subscription_grants (user_id, ends_at desc)
  where revoked_at is null;

create index if not exists idx_subscription_grants_user_kind
  on public.subscription_grants (user_id, kind);

alter table public.subscription_grants enable row level security;

-- Lettura: l'utente vede i propri grant; admin globale via service role nelle route.
drop policy if exists "subscription_grants_select_own" on public.subscription_grants;
create policy "subscription_grants_select_own"
  on public.subscription_grants
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Insert/update/delete: SOLO service_role (admin route).
-- Nessuna policy authenticated → bloccato dal RLS.

comment on table public.subscription_grants is
  'Accessi gratuiti concessi dal platform admin (testimonial, promo, comp, beta). Letti dal resolver entitlement insieme a billing_subscriptions.';
comment on column public.subscription_grants.kind is
  'testimonial = profilo dimostrativo gratuito (3-6-9 mesi); promo = trial promozionale (1 mese); comp = comp ad-hoc; beta = accesso beta tester.';
comment on column public.subscription_grants.ends_at is
  'Scadenza grant. Dopo questa data il resolver torna `none` (a meno di altre fonti attive).';
comment on column public.subscription_grants.revoked_at is
  'Se valorizzato, grant invalido prima di ends_at. Rispetta history (no DELETE da UI).';

-- Trigger updated_at (best-effort se esiste già la funzione comune).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_subscription_grants_set_updated_at on public.subscription_grants;
    execute 'create trigger trg_subscription_grants_set_updated_at
      before update on public.subscription_grants
      for each row execute function public.set_updated_at()';
  end if;
end $$;
