# Bioenergetica Pro 2 — Scaletta prodotto (crescita controllata)

**Riferimento architettura:** `docs/BIOENERGETIC_INTERCONNECTED_SYSTEM_SPEC.md`  
**Principio:** un solo assembler (`assembleBioenergeticDay`), un grafo dichiarato che cresce, niente pipeline parallele (`.cursor/rules/empathy_pro2_no_parallel_lines.mdc`).

**Posizione attuale (maggio 2026):** fase **0** in gran parte completata; si entra in **1.x** con lavoro incrementale verificabile a ogni merge.

---

## Legenda

| Simbolo | Significato |
|---------|-------------|
| ✅ | Fatto / in repo |
| 🔲 | Prossimo blocco consigliato |
| ⏳ | Dipende da blocco precedente |
| 🎯 | Criterio di uscita (definition of done) |

---

## Fase 0 — Fondamenta (completata o quasi)

| # | Voce | Stato | Note |
|---|------|--------|------|
| 0.1 | Memoria giorno unica (`bioenergetic-day-memory-slice`) | ✅ | Piano, eseguito, diario, lab, export |
| 0.2 | Assembler unico + VM (`bioenergetic-day-assembler`, `GET …/bioenergetics/day`) | ✅ | |
| 0.3 | Sim diurna gluc/lac + timeline pasti/training reali | ✅ | `sim-timeline-v1`, `day-simulator-v1` |
| 0.4 | Striscia 24 h + fusion metadata v1 + UI tempo/tooltip | ✅ | `BioenergeticsContinuousMonitoringGrid` |
| 0.5 | Evidence letteratura assi–fluidi (051/052 + synthesizer) | ✅ | Opzionale se DB popolato |
| 0.6 | Skeleton interconnessioni + UI sezione rete | ✅ | `metabolic-endocrine-interaction-skeleton-v1` |
| 0.7 | Spec sistema interconnesso | ✅ | `BIOENERGETIC_INTERCONNECTED_SYSTEM_SPEC.md` |

🎯 **Uscita fase 0:** giornata bioenergetica leggibile end-to-end con buchi dati dichiarati.

---

## Fase 1 — “Il grafo guida i numeri” (prossime 2–4 iterazioni)

Obiettivo: **non solo testi** in `interactionSkeleton`, ma **modulazione coerente** di output già esistenti (tile / sim / disclaimer) in funzione di `observability` e degli archi.

| # | Voce | Stato | File / area principale |
|---|------|--------|-------------------------|
| 1.1 | Mappare ogni nodo skeleton → tile id / canale continuo esistente | ✅ | `bioenergetic-skeleton-tile-bridge.ts` + tile `id` noti |
| 1.2 | Se `blocked` su ghrelina: tile ghrelina → provenance `absent` + copy “richiede diario”; non usare `mergeLabSim` finto | ✅ | `mergeLabSimRespectingSkeleton` ghrelina + GH |
| 1.3 | Se `partial`: scalar `simulatedLabNumeric` o range hint (coefficienti in `day-simulator-v1`) | ✅ | `SIM_LAB_TILE_PARTIAL_SCALE_V1` + tile ghrelina/GH/insulin_lab |
| 1.4 | Agganciare **sonno** (ore/stage da memoria giorno se disponibile) come input `sleep_context` nel report skeleton | ✅ | `MetabolicSleepContextSnapshotV1` + `metabolicSleepContextFromConditioningContext` (stesso `sleepAutonomic` del conditioning, nessuna query duplicata). |
| 1.5 | Estendere `METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1` con nodo `sleep` → `gh_pulse` (solo arco + rationale) | ✅ | Arco in `METABOLIC_ENDOCRINE_INTERACTION_EDGES_V1` + nodo `sleep` in `nodes`; `assessGh` usa `sleepContext`. |
| 1.6 | Test contratto: snapshot `blocked`/`partial`/`high` → tile attese | ✅ | `day-presentation.test.ts`, `day-simulator-v1.test.ts` |

🎯 **Uscita fase 1:** **ghrelina + GH + insulina** e **contesto sonno** (nodo + `sleepContext` da conditioning) reagiscono al skeleton (provenance e numeri coerenti; niente sim «pieno» quando `blocked`; `partial` attenuata).

---

## Fase 2 — Profondità fisiologica (dopo fase 1)

| # | Voce | Stato | Note |
|---|------|--------|------|
| 2.1 | **Leptina / energia** come nodo accoppiato a CHO giornaliero + adiposità proxy (kernel) | ✅ | Nodo `leptin_energy_balance` + snapshot `choIntakeGramsDay` / `insulinDemandScore01`; tile `leptin` gated come ghrelina. |
| 2.2 | **Cortisolo/ACTH** modulati leggermente da pasti grandi e da picco ACTH anticipato (già forma distinta) | ✅ | `SIM_CORTISOL_MEAL_MOD_V1` + `NominalCortisolActhModulationV1` su `buildNominalCortisolActhHourly24`; timeline → `day-presentation`. |
| 2.3 | **IGF-1 ↔ GH** quando lab presente: rafforzare `observability` GH e testo rationale | ✅ | `somatoaxisLab` + arco `igf1_lab`→`gh_pulse`; `applySomatoaxisLabToGhNode`. |
| 2.4 | Serie **evidence_conditioned** collegate in UI a nodi skeleton (link visivo “questo arco ha evidenza DB”) | ✅ | `bioenergetic-evidence-skeleton-bridge.ts` + badge «DB» in `BioenergeticsPageView`; anchor ↔ sezione evidenza. |

