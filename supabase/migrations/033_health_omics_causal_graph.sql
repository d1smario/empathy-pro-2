-- Pro 2 — Health/Omics normalized observations + athlete causal graph.
-- Phase A baseline schema for cross-module interpretation.

create extension if not exists pgcrypto;

-- ========= dictionaries =========
create table if not exists public.health_marker_dictionary (
  id uuid primary key default gen_random_uuid(),
  marker_key text not null unique,
  panel_type text not null check (panel_type in ('blood','microbiota','epigenetics','hormones','inflammation','oxidative_stress')),
  label text not null,
  aliases text[] not null default '{}',
  unit text,
  area text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_health_marker_dictionary_panel on public.health_marker_dictionary (panel_type, marker_key);

create table if not exists public.omics_entity_dictionary (
  id uuid primary key default gen_random_uuid(),
  entity_key text not null unique,
  entity_type text not null check (entity_type in ('gene','protein','metabolite','taxon','pathway','receptor','neurochemical')),
  canonical_symbol text not null,
  aliases text[] not null default '{}',
  namespace text,
  taxon_rank text check (taxon_rank in ('phylum','family','genus','species','fungi','other')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_omics_entity_dictionary_type on public.omics_entity_dictionary (entity_type, canonical_symbol);

create table if not exists public.causal_rule_catalog (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  rule_version text not null,
  domain text not null check (domain in ('training','nutrition','physiology','health','bioenergetics','cross_module')),
  description text not null,
  condition_expr jsonb not null default '{}'::jsonb,
  effect_expr jsonb not null default '{}'::jsonb,
  severity text check (severity in ('low','moderate','high','critical')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_causal_rule_catalog_domain on public.causal_rule_catalog (domain, active);

-- ========= extraction =========
create table if not exists public.extraction_runs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  panel_id uuid references public.biomarker_panels (id) on delete set null,
  source_kind text not null check (source_kind in ('pdf','image','manual','api','other')),
  parser_version text,
  status text not null check (status in ('parsed_full','parsed_partial','needs_manual_review','failed')),
  source_hash text,
  quality_report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_extraction_runs_athlete_created on public.extraction_runs (athlete_id, created_at desc);
create index if not exists idx_extraction_runs_panel on public.extraction_runs (panel_id) where panel_id is not null;

-- ========= normalized observations =========
create table if not exists public.lab_observations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  panel_id uuid references public.biomarker_panels (id) on delete set null,
  extraction_run_id uuid references public.extraction_runs (id) on delete set null,
  marker_key text not null references public.health_marker_dictionary (marker_key) on delete restrict,
  value_num numeric,
  value_text text,
  unit text,
  ref_low numeric,
  ref_high numeric,
  raw_label text,
  observed_at date,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now()
);

create index if not exists idx_lab_observations_athlete_marker_date on public.lab_observations (athlete_id, marker_key, observed_at desc);
create index if not exists idx_lab_observations_panel on public.lab_observations (panel_id) where panel_id is not null;

create table if not exists public.microbiota_observations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  panel_id uuid references public.biomarker_panels (id) on delete set null,
  extraction_run_id uuid references public.extraction_runs (id) on delete set null,
  taxon_key text not null,
  taxon_rank text not null check (taxon_rank in ('phylum','family','genus','species','fungi','other')),
  domain_kind text not null check (domain_kind in ('bacteria','fungi','other')),
  abundance_pct numeric,
  value_num numeric,
  unit text,
  observed_at date,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_microbiota_observations_athlete_taxon_date on public.microbiota_observations (athlete_id, taxon_key, observed_at desc);

create table if not exists public.epigenetic_observations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  panel_id uuid references public.biomarker_panels (id) on delete set null,
  extraction_run_id uuid references public.extraction_runs (id) on delete set null,
  gene_symbol text,
  variant_label text,
  methylation_flag text,
  direction text check (direction in ('up','down','neutral','risk','protective')),
  value_num numeric,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  observed_at date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_epigenetic_observations_athlete_gene_date on public.epigenetic_observations (athlete_id, gene_symbol, observed_at desc);

create table if not exists public.hormone_observations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  panel_id uuid references public.biomarker_panels (id) on delete set null,
  extraction_run_id uuid references public.extraction_runs (id) on delete set null,
  axis text check (axis in ('hpa','hpg','thyroid','adrenal','other')),
  marker_key text,
  value_num numeric,
  unit text,
  observed_at date,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_hormone_observations_athlete_axis_date on public.hormone_observations (athlete_id, axis, observed_at desc);

-- ========= athlete causal graph =========
create table if not exists public.athlete_system_nodes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  node_key text not null,
  area text not null check (area in ('physiology','biochimica','microbiotica','genetica','neuroendocrino','nutrigenomica','omics','training','nutrition','recovery')),
  label text not null,
  state jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (athlete_id, node_key, observed_at)
);

create index if not exists idx_athlete_system_nodes_athlete_area on public.athlete_system_nodes (athlete_id, area, observed_at desc);

create table if not exists public.athlete_system_edges (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  from_node_key text not null,
  to_node_key text not null,
  effect_sign text not null check (effect_sign in ('increase','decrease','risk_up','risk_down','modulate')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  evidence_refs jsonb not null default '[]'::jsonb,
  rule_key text references public.causal_rule_catalog (rule_key) on delete set null,
  rule_version text,
  time_window text,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_athlete_system_edges_athlete_nodes on public.athlete_system_edges (athlete_id, from_node_key, to_node_key, observed_at desc);

create table if not exists public.bioenergetics_responses (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  response_key text not null,
  category text not null check (category in ('risk','facilitation','warning','opportunity')),
  title text not null,
  description text not null,
  trigger_refs jsonb not null default '[]'::jsonb,
  mitigation_refs jsonb not null default '[]'::jsonb,
  severity text check (severity in ('low','moderate','high','critical')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_bioenergetics_responses_athlete_category on public.bioenergetics_responses (athlete_id, category, observed_at desc);

create table if not exists public.observation_lineage (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athlete_profiles (id) on delete cascade,
  extraction_run_id uuid references public.extraction_runs (id) on delete set null,
  source_table text not null,
  source_id uuid,
  target_table text not null,
  target_id uuid,
  relation text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_observation_lineage_athlete_created on public.observation_lineage (athlete_id, created_at desc);

-- ========= RLS read scope =========
alter table public.health_marker_dictionary enable row level security;
alter table public.omics_entity_dictionary enable row level security;
alter table public.causal_rule_catalog enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.lab_observations enable row level security;
alter table public.microbiota_observations enable row level security;
alter table public.epigenetic_observations enable row level security;
alter table public.hormone_observations enable row level security;
alter table public.athlete_system_nodes enable row level security;
alter table public.athlete_system_edges enable row level security;
alter table public.bioenergetics_responses enable row level security;
alter table public.observation_lineage enable row level security;

drop policy if exists "dict_read_authenticated_markers" on public.health_marker_dictionary;
create policy "dict_read_authenticated_markers" on public.health_marker_dictionary for select to authenticated using (true);
drop policy if exists "dict_read_authenticated_omics" on public.omics_entity_dictionary;
create policy "dict_read_authenticated_omics" on public.omics_entity_dictionary for select to authenticated using (true);
drop policy if exists "dict_read_authenticated_rules" on public.causal_rule_catalog;
create policy "dict_read_authenticated_rules" on public.causal_rule_catalog for select to authenticated using (true);

create or replace function public._can_read_athlete(_athlete_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_user_profiles aup
    where aup.user_id = auth.uid()
      and (
        (aup.role = 'private' and aup.athlete_id = _athlete_id)
        or (
          aup.role = 'coach'
          and exists (
            select 1 from public.coach_athletes ca
            where ca.coach_user_id = auth.uid() and ca.athlete_id = _athlete_id
          )
        )
      )
  );
$$;

drop policy if exists "extraction_runs_select_scoped" on public.extraction_runs;
create policy "extraction_runs_select_scoped" on public.extraction_runs for select to authenticated using (public._can_read_athlete(athlete_id));
drop policy if exists "lab_observations_select_scoped" on public.lab_observations;
create policy "lab_observations_select_scoped" on public.lab_observations for select to authenticated using (public._can_read_athlete(athlete_id));
drop policy if exists "microbiota_observations_select_scoped" on public.microbiota_observations;
create policy "microbiota_observations_select_scoped" on public.microbiota_observations for select to authenticated using (public._can_read_athlete(athlete_id));
drop policy if exists "epigenetic_observations_select_scoped" on public.epigenetic_observations;
create policy "epigenetic_observations_select_scoped" on public.epigenetic_observations for select to authenticated using (public._can_read_athlete(athlete_id));
drop policy if exists "hormone_observations_select_scoped" on public.hormone_observations;
create policy "hormone_observations_select_scoped" on public.hormone_observations for select to authenticated using (public._can_read_athlete(athlete_id));
drop policy if exists "athlete_system_nodes_select_scoped" on public.athlete_system_nodes;
create policy "athlete_system_nodes_select_scoped" on public.athlete_system_nodes for select to authenticated using (public._can_read_athlete(athlete_id));
drop policy if exists "athlete_system_edges_select_scoped" on public.athlete_system_edges;
create policy "athlete_system_edges_select_scoped" on public.athlete_system_edges for select to authenticated using (public._can_read_athlete(athlete_id));
drop policy if exists "bioenergetics_responses_select_scoped" on public.bioenergetics_responses;
create policy "bioenergetics_responses_select_scoped" on public.bioenergetics_responses for select to authenticated using (public._can_read_athlete(athlete_id));
drop policy if exists "observation_lineage_select_scoped" on public.observation_lineage;
create policy "observation_lineage_select_scoped" on public.observation_lineage for select to authenticated using (public._can_read_athlete(athlete_id));

-- ========= seed baseline dictionaries =========
insert into public.health_marker_dictionary (marker_key, panel_type, label, aliases, unit, area)
values
  ('emoglobina','blood','Emoglobina',array['emoglobina','hemoglobin','hgb','hb'],'g/dL','ematologia'),
  ('rbc','blood','Globuli rossi',array['rbc','eritrociti','globuli rossi','red blood cells'],'10^6/uL','ematologia'),
  ('wbc','blood','Globuli bianchi',array['wbc','leucociti','globuli bianchi','white blood cells'],'10^3/uL','ematologia'),
  ('hct','blood','Ematocrito',array['hct','ematocrito','hematocrit'],'%','ematologia'),
  ('mcv','blood','MCV',array['mcv','volume corpuscolare medio'],'fL','ematologia'),
  ('mch','blood','MCH',array['mch','contenuto emoglobinico medio'],'pg','ematologia'),
  ('mchc','blood','MCHC',array['mchc','concentrazione emoglobinica corpuscolare media'],'g/dL','ematologia'),
  ('plt','blood','Piastrine',array['plt','platelets','piastrine'],'10^3/uL','ematologia'),
  ('rdw','blood','RDW',array['rdw'],'%','ematologia'),
  ('ferritina','blood','Ferritina',array['ferritina','ferritin'],'ng/mL','micronutrienti'),
  ('vit_d','blood','Vitamina D',array['vitamina d','vitamin d','25-oh','25 oh','25-hydroxy','calcidiolo'],'ng/mL','micronutrienti'),
  ('b12','blood','Vitamina B12',array['vitamina b12','vit b12','b12','cobalamin'],'pg/mL','micronutrienti'),
  ('glicemia','blood','Glicemia',array['glicemia','glycemia','glucose','glucosio','fasting glucose'],'mg/dL','metabolico'),
  ('hba1c','blood','HbA1c',array['hba1c','a1c','emoglobina glicata','glycated hemoglobin'],'%','metabolico'),
  ('cortisol_am','hormones','Cortisolo mattutino',array['cortisolo mattutino','cortisol morning','cortisol am','cortisol 8'],'ug/dL','neuroendocrino'),
  ('cortisol_pm','hormones','Cortisolo serale',array['cortisolo serale','cortisol evening','cortisol pm'],'ug/dL','neuroendocrino'),
  ('testosterone','hormones','Testosterone',array['testosterone','testosterone totale','tt'],'ng/dL','neuroendocrino'),
  ('tsh','hormones','TSH',array['tsh','tirotropina','thyrotropin'],'uIU/mL','neuroendocrino'),
  ('t3','hormones','T3',array['t3','ft3','free t3','t3 libera'],'pg/mL','neuroendocrino'),
  ('t4','hormones','T4',array['t4','ft4','free t4','t4 libera'],'ng/dL','neuroendocrino'),
  ('dhea','hormones','DHEA',array['dhea','dehydroepiandrosterone','deidroepiandrosterone'],'ug/dL','neuroendocrino'),
  ('igf1','hormones','IGF-1',array['igf-1','igf1','somatomedina c'],'ng/mL','neuroendocrino'),
  ('crp_mg_l','inflammation','PCR-us',array['pcr-us','pcr us','hs-crp','hscrp','crp','proteina c reattiva'],'mg/L','infiammatorio'),
  ('il6','inflammation','IL-6',array['il-6','il 6','interleukin 6','interleuchina 6'],'pg/mL','infiammatorio'),
  ('tnf_alpha','inflammation','TNF-alpha',array['tnf-alpha','tnf alpha','tnfα','tumor necrosis'],'pg/mL','infiammatorio'),
  ('homocysteine','inflammation','Omocisteina',array['omocisteina','homocysteine','hcy'],'umol/L','infiammatorio'),
  ('oxidized_ldl','inflammation','LDL ossidato',array['ldl ossidat','oxidized ldl','ox-ldl','oxldl'],'U/L','infiammatorio'),
  ('roms_carr','oxidative_stress','d-ROMs',array['d-rom','d rom','roms','diacron'],'Carr U','stress_ossidativo'),
  ('bap_umol','oxidative_stress','BAP',array['bap','potenziale antiossidante'],'umol/L','stress_ossidativo'),
  ('glutathione','oxidative_stress','Glutatione',array['glutatione','glutathione','gsh'],null,'stress_ossidativo'),
  ('sod','oxidative_stress','SOD',array['sod','superoxide dismutase','dismutasi'],null,'stress_ossidativo'),
  ('catalase','oxidative_stress','Catalasi',array['catalasi','catalase','cat'],null,'stress_ossidativo'),
  ('methylation_score','epigenetics','Methylation score',array['metilazione','methylation','dna methylation'],null,'epigenetica'),
  ('biological_age_delta','epigenetics','Delta età biologica',array['età biologica','biological age','epigenetic age'],null,'epigenetica'),
  ('epigenetic_detox','epigenetics','Detox epigenetico',array['detox','detossificazione','xenobiotic'],null,'epigenetica'),
  ('epigenetic_repair','epigenetics','DNA repair',array['riparazione dna','dna repair','repair pathway'],null,'epigenetica'),
  ('epigenetic_oxidative_stress','epigenetics','Stress ossidativo epigenetico',array['stress ossidativo','oxidative stress','ros'],null,'epigenetica')
on conflict (marker_key) do update set
  panel_type = excluded.panel_type,
  label = excluded.label,
  aliases = excluded.aliases,
  unit = excluded.unit,
  area = excluded.area,
  updated_at = now();

insert into public.omics_entity_dictionary (entity_key, entity_type, canonical_symbol, aliases, namespace, taxon_rank, metadata)
values
  ('gene_mthfr','gene','MTHFR',array['MTHFR'],'HGNC',null,'{}'::jsonb),
  ('gene_comt','gene','COMT',array['COMT'],'HGNC',null,'{}'::jsonb),
  ('gene_sod2','gene','SOD2',array['SOD2'],'HGNC',null,'{}'::jsonb),
  ('gene_cat','gene','CAT',array['CAT'],'HGNC',null,'{}'::jsonb),
  ('gene_il6','gene','IL6',array['IL6'],'HGNC',null,'{}'::jsonb),
  ('gene_tnf','gene','TNF',array['TNF'],'HGNC',null,'{}'::jsonb),
  ('taxon_firmicutes','taxon','Firmicutes',array['Firmicutes','Firmicuti'],'NCBI','phylum','{"kind":"bacteria"}'::jsonb),
  ('taxon_bacteroidetes','taxon','Bacteroidetes',array['Bacteroidetes','Batteroideti'],'NCBI','phylum','{"kind":"bacteria"}'::jsonb),
  ('taxon_proteobacteria','taxon','Proteobacteria',array['Proteobacteria','Proteobatteri'],'NCBI','phylum','{"kind":"bacteria"}'::jsonb),
  ('taxon_actinobacteria','taxon','Actinobacteria',array['Actinobacteria','Attinobatteri'],'NCBI','phylum','{"kind":"bacteria"}'::jsonb),
  ('taxon_candida','taxon','Candida',array['Candida','Candida albicans'],'NCBI','fungi','{"kind":"fungi"}'::jsonb)
on conflict (entity_key) do update set
  entity_type = excluded.entity_type,
  canonical_symbol = excluded.canonical_symbol,
  aliases = excluded.aliases,
  namespace = excluded.namespace,
  taxon_rank = excluded.taxon_rank,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.causal_rule_catalog (rule_key, rule_version, domain, description, condition_expr, effect_expr, severity, active)
values
  (
    'vo2max_cho_high_hif1_axis',
    'v1',
    'cross_module',
    'Allenamento VO2max con CHO elevato aumenta drive glicolitico, HIF1 e stress ipossico/acido.',
    '{"training":{"type":"vo2max"},"nutrition":{"cho_intake":"high"}}'::jsonb,
    '{"physiology":{"hif1":"increase","glycolytic_enzyme_stimulus":"increase"},"biochimica":{"acid_load":"increase"}}'::jsonb,
    'moderate',
    true
  ),
  (
    'slow_carb_sulfur_aa_microbiota_risk',
    'v1',
    'cross_module',
    'Recupero con carb a transito lento + alto input amminoacidi solforosi con assetto microbiota sfavorevole incrementa rischio stress metabolico.',
    '{"recovery":{"carb_transit":"slow","sulfur_amino_acid":"high"},"microbiota":{"sulfide_producers":"high"}}'::jsonb,
    '{"bioenergetics":{"metabolic_stress":"increase"},"microbiotica":{"toxic_sulfides":"increase"}}'::jsonb,
    'high',
    true
  )
on conflict (rule_key) do update set
  rule_version = excluded.rule_version,
  domain = excluded.domain,
  description = excluded.description,
  condition_expr = excluded.condition_expr,
  effect_expr = excluded.effect_expr,
  severity = excluded.severity,
  active = excluded.active,
  updated_at = now();
