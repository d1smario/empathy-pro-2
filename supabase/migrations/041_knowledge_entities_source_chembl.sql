-- Estende `knowledge_entities.source_db` per connettore ChEMBL (composti / modulatori).

alter table public.knowledge_entities drop constraint if exists knowledge_entities_source_db_check;

alter table public.knowledge_entities
  add constraint knowledge_entities_source_db_check check (
    source_db in (
      'pubmed',
      'europe_pmc',
      'reactome',
      'uniprot',
      'kegg',
      'hmdb',
      'chebi',
      'mgnify',
      'encode',
      'ensembl',
      'ncbi_gene',
      'gene_ontology',
      'metacyc',
      'manual_curation',
      'chembl'
    )
  );

comment on constraint knowledge_entities_source_db_check on public.knowledge_entities is
  'Fonti esterne entità knowledge; chembl = ChEMBL molecule (API EBI).';
