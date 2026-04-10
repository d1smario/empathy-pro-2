# EMPATHY — Multiscale biological engine (blueprint)

**Status:** architectural intent and interrogation logic for V1 / Pro 2 alignment.  
**Does not replace:** deterministic physiology, bioenergetics, twin math, builder, or meal assemblers.  
**Relates to:** knowledge library architecture (V1 `docs/KNOWLEDGE_LIBRARY_ARCHITECTURE.md`), pathway modulation (`lib/nutrition/pathway-modulation-model.ts` in V1), nutrition contracts (`NutritionPathwaySystemLevel`).

**Pro 2 implementation (this repo):** `@empathy/domain-knowledge` — `packages/domain-knowledge/src/multiscale/` (`ontology-data`, `graph`, `bindings`, `bottleneck`).

---

## 1. Constraint (constitutional)

Projection order for **canonical numbers** (loads, kcal, twin state, session structure):

`reality → compute (engines + twin) → interpretation (knowledge / evidence / traces) → application (UI, nutrition assembly, messaging)`.

This document defines **vertical biological framing** and **interrogation order** for interpretation and knowledge binding. It must not introduce a second numerical twin or a parallel session generator.

---

## 2. Biological scales (bottom → top)

Ordered scales the platform should be able to **reference** in mechanisms, tags, and traces (not all are instrumented in V1 today):

1. Genome / epigenome  
2. Transcriptome (gene expression)  
3. Proteome (enzymes, receptors)  
4. Metabolome (reactions, flux context)  
5. Cell signalling  
6. Tissue response  
7. Systems (endocrine, nervous, immune)  
8. Whole-body physiology  

EMPATHY should support **vertical linking**: same stimulus (e.g. training load) traceable from whole-body metrics down to tagged mechanisms (and up from literature/assertions).

---

## 3. Genetic / regulatory layer (ontology, not diagnosis)

**Use:** cluster labels and knowledge-graph nodes for bindings, research plans, and pathway context. Clinical genotyping is out of scope unless explicitly supplied as athlete data with provenance.

Example **functional clusters** (illustrative gene/regulator symbols for tagging):

| Cluster | Examples (symbols) | Notes |
|--------|---------------------|--------|
| Energetics / mitochondria | PPARGC1A (PGC-1α), PRKAA1/2 (AMPK), SIRT1/SIRT3, NRF1/NRF2 | Biogenesis, energy sensing, redox response |
| Hypoxia / O₂ / endurance adaptation | HIF1A, VEGF, EPO | Hypoxia programme, angiogenesis, erythropoiesis |
| Neuro / central fatigue (context) | BDNF, COMT, DRD2 | Plasticity, dopamine handling (coarse tags only in product) |
| HPA–pituitary axes | CRH → ACTH → cortisol; TRH → TSH → thyroid; GnRH → LH/FSH; GH → IGF-1 | Cascade tags for modulation and timing narratives |
| Immune / inflammatory | NFKB1 pathway, IL6, TNF, PTGS2 (COX-2) | Inflammation load and recovery context |
| Nutrient handling / anabolism | SLC2A4 (GLUT4), CPT1, mTOR pathway | Substrate use and protein synthesis context |

Epigenetic context (when data exists): tag as **modulator of expression** in knowledge layer, not as a direct overwrite of engine outputs.

---

## 4. Enzymatic layer (reaction velocity)

**Role:** link micronutrients and training context to **rate-limiting** or high-leverage steps (education + knowledge queries), e.g.:

- Carbohydrate branch: hexokinase, PFK, pyruvate dehydrogenase  
- Lipid oxidation: CPT1, HSL (lipolysis context)  
- Mitochondrial: citrate synthase, cytochrome c oxidase (oxidative capacity context)  

**Modulators** (for nutrition / health interpretation): B-complex, Mg, Fe, Zn; hormonal milieu. These feed **cofactor lists** in pathway items and functional food bridges, not ad hoc LLM numbers.

---

## 5. Cell signalling layer (decision core, qualitative)

Represent as **paired axes** for mechanism tags and traces:

- AMPK ↔ mTOR  
- SIRT1 ↔ mTOR  
- HIF ↔ O₂ availability  
- NRF2 ↔ ROS / redox  

Downstream modules consume **snapshots** (e.g. modulation, pathway support), not continuous ODE simulation in V1.

---

## 6. Endocrine layer (cascades, not single hormones)

Tag and narrate **axes**, not isolated hormone labels:

- **HPA:** stress → CRH → ACTH → cortisol → gluconeogenesis / recovery / immune modulation (qualitative)  
- **Anabolic:** GH → IGF-1 → mTOR signalling context  
- **Insulin / glucagon:** meal timing vs AMPK–mTOR balance  
- **Thyroid:** T3 as global metabolic rate context (when data or proxy exists)  

---

## 7. Microbiota layer (function-first)

Beyond taxonomy: **functions** tied to interpretation:

- SCFA → host signalling (e.g. AMPK-related narratives where evidence-linked)  
- Butyrate → epithelial / mitochondrial support (evidence-scoped)  
- LPS / barrier → inflammatory tone  
- Vitamin synthesis (B, K) → cofactor availability context  

