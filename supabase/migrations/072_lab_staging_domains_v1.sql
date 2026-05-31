-- =============================================================================
-- 072 — Digital Athlete Lab: staging domains biomechanics + aerodynamics
-- =============================================================================
-- CV/geometry proposals enter interpretation_staging_runs (L2); commit promotes
-- to biomech_session_imports / aero_test_sessions via domain apply routes.
-- =============================================================================

alter table public.interpretation_staging_runs
  drop constraint if exists interpretation_staging_runs_domain_check;

alter table public.interpretation_staging_runs
  add constraint interpretation_staging_runs_domain_check
  check (
    domain in (
      'training',
      'nutrition',
      'health',
      'recovery',
      'physiology',
      'bioenergetics',
      'cross_module',
      'biomechanics',
      'aerodynamics'
    )
  );

comment on table public.interpretation_staging_runs is
  'L2 staging: proposals (health VLM, biomech pose CV, aero geometry CV). Canonical numbers only after apply/commit.';
