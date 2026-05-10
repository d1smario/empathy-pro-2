# Bioenergetica Pro 2 — Sistema interconnesso: struttura, fonti, letteratura, import, API, evoluzione

**Repo:** `empathy-pro-2-cursor`  
**Status:** specifica architetturale + stato implementazione (maggio 2026).  
**Non è** una chiusura del dominio: descrive **scheletro**, **vincoli** e **direzioni di crescita** per un sottosistema grande quanto il prodotto, senza linee parallele alla pipeline canonica.

**Allineamento costituzionale:** `CONSTITUTION.md`, `docs/ARCHITECTURE.md`, `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md` (piani Ingest → Compute → Interpretation → Application), `.cursor/rules/empathy_generative_core.mdc` (AI ≠ motore per numeri/sessioni), `.cursor/rules/empathy_pro2_no_parallel_lines.mdc` (convogliamento).

**Scaletta prodotto (fasi, task, criteri di uscita):** `docs/BIOENERGETIC_PRODUCT_ROADMAP.md`.

---

## 1. Obiettivo del sottosistema

Costruire **una sola rete** metabolico-endocrina giornaliera (e poi multi-giorno) in cui:

- **Nutrizione** (timing pasti, macro, digiuno percepito, carico insulinico),
- **Training** (pianificato / eseguito, durata, TSS, tracce),
- **Stress / pathway** (kernel giornaliero),
- **Lab e device** (biomarker, export normalizzati, CGM quando presente),

**convergono** su nodi condivisi (es. ghrelina ↔ digiuno ↔ GH; insulina operativa; spostamento glucosio/lattato; asse cortisolo–ACTH).  

Se una **fonte manca**, il sistema deve **dichiarare** che un arco non è osservabile (es. senza diario pasti non si stimula in modo difendibile la leva ghrelina → GH), invece di inventare numeri.

---

## 2. Struttura delle interconnessioni (logica + codice canonico)

### 2.1 Grafo dichiarativo (scheletro v1)

| Artefatto | Ruolo |
|-----------|--------|
| `packages/domain-bioenergetics/src/metabolic-endocrine-interaction-skeleton-v1.ts` | Archi minimi `METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1`, stima gap inter-prandiale, report `buildMetabolicEndocrineInteractionReportV1` con **osservabilità** per nodo (`high` / `partial` / `blocked`). |
| `apps/web/lib/bioenergetics/bioenergetic-day-assembler.ts` | **Unico assembler** GET giornata: memoria → kernel → sim / misura → presentation → evidence layer → **attachment `interactionSkeleton`** alla VM. |
| `apps/web/lib/bioenergetics/day-presentation.ts` | Tile, `chart24h`, striscia **monitoraggio continuo** 24 h, arbitraggio fusione v1 (metadata policy). |
| `packages/domain-bioenergetics/src/curve-fusion-arbitration-v1.ts` | Pesi motore vs “slot AI” e ricchezza contesto; **nessuna** chiamata LLM. |
| `packages/domain-bioenergetics/src/day-simulator-v1.ts` | Sim diurna glucosio/lattato + modulazione pasti/training; ormoni nominali cortisolo/ACTH. |
| `packages/domain-bioenergetics/src/sim-timeline-v1.ts` | Pesi pasto per ora, finestre attività da durata seduta. |
| `packages/domain-bioenergetics/src/evidence-conditioned-synthesizer-v1.ts` | Serie proxy 0–100 da kernel + timeline + **link DB** (assi / fluidi). |
| `apps/web/lib/bioenergetics/load-bioenergetic-evidence-links.ts` | Caricamento link curati da Supabase. |

**Regola:** nuove interazioni (es. leptina ↔ ghrelin ↔ sonno strutturato) si **aggiungono** a questo grafo e ai consumatori già convogliati, non si duplicano assembler o route parallele.

### 2.2 Vista UI (Application)