Must align with existing health panels and `microbiota` in athlete memory when present.

---

## 8. Neurophysiological layer

Tags for **central** fatigue and autonomic context (when measured or inferred conservatively):

- CNS fatigue vs peripheral  
- Serotonin / dopamine balance (high-level, non-clinical diagnosis)  
- Motor drive  
- HRV / autonomic tone (when in data model)  

Training interpretation uses these as **modulation hints**, not replacement for internal load from sessions.

---

## 9. Metabolic hierarchy (priority rule — “gold”)

**Causal priority for narrative and adaptation hints** (interpretation layer):

`Energy availability (ATP / substrate / AMPK context) → Cellular control (mTOR, SIRT, HIF, NRF2) → Gene expression programmes → Endocrine milieu → Microbiota / nutrient absorption & cofactors → CNS / stress / motivation → Observable output (performance, recovery, compliance)`

Do **not** invert (e.g. “fix output first” without energy/signal context in copy and knowledge design).

Collapsed levels for product communication:

| Level | Focus |
|-------|--------|
| L1 | Energetics master: ATP/substrates/AMPK |
| L2 | Cellular control: mTOR, SIRT1, HIF, NRF2 |
| L3 | Gene expression programmes (tags) |
| L4 | Endocrine cascades |
| L5 | Microbiota + nutrients + cofactors |
| L6 | Nervous system / central fatigue / stress |

---

## 10. Multilevel interrogation pipeline (operational)

Sequence for **expansion traces**, research plans, and future orchestration (Interpretation + feedback into memory):

1. **Training / stimulus** — measured or planned load → metabolic signature (from engines, not from text).  
2. **Pathway activation** — which support pathways are relevant (template + bindings).  
3. **Gene / programme layer** — which expression programmes are implicated (tags, corpus links).  
4. **Enzyme / flux support** — cofactors and limiting steps (literature + nutrition bridge).  
5. **Endocrine milieu** — favourable or constrained (context from recovery, diaries, panels if any).  
6. **Microbiota / absorption** — barrier and fermentation context.  
7. **Neuro / autonomic** — central fatigue and stress axis (conservative).  
8. **Feedback** — reality vs expected (executed sessions, biomarkers, diary) → update traces and bindings, **re-run compute** where scheduled.

Steps 1–2 are largely **deterministic** today; 3–8 are **partially** implemented via knowledge traces, corpus search, and pathway modulation text — full automation and scoring are **not** yet product-complete.

---

## 11. Mapping to this repo (Pro 2) vs V1

| Area | Pro 2 (this repo) | V1 (`nextjs-empathy-pro`) |
|------|-------------------|---------------------------|
| Versioned ontology seed (nodes + edges) | `packages/domain-knowledge/src/multiscale/ontology-data.ts` | Same spec in `docs/EMPATHY_MULTISCALE_BIOLOGICAL_ENGINE.md`; no import from Pro 2 |
| Graph helpers (subgraph, adjacency) | `multiscale/graph.ts` | — |
| Proxy → activated nodes | `deriveMultiscaleActivatedNodes` in `multiscale/bindings.ts` | Pathway copy still from `pathway-modulation-model.ts` |
| L1–L6 bottleneck view (interpretation only) | `computeMetabolicBottleneckView` in `multiscale/bottleneck.ts` | Not wired |
| DB-backed ontology / full automation | Future migrations + curated data per `empathy_schema_whole_picture` | Same |

---

## 12. Implementation slices (§12) — status

1. **Ontology module:** **Done (seed).** Types in `multiscale/types.ts`; nodes and `MULTISCALE_ONTOLOGY_VERSION` in `ontology-data.ts`. Extend later via DB aligned with migrations.  
2. **Knowledge graph edges:** **Done (seed).** `ONTOLOGY_EDGES` with `MultiscaleEdgePredicate` and `MultiscaleEvidenceLevel`.  
3. **Binding rules:** **Done (deterministic v1).** `deriveMultiscaleActivatedNodes(MultiscaleSignalSnapshot)` — thresholds aligned with V1 pathway-modulation spirit; audit via sorted `activatedNodeIds`.  
4. **Adaptive priority / bottleneck:** **Done (interpretation v1).** `computeMetabolicBottleneckView`; `metabolicLevelLabelIt` for UI copy. Does not mutate twin state.  
5. **UI / API:** **Done (v1).** `GET /api/knowledge/multiscale-bottleneck?athleteId=…` (`includeSubgraph=1` opzionale); pannello in Physiology (`MultiscaleBottleneckPanelPro2`) che legge twin + `resolveCanonicalPhysiologyState` via `buildMultiscaleSignalSnapshotFromAthlete`.

Public exports: `import { … } from "@empathy/domain-knowledge"` (re-export from `src/index.ts`).

---

## 13. Product name (internal)

This blueprint corresponds to positioning as an **adaptive biological simulation framing** around the **human digital twin**: simulation here means **structured multi-scale interpretation + feedback**, not claiming full *in silico* whole-organism dynamics in V1.

**End.**
