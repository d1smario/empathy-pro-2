-- Pro 2 — i18n surface-only: locale lookup + preferenza utente.
--
-- Modello: traduzione SOLO presentazione. Le chiavi canoniche (slug esercizi,
-- fdc_id, key engine come `phase = "glycolytic"`) non cambiano mai.
-- Questa migration introduce solo lo strato di scelta lingua lato profilo.
--
-- 1) `supported_locales` = lookup table delle lingue disponibili nel prodotto.
--    Le righe `is_enabled = true` sono quelle attualmente attive nel selettore.
--    Aggiungere una lingua = INSERT + UPDATE is_enabled (no nuova migration).
--
-- 2) `app_user_profiles.preferred_locale` referenzia `supported_locales(code)`.
--    Default IT (mercato attuale). EN abilitato come fallback universale.
--    Le altre 10 lingue restano `is_enabled = false`: prenotate lo schema
--    senza esporle in UI finché non ci sono traduzioni reali.
--
-- 3) `app_user_profiles.preferred_units` (asse separato: kg/lb, km/mi).
--    Non legato alla locale — un utente US può volere EN + metric.
--
-- Idempotente.

create table if not exists public.supported_locales (
  code text primary key,
  display_name text not null,
  is_enabled boolean not null default false,
  rtl boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

alter table public.supported_locales enable row level security;

drop policy if exists "supported_locales_read_all" on public.supported_locales;
create policy "supported_locales_read_all"
  on public.supported_locales
  for select
  to authenticated, anon
  using (true);

-- Lingue prenotate. Solo IT + EN abilitate.
insert into public.supported_locales (code, display_name, is_enabled, rtl, sort_order)
values
  ('it', 'Italiano',  true,  false, 10),
  ('en', 'English',   true,  false, 20),
  ('fr', 'Français',  false, false, 30),
  ('es', 'Español',   false, false, 40),
  ('de', 'Deutsch',   false, false, 50),
  ('nl', 'Nederlands',false, false, 60),
  ('no', 'Norsk',     false, false, 70),
  ('sv', 'Svenska',   false, false, 80),
  ('pt', 'Português', false, false, 90),
  ('ru', 'Русский',   false, false, 110),
  ('zh', '中文',       false, false, 120),
  ('ja', '日本語',     false, false, 130),
  ('ar', 'العربية',    false, true,  140)
on conflict (code) do nothing;

-- Preferenza utente: FK su `supported_locales(code)`.
-- Default 'it' compatibile con la riga seed appena inserita.
alter table public.app_user_profiles
  add column if not exists preferred_locale text not null default 'it';

-- Aggiungiamo la FK solo se manca (idempotenza su rerun).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'app_user_profiles'
      and constraint_name = 'app_user_profiles_preferred_locale_fkey'
  ) then
    alter table public.app_user_profiles
      add constraint app_user_profiles_preferred_locale_fkey
      foreign key (preferred_locale) references public.supported_locales (code);
  end if;
end $$;

-- Unità misura: asse separato da lingua. Default metric.
alter table public.app_user_profiles
  add column if not exists preferred_units text not null default 'metric'
    constraint app_user_profiles_preferred_units_chk
      check (preferred_units in ('metric','imperial'));

comment on table public.supported_locales is
  'Lookup lingue prodotto Pro 2. is_enabled=true filtra il selettore UI. Aggiungere lingua = INSERT + UPDATE is_enabled (no migration).';
comment on column public.app_user_profiles.preferred_locale is
  'Locale UI scelta dall utente. FK su supported_locales.code. Default it.';
comment on column public.app_user_profiles.preferred_units is
  'Unita misura (metric/imperial). Asse separato dalla lingua. Default metric.';