| Superficie | File |
|------------|------|
| Modulo Bioenergetica | `apps/web/modules/bioenergetics/views/BioenergeticsPageView.tsx` |
| Pathway 24 h + serie memoria | `BioenergeticsPathway24Chart`, `BioenergeticsDaySeriesPanel` |
| Striscia monitoraggio continuo | `BioenergeticsContinuousMonitoringGrid.tsx` |
| Scheda “Rete … scheletro v1” | Stesso `BioenergeticsPageView.tsx` (sezione `interactionSkeleton`) |

---

## 3. Fonti dati (Ingest / memoria giorno)

L’assembler legge **solo** la fetta canonica giornaliera:

| Fonte | Tabella / origine | Uso tipico |
|-------|-------------------|------------|
| Piano / eseguito | `planned_workouts`, `executed_workouts` | Timeline sedute, TSS, `started_at` per ore attività; filtro preferenza provider training (migration `053`) via `queryPlannedExecutedWindow`. |
| Diario | `food_diary_entries` | Pasti, CHO/kcal/insulin_load, **timing** per sim glicemia, proxy insulina, skeleton ghrelina/digiuno. |
| Lab | `biomarker_panels` (`values`) | Tile ormonali/metabolici, hold su curva, arricchimento `internalContextRichness`. |
| Device | `device_sync_exports` | Eventi timeline, filtri preferenza wellness (`053` + filtri in `bioenergetic-day-memory-slice` / pannelli fisiologia). |

Caricamento centralizzato: `apps/web/lib/bioenergetics/bioenergetic-day-memory-slice.ts`.

**Envelope ingest:** ogni nuova sorgente wearable/file deve rispettare `.cursor/rules/empathy_ingest_envelope.mdc` (adapter → eventi normalizzati, `athlete_id`), non logica device dentro il modulo UI bioenergetica.

---

## 4. Letteratura e “perché” (Interpretation, non sostituto Compute)

| Componente | Descrizione |
|--------------|-------------|
| **Link assi ↔ fluidi** | Migrazioni `051_bioenergetic_evidence_axis_fluid_links.sql`, `052_bioenergetic_evidence_axis_fluid_seed.sql` — grafo **curato** (non generato da LLM). |
| **Synthesizer** | `evidence-conditioned-synthesizer-v1.ts` — output auditabile per UI “evidenza condizionata”. |
| **BIA ↔ letteratura** | `bia-literature-model-v1.ts` + contesto da `build-bioenergetic-conditioning-context` — prior deterministiche, disclaimer in VM. |

**Principio:** la letteratura in Empathy **modula e spiega** dove il modello è ancorato; **non** rimpiazza misure dense (es. CGM) né inventa serie cliniche senza contratto.

---

## 5. Import dati utili (cosa arricchisce la rete)

Ordine di valore per **interconnessione** (indicativo):

1. **Diario con orari e macro** — sblocca timing insulinico, peso post-prandiale glicemia sim, gap digiuno ↔ ghrelina (osservabilità in skeleton).
2. **Sedute con `started_at` + durata** — finestre glucosio/lattato e coerenza training↔nutrizione.
3. **Panel lab** (ormoni, metaboliti) — tile misurati / hold curve, ricchezza contesto.
4. **Export device** (sonno, recovery, CGM) — timeline + policy “misura vince” dove definito; preferenze fonte `053` per evitare mix incoerente.
5. **Sonno strutturato** (fasi) — prerequisito futuro esplicito per arco GH / pulsatile (oggi segnalato come evoluzione in skeleton, non curva finta).

---

## 6. Letture utili nel repo Empathy (per chi estende il sistema)

| Argomento | Documento / percorso |
|-----------|----------------------|
| Rete dati generativa | `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md` |
| Hub trasparenza / loop VIRYA (se toccato) | `docs/EMPATHY_PRO2_BIOENERGETIC_TRANSPARENCY_HUB_AND_VIRYA_LOOP.md` |
| Modulazione training ↔ bioenergetica | `apps/web/lib/training/bioenergetic-modulation.ts`, `virya-context` route |
| Contratti VM giornata | `apps/web/api/bioenergetics/contracts.ts` (`BioenergeticsDayViewModel`, `interactionSkeleton`, `evidenceConditionedLayer`) |
| Regole no linee parallele | `.cursor/rules/empathy_pro2_no_parallel_lines.mdc` |

