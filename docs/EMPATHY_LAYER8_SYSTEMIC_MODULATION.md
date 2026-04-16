# Livello 8 — modulazione sistemica (contratto Pro 2)

**Scopo:** definire come integrare neuroendocrino, microbiota, epigenetica e rollup omici **senza** rami paralleli di memoria o un secondo twin. Il livello arricchisce la **stessa** rete già descritta in `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md` e nella pipeline multiscala (`docs/EMPATHY_MULTISCALE_BIOLOGICAL_ENGINE.md`).

**Non è:** un generatore di sessioni, un solver nutrizionale, né una fonte canonica di numeri per il digital twin sostitutiva ai motori esistenti.

**È:** un piano di **deposito strutturato** (snapshot versionabile + traccia) che alimenta `resolveAthleteMemory`, `knowledge_evidence_hits`, pannelli health dove applicabile, e infine i **modulatori** letti dal pipeline deterministico — sempre con `Reality > Plan` e `Physiology > UI`.

---

## 1. Posizione nei quattro piani

| Piano | Ruolo L8 |
|-------|-----------|
| Ingest | PDF/lab/omic/questionari → normalizzazione server-side; nessun LLM come fonte di verità numerica. |
| Compute | Motori + twin restano canonic; L8 fornisce solo **coefficienti / flag / finestre temporali** già validati o da validare. |
| Interpretation | Confronto multi-sorgente, staging (`apps/web/lib/memory/interpretation-staging-contract.ts`), commit esplicito verso evidence o snapshot. |
| Application | UI e copy che riflettono modulazione; nessun redirect globale; fallback locale se dati mancanti. |

---

## 2. Allineamento a strutture esistenti

1. **Memoria atleta:** `resolveAthleteMemory` (`apps/web/lib/memory/athlete-memory-resolver.ts`) resta l’aggregatore. L8 aggiunge una sorgente tabellare (`systemic_modulation_snapshots`, migration `011_*`) da leggere in una fase successiva quando il contratto payload sarà stabile.
2. **Health:** `biomarker_panels` e partizioni `health.*` in `AthleteMemory` restano il veicolo per marker clinici strutturati; gli snapshot L8 sono **meta-modulazione** (assi presenti, versione algoritmo, riferimenti a righe panel/evidence), non duplicano colonne twin.
3. **Knowledge:** `knowledge.activeModulations` e trace PubMed / meccanismi restano narrativa e binding; L8 può proporre tag verso trace solo dopo commit da staging.
4. **Generativo:** una sola pipeline builder/solver; AI = interpretazione + struttura proposta, mai sostituto del builder (`empathy_generative_core` nel workspace Cursor condiviso).

---

## 3. Schema logico del payload (JSONB)

Il campo `payload` in DB è **contratto evolutivo**; la v0 raccomanda chiavi opzionali auditabili:

- `schemaVersion`: stringa (es. `"l8.snapshot.v0"`).
- `axes`: ripetizione coerente con colonna `axes` (neuroendocrine, microbiota, epigenetic, omics_rollup, …).
- `modulators`: elenco di oggetti `{ id, label, direction?, confidence?, sourceRefs[] }` senza valori clinici inventati.
- `linkedEvidenceIds` / `linkedPanelIds`: UUID opachi verso `knowledge_evidence_hits` / `biomarker_panels` se presenti.
- `solverHints`: solo chiavi consumate da motori già previsti (es. priorità narrative, non kcal pasto).

Ogni chiave non riconosciuta dal consumer deve essere ignorata (forward compatibility).

---

## 4. Persistenza: `systemic_modulation_snapshots`

- Una riga = uno snapshot immutabile (append-only lato prodotto; update solo per correzioni amministrative se policy lo consente).
- `algorithm_version` vincola riproducibilità audit.
- `source` discrimina provenienza (lab, questionario, coach, import batch).

Dettaglio DDL: `supabase/migrations/011_systemic_modulation_snapshots.sql`.  
Strisce SQL per paste manuale (Supabase SQL Editor): `supabase/PASTE_SYSTEMIC_MODULATION_SNAPSHOTS.sql`.

---

## 5. Sicurezza e tenancy

RLS allineata allo stesso modello **private athlete / coach** di `biomarker_panels` (V1 migration `006_secure_biomarker_panels_rls.sql`), così il DB condiviso tra V1 e Pro 2 non introduce eccezioni di visibilità.

---

## 6. Roadmap implementazione (senza fork concettuali)

1. **Fatto:** contratto questo documento + tabella + RLS.
2. **Next:** estendere `resolveAthleteMemory` con select limitata sugli ultimi N snapshot e mappatura verso `AthleteMemory` (campo dedicato sotto `health` o `knowledge`, da definire nello schema TypeScript condiviso).
3. **Next:** API di commit da staging interpretation → insert snapshot + optional `knowledge_evidence_hits`.

---

## 7. Riferimenti

- `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md`
- `docs/EMPATHY_MULTISCALE_BIOLOGICAL_ENGINE.md`
- `docs/PRO2_APPLICATION_READ_SPINE_AND_INTERPRETATION_STAGING.md`
- `apps/web/lib/memory/interpretation-staging-contract.ts`

**Fine.**
