-- Pro 2 — Seed curato: assi fisiologici ↔ processi fluidi ↔ documenti (evidenza bioenergetica).
-- Idempotente: ON CONFLICT su code / (axis_id, fluid_process_id) / document unique.
-- Eseguire dopo `051_bioenergetic_evidence_axis_fluid_links.sql`.
-- Nota: `manual_curation` = placeholder prodotto; sostituire con PMID reali quando la curazione è completa.

-- ========= Assi (codici stabili) =========
insert into public.bioenergetic_evidence_physiological_axis (id, code, label_it, family, notes_it)
values
  (
    '11111111-1111-4111-8111-111111110001',
    'axis_raas_aldosterone',
    'Asse renina–angiotensina–aldosterone (RAAS)',
    'renal_fluid',
    'Regolazione sodio e volume: effetti su riassorbimento renale e distribuzione dei fluidi (contesto allenamento / calore / Na).'
  ),
  (
    '11111111-1111-4111-8111-111111110002',
    'axis_adh_osmotic',
    'ADH / set osmotico (vasopressina)',
    'endocrine',
    'Osmoregolazione e ritenzione idrica in risposta a stimoli osmotici e di volume effettivo.'
  ),
  (
    '11111111-1111-4111-8111-111111110003',
    'axis_sympathoadrenal',
    'Asse simpato–adrenale (catecolamine)',
    'neuroendocrine',
    'Risposta allo stress acuto: effetti su distribuzione capillare, sudorazione e spostamento plasma–interstizio in esercizio.'
  ),
  (
    '11111111-1111-4111-8111-111111110004',
    'axis_hpa_cortisol',
    'Asse HPA (cortisolo)',
    'neuroendocrine',
    'Modulazione cronotropica e risposta allo stress; interazioni contestuali con sonno, carico e substrati.'
  ),
  (
    '11111111-1111-4111-8111-111111110005',
    'axis_natriuretic_anp_bnp',
    'Peptidi natriuretici (ANP/BNP)',
    'endocrine',
    'Natriuresi e modulazione del carico di fluido extravascolare in contesti di precarico / distensione.'
  ),
  (
    '11111111-1111-4111-8111-111111110006',
    'axis_autonomic_volume',
    'Autonomicità e tono venoso / ritorno venoso',
    'autonomic',
    'Modulazione del ritorno venoso e della distribuzione splancnica–muscolare durante sforzo.'
  )
on conflict (code) do update set
  label_it = excluded.label_it,
  family = excluded.family,
  notes_it = excluded.notes_it,
  updated_at = now();

-- ========= Processi fluidi =========
insert into public.bioenergetic_evidence_fluid_process (id, code, label_it, category, notes_it)
values
  (
    '22222222-2222-4222-8222-222222220001',
    'fluid_plasma_volume_shift',
    'Spostamento / variazione del volume plasmatico effettivo',
    'plasma_volume',
    'Include contrazione/espansione plasmatica legata a sudore, sforzo, calore e shift capillari.'
  ),
  (
    '22222222-2222-4222-8222-222222220002',
    'fluid_ecw_extracellular',
    'Fluido extracellular (ECW) e rapporto ECW/TBW',
    'ecw_shift',
    'Segnale tipicamente informato da BIA multi-frequenza in contesti standardizzati.'
  ),
  (
    '22222222-2222-4222-8222-222222220003',
    'fluid_transcapillary_shift',
    'Filtrazione / shift transcapillare muscolo–interstizio',
    'transcapillary_filtration',
    'Movimento fluidi tra plasma e interstizio durante esercizio e infiammazione acuta di basso grado.'
  ),
  (
    '22222222-2222-4222-8222-222222220004',
    'fluid_sweat_electrolyte',
    'Perdite sudorali (acqua + elettroliti)',
    'sweat_loss',
    'Perdita isotonica/ipotonica variabile con calore e intensità; impatto su Na e volume.'
  ),
  (
    '22222222-2222-4222-8222-222222220005',
    'fluid_gi_absorption',
    'Assorbimento idrico e osmolalità gastrointestinale',
    'gi_water_handling',
    'Timing pasti, osmolalità del contenuto e svuotamento gastrico come modulatori del volume effettivo.'
  )
on conflict (code) do update set
  label_it = excluded.label_it,
  category = excluded.category,
  notes_it = excluded.notes_it,
  updated_at = now();