---

## 7. API e contratti (oggi + monitoring continuo futuro)

### 7.1 Oggi

| Endpoint / uso | File | Output rilevante |
|----------------|------|-------------------|
| `GET` bioenergetics day | `apps/web/app/api/bioenergetics/day/route.ts` | JSON da `assembleBioenergeticDay`: **`dayContractVersion`**, **`canonicalStreamCounts`** (campioni tabella 055 in slice), `timeline`, `channels`, `kernel`, `chart24h`, `continuousMonitoring`, `series`, `evidenceConditionedLayer`, `biaLiteratureSummary`, **`interactionSkeleton`**. |

Il client (`BioenergeticsPageView`) consuma questo payload; **non** duplicare la composizione lato browser.

### 7.2 Evoluzione monitoring continuo (linee guida API)

Obiettivo: **stesso contratto** `BioenergeticMonitoringChannel24` (`hourly` 0–23, `dataPlane`, `curveResolution`), con:

- `measured_stream` — serie ad alta frequenza (CGM, futuri ormoni seriati) **dopo** ingest + validazione schema;
- `sparse_lab_hold` — punti radi referto;
- `model_continuous` — motore + eventuale merge controllato con “proposta AI” quando esista endpoint e schema versionati.

**Estensioni API (direzioni, non obbligo immediato):**

- `GET /api/bioenergetics/day` — resta il **aggregatore**; versioning nel body (`dayContractVersion`); parametri query aggiuntivi (`?include=…`) solo se strettamente necessari e backward-compatible.
- Eventuale `GET /api/bioenergetics/streams?athleteId=&from=&to=&channel=` — **thin**, legge storage time-series canonico, **non** seconda pipeline di decodifica ingest.
- Webhook / job ingest — restano negli adapter ingest; la bioenergetica **legge** proiezioni già normalizzate.

Tutte le nuove route devono **chiamare** librerie condivise (`bioenergetic-day-assembler` / `health-document-pipeline` pattern) invece di reimplementare query.

---

## 8. Ragionamenti base (v1)

1. **Reality > plan:** curve operative preferiscono misura densa e referto; il modello riempie solo dove manca memoria.
2. **Osservabilità esplicita:** se manca il diario (o macro), il ramo ghrelina/GH è `blocked` o `partial` — messaggio in `interactionSkeleton`, non valore finto.
3. **Stress / pathway:** kernel giornaliero modula diurna cortisolo–ACTH **come modello**, non campionamento seriato finché non c’è dato.
4. **Fusione v1:** pesi motore vs slot AI sono **policy** e metadata; merge numerico AI sulla curva solo con contratto e endpoint validati (cfr. commenti in `curve-fusion-arbitration-v1.ts` e disclaimer VM).

---

## 9. Evoluzioni (roadmap tecnica, senza fork)

| Fase | Cosa |
|------|------|
| **v1.x** | Arricchire skeleton con sonno strutturato, leptina operativa da bilancio energetico, vincoli IGF-1/GH da lab; modulare tile/sim in funzione di `observability`. |
| **v2** | Serie orarie aggiuntive sotto `continuousMonitoring` solo con `dataPlane` + motore definito; CGM/ormoni da stream in `measured_stream`. |
| **Merge AI** | Seconda serie validata + blend pesato; governance già in `BioenergeticChannelCurveResolutionV1`. |
| **Multi-giorno** | Stesso grafo su finestre; attenzione a non duplicare `assembleBioenergeticDay` — eventualmente `assembleBioenergeticWindow` che riusa slice + skeleton. |

---

## 10. Changelog documento

| Data | Nota |
|------|------|
| 2026-05-09 | Creazione: struttura interconnessioni, fonti, letteratura, import, API, evoluzioni; riferimento a skeleton v1 e assembler canonico. |
| 2026-05-09 | Link a roadmap prodotto `BIOENERGETIC_PRODUCT_ROADMAP.md`. |
