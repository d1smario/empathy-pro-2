# Registry — fonti esterne knowledge (Pro 2)

Mappa **deterministica**: connettori HTTP/API → `KnowledgeDocumentRef` / trace hop (`sourceDbs`).  
**LLM**: solo interpretazione su evidenza già recuperata e tracciata (canone EMPATHY).

**Integrazione trace / corpus:** `resolveKnowledgeTraceHopLinks` arricchisce gli hop con `pubmed` / `europe_pmc` usando `knowledge-trace-live-literature.ts` (upsert in `knowledge_documents` se il corpus locale è insufficiente). `resolveKnowledgeCorpusQuery` tenta un backfill PubMed+Europe PMC se la ricerca locale ha meno di 2 hit.

## Stato legenda

| Stato | Significato |
|-------|-------------|
| **live** | Client + route API (o store) nel repo |
| **planned** | Previsto in `research-planner` / schema, connettore non ancora implementato |

## Registry (sintesi)

| `sourceDb` (schema) | Dominio | Stato | Note operative |
|---------------------|---------|-------|------------------|
| `pubmed` | Letteratura biomedicale | **live** | `GET /api/knowledge/pubmed`; `pubmed-client`; `ingestPubmedKnowledgeCorpus` / `ingestKnowledgeCorpus({ source: "pubmed", … })` |
| `europe_pmc` | Letteratura + OA PMC | **live** | `GET /api/knowledge/europepmc`; `europepmc-client`; import corpus: `ingestEuropepmcKnowledgeCorpus` / `ingestKnowledgeCorpus({ source: "europe_pmc", … })` |
| `reactome` | Pathway | **live** | `GET /api/knowledge/reactome/search`; [ContentService](https://reactome.org/documentation/developer-api); `reactome-client` |
| `uniprot` | Proteine (ricerca KB) | **live** | `GET /api/knowledge/uniprot/search`; `uniprot-client` (query default umano 9606); [API UniProt](https://www.uniprot.org/help/api) |
| `ncbi_gene` | Geni (NCBI Gene) | **live** | `GET /api/knowledge/ncbi-gene/search`; E-utilities `esearch`+`esummary`; opz. `NCBI_API_KEY` |
| `gene_ontology` | Termini GO (BP/MF/CC) | **live** | `GET /api/knowledge/gene-ontology/search`; [QuickGO REST](https://www.ebi.ac.uk/QuickGO/api/index.html); opz. `QUICKGO_USER_AGENT` |
| `ensembl` | Geni (GRCh38) | **live** | `GET /api/knowledge/ensembl/search`; [Ensembl REST](https://rest.ensembl.org/); opz. `ENSEMBL_USER_AGENT` |
| `encode` | Epigenomica / regolazione | planned | |
| `kegg` | Pathway (licenza commerciale) | planned | Valutare alternativa Reactome + Metacyc |
| `metacyc` | Metabolismo curato | planned | |
| `rhea` | Reazioni biochimiche curate | **live** | `GET /api/knowledge/rhea/search`; [Rhea REST](https://www.rhea-db.org/help/rest-api); migration **042**; opz. `RHEA_USER_AGENT` |
| `hmdb` | Metaboliti / lipidi (HMDB) | planned | Accesso web spesso **bot shield** (Cloudflare); integrazione diretta richiede mirror/accordo o client certificato; intanto usare **ChEBI** / letteratura. |
| `chebi` | Entità chimiche (ChEBI) | **live** | `GET /api/knowledge/chebi/search` via [OLS API](https://www.ebi.ac.uk/ols/docs/api); opz. `OLS_USER_AGENT` |
| `chembl` | Composti / bioattività | **live** | `GET /api/knowledge/chembl/molecules/search`; [ChEMBL API](https://www.ebi.ac.uk/chembl/api/data/docs); migration **041** su `knowledge_entities.source_db` |
| `mgnify` | Microbioma analitico | planned | |
| `manual_curation` | Curatela interna | planned | |

## Fasi roadmap (allineamento omica / metabolica / neuroasse)

1. **Letteratura**: PubMed + Europe PMC (`/api/knowledge/pubmed`, `/api/knowledge/europepmc`; **`POST /api/knowledge/corpus/import`** con body `{ source, q, maxItems? }` → `knowledge_documents`).
2. **Identità gene/proteina**: UniProt + **NCBI Gene** + **Ensembl** search **live**.
3. **Pathway / biochimica**: Reactome + GO + ChEBI + **Rhea** search **live**; HMDB (nota bot shield) / Metacyc; lipidi LipidMaps → planned.
4. **Microbiota**: MGnIFY + tassonomia NCBI.
5. **Epigenetica**: ENCODE / database di picchi (scope per atleta vs reference).
6. **Modulatori chimici**: **ChEMBL** ricerca molecole **live**; target/activity API e PubChem → planned; assertion trace.
7. **Neuroendocrino**: pathway + letteratura; ontologie e assi curati (non un singolo endpoint “completo”).

## Env opzionali

| Variabile | Uso |
|-----------|-----|
| `NCBI_API_KEY` | Rate limit [NCBI E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25497/) (PubMed + **NCBI Gene**) |
| `EUROPEPMC_USER_AGENT` | Identificativo app per richieste EBI (consigliato in produzione) |
| `UNIPROT_USER_AGENT` | Identificativo per [UniProt REST](https://www.uniprot.org/help/api) (consigliato) |
| `REACTOME_USER_AGENT` | Identificativo client verso [Reactome](https://reactome.org/) (consigliato) |
| `CHEMBL_USER_AGENT` | Identificativo verso [ChEMBL](https://www.ebi.ac.uk/chembl/) (consigliato) |
| `QUICKGO_USER_AGENT` | Identificativo verso [QuickGO](https://www.ebi.ac.uk/QuickGO/) (consigliato) |
| `OLS_USER_AGENT` | Identificativo verso [OLS](https://www.ebi.ac.uk/ols/index) / ChEBI search (consigliato) |
| `RHEA_USER_AGENT` | Identificativo verso [Rhea](https://www.rhea-db.org/) (consigliato) |
| `ENSEMBL_USER_AGENT` | Identificativo verso [Ensembl REST](https://rest.ensembl.org/documentation/info/public_rate_limit) (consigliato) |
