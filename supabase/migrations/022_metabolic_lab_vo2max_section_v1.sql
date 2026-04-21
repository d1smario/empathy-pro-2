-- Parità V1 → Pro 2 (L4.r physiology lab): equivalente a
--   nextjs-empathy-pro/supabase/migrations/027_metabolic_lab_vo2max_section.sql
-- Consente sezione `vo2max_lab` in metabolic_lab_runs (richiede tabella da `015_read_spine` / V1 `005`).

alter table public.metabolic_lab_runs drop constraint if exists metabolic_lab_runs_section_check;

alter table public.metabolic_lab_runs add constraint metabolic_lab_runs_section_check
  check (section in (
    'metabolic_profile',
    'lactate_analysis',
    'max_oxidate',
    'vo2max_lab'
  ));