-- ========= Link assi ↔ fluidi =========
insert into public.bioenergetic_evidence_axis_fluid_link (
  id,
  axis_id,
  fluid_process_id,
  relation_kind,
  strength,
  narrative_it,
  ontology_refs,
  curated_by
)
values
  (
    '33333333-3333-4333-8333-333333330001',
    '11111111-1111-4111-8111-111111110001',
    '22222222-2222-4222-8222-222222220001',
    'modulates',
    'supported',
    'L''aldosterone e il RAAS modulano riassorbimento di Na e acqua: effetto dominante su volume plasmatico e distribuzione dei fluidi in contesto di carico di sodio e idratazione.',
    '[{"system":"MeSH","id":"D006946"},{"system":"MeSH","id":"D012964"}]'::jsonb,
    'pro2_seed_v1'
  ),
  (
    '33333333-3333-4333-8333-333333330002',
    '11111111-1111-4111-8111-111111110001',
    '22222222-2222-4222-8222-222222220002',
    'context_dependent',
    'supported',
    'Con apporto sodico elevato e volemia, il segnale ECW/TBW da BIA può co-muoversi con stati di espansione extracellular documentati in letteratura fisiologica (interpretazione non diagnostica).',
    '[{"system":"MeSH","id":"D005260"}]'::jsonb,
    'pro2_seed_v1'
  ),
  (
    '33333333-3333-4333-8333-333333330003',
    '11111111-1111-4111-8111-111111110002',
    '22222222-2222-4222-8222-222222220005',
    'modulates',
    'strong_consensus',
    'ADH regola riassorbimento idrico renale e risposta osmotica; interazione con contenuto osmotico del pasto e stato di idratazione.',
    '[{"system":"MeSH","id":"D014883"}]'::jsonb,
    'pro2_seed_v1'
  ),
  (
    '33333333-3333-4333-8333-333333330004',
    '11111111-1111-4111-8111-111111110003',
    '22222222-2222-4222-8222-222222220004',
    'promotes',
    'supported',
    'Catecolamine e stimolo simpatico aumentano sudorazione e perdite idro–elettrolitiche in calore e sforzo intenso.',
    '[{"system":"MeSH","id":"D013269"}]'::jsonb,
    'pro2_seed_v1'
  ),
  (
    '33333333-3333-4333-8333-333333330005',
    '11111111-1111-4111-8111-111111110003',
    '22222222-2222-4222-8222-222222220003',
    'context_dependent',
    'hypothesis',
    'In esercizio acuto, pressioni idrostatiche capillari e segnali simpatici possono favorire shift transcapillare; forza dell''associazione dipende da intensità e modalità.',
    '[]'::jsonb,
    'pro2_seed_v1'
  ),
  (
    '33333333-3333-4333-8333-333333330006',
    '11111111-1111-4111-8111-111111110004',
    '22222222-2222-4222-8222-222222220001',
    'context_dependent',
    'supported',
    'Cortisolo cronotropico e risposta allo stress interagiscono con handling del glucosio e, in contesti prolungati, con equilibri fluido–elettrolitici (letteratura mista).',
    '[{"system":"MeSH","id":"D003194"}]'::jsonb,
    'pro2_seed_v1'
  ),
  (
    '33333333-3333-4333-8333-333333330007',
    '11111111-1111-4111-8111-111111110005',
    '22222222-2222-4222-8222-222222220002',
    'inhibits',
    'supported',
    'ANP/BNP favoriscono natriuresi e possono ridurre espansione ECW in risposta a precarico; contesto cardiaco/atletico dipendente.',
    '[{"system":"MeSH","id":"D009320"}]'::jsonb,
    'pro2_seed_v1'
  ),
  (
    '33333333-3333-4333-8333-333333330008',
    '11111111-1111-4111-8111-111111110006',
    '22222222-2222-4222-8222-222222220001',
    'modulates',
    'supported',
    'Il tono autonomico modula capacità venosa e ritorno venoso, influenzando il volume plasmatico effettivo periferico durante sforzo.',
    '[]'::jsonb,
    'pro2_seed_v1'
  )
on conflict (axis_id, fluid_process_id) do update set
  relation_kind = excluded.relation_kind,
  strength = excluded.strength,
  narrative_it = excluded.narrative_it,
  ontology_refs = excluded.ontology_refs,
  curated_by = excluded.curated_by,
  updated_at = now();

-- ========= Documenti collegati (placeholder + esempi letteratura) =========
insert into public.bioenergetic_evidence_axis_fluid_link_document (link_id, source_db, external_id, role, quote_or_figure_ref)
values
  (
    '33333333-3333-4333-8333-333333330001',
    'manual_curation',
    'empathy_pro2_note_raas_volume_2026',
    'primary',
    'Curazione interna Pro 2 — RAAS e volume; sostituire con review PMID quando validata.'
  ),
  (
    '33333333-3333-4333-8333-333333330001',
    'manual_curation',
    'empathy_pro2_note_raas_volume_supporting_2026',
    'supporting',
    'Supporto testuale seed — aggiungere Europe PMC / PubMed dopo revisione.'
  ),
  (
    '33333333-3333-4333-8333-333333330002',
    'manual_curation',
    'empathy_pro2_note_ecw_bia_context_2026',
    'primary',
    'BIA come contesto non diagnostico; accoppiamento a RAAS solo in scenario evidenza prodotto.'
  ),
  (
    '33333333-3333-4333-8333-333333330003',
    'manual_curation',
    'empathy_pro2_note_adh_osmotic_meal_2026',
    'primary',
    'Osmoregolazione e pasti — curazione testuale seed.'
  ),
  (
    '33333333-3333-4333-8333-333333330004',
    'manual_curation',
    'empathy_pro2_note_catecholamine_sweat_2026',
    'primary',
    'Sudorazione e asse simpatico — seed.'
  ),
  (
    '33333333-3333-4333-8333-333333330005',
    'manual_curation',
    'empathy_pro2_note_transcapillary_exercise_2026',
    'primary',
    'Ipotesi contestuale esercizio — evidenza da rafforzare con studi primari.'
  ),
  (
    '33333333-3333-4333-8333-333333330006',
    'manual_curation',
    'empathy_pro2_note_hpa_fluid_glucose_2026',
    'primary',
    'HPA e handling metabolico-fluido — seed narrativo.'
  ),
  (
    '33333333-3333-4333-8333-333333330007',
    'manual_curation',
    'empathy_pro2_note_anp_ecw_2026',
    'primary',
    'ANP/ECW — seed.'
  ),
  (
    '33333333-3333-4333-8333-333333330008',
    'manual_curation',
    'empathy_pro2_note_autonomic_venous_return_2026',
    'primary',
    'Ritorno venoso — seed.'
  )
on conflict (link_id, source_db, external_id, role) do nothing;