🎯 **Uscita fase 2:** assi leptina/energia, cortisolo–ACTH modulato, lab somatoasse, evidenza DB collegata in UI al grafo skeleton (v1).

---

## Fase 3 — Monitoring continuo “vero” (dopo stabilità ingest)

| # | Voce | Note |
|---|------|------|
| 3.1 | Contratto storage time-series per CGM / futuri campioni ormonali | ✅ Migration `055` + contracts; scrittura campioni convogliata in `persistRealityDeviceExport` (`athlete-time-series-from-device-export.ts`); **no** route ingest duplicata |
| 3.2 | `measured_stream` popolato da lettura canonica sugli stessi `athlete_id` / giorno | ✅ `loadBioenergeticDayMemorySlice` + `extractMeasuredGluLacFromSlice` (merge + priorita su export) |
| 3.3 | Versioning / audit risposta `GET …/day` senza moltiplicare query string | ✅ `dayContractVersion` + `canonicalStreamCounts` nel body (`BioenergeticsDayViewModel`); nessun query param nuovo obbligatorio |
| 3.4 | Merge numerico AI (seconda curva) **solo** con endpoint + schema + governance esistente | ✅ `POST /api/bioenergetics/merge-hourly-curve` + `parseBioenergeticAiCurveProposalV1` + `mergeHourlyBioenergeticCurvesV1` (governance da `assembleBioenergeticDay`) |

🎯 **Uscita fase 3:** stack end-to-end (DDL 055 + ingest convogliato + lettura/merge + VM + merge AI opzionale) pronto; stream denso **in produzione** quando gli adapter inviano export `cgm` (o campioni diretti futuri) — governance `measurement_wins` già attiva su stream denso.

---

## Fase 4 — Orizzonte (non iniziare prima di 1–3)

- Finestra **multi-giorno** (`assembleBioenergeticWindow` + `GET …/bioenergetics/window`) — ✅ slice parallele + **una** query evidenza assi↔fluidi; VM giorno = stesso builder `buildBioenergeticDayViewModelFromSlice`.
- Coaching / export PDF del grafo giornaliero.
- Integrazione esplicita **Nutrition module** ↔ skeleton (stesso `athleteId`, stessa data).

---

## Ordine di lavoro consigliato (prossima sessione implementazione)

1. ~~**1.1–1.5–1.6**~~ (fatto: bridge tile, sim gated, partial scale, sonno→snapshot+grafo, test).  
2. ~~**Fase 2.1–2.4**~~ (leptina/energia, cortisolo+pasto, GH/IGF-1 lab, UI evidenza↔skeleton).  
3. ~~**Fase 3**~~ (stream CGM / time-series 055 + API giornata + merge orario AI) — **chiusa** lato repo; prossimo filo consigliato: **Fase 4** (finestra multi-giorno / export) o integrazione CGM vendor su `persistRealityDeviceExport`.

---

## Changelog roadmap

| Data | Nota |
|------|------|
| 2026-05-09 | Creazione scaletta fasi 0–4 e ordine lavoro prossima sessione. |
| 2026-05-09 | Chiusura 1.1–1.3–1.6 (skeleton→tile, blocked/partial su sim tile, test dominio + presentation). |
| 2026-05-09 | Chiusura 1.4–1.5: `sleepContext` nello snapshot skeleton da conditioning; arco e nodo `sleep`; test dominio + web. |
| 2026-05-09 | Fase 2.1–2.4: leptina/energia, cortisolo–ACTH e pasti, lab GH/IGF-1↔GH, UI badge evidenza↔skeleton. |
| 2026-05-09 | Fase 3.1–3.2: tabella `athlete_time_series_samples`, lettura in slice giorno e merge curve gluc/lac (priorita vs export). |
| 2026-05-10 | Fase 3.1 ingest: dopo insert/update `device_sync_exports`, sync idempotente verso `athlete_time_series_samples` (delete per `source_ref.device_sync_export_id` + insert); skip silenzioso se tabella assente (migrazione non applicata). |
| 2026-05-10 | Fase 3.3: `dayContractVersion` (1) e `canonicalStreamCounts` nel JSON giornata bioenergetica; test `canonical-time-series-summary`. |
| 2026-05-10 | Fase 3.4: merge orario AI sotto arbitration server (`merge-hourly-curve`), schema proposta e test contratto. |
| 2026-05-10 | Migrazione **055** applicata su DB target: time-series canonico operativo in lettura/scrittura (convoglio `device_sync_exports`). |
| 2026-05-10 | Fase 4 avvio: `assembleBioenergeticWindow`, `GET /api/bioenergetics/window`, limite 14 giorni, test range date. |
| 2026-05-10 | UI Bioenergetics: sezione «Finestra multi-giorno» (date da/a + Carica + tabella riepilogo giorni). |
