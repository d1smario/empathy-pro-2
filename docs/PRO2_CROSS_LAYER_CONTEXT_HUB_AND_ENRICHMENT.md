# Pro 2 — Hub di contesto trasversale e arricchimento (due “intelligenze”)

**Status:** scheletro architetturale (documentazione) — febbraio 2026.  
**Allinea:** `CONSTITUTION.md`, `docs/ARCHITECTURE.md`, `docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`, `docs/INGEST_DEVICE_AND_LAB_MATRIX.md`, `.cursor/rules/empathy_generative_core.mdc`.

---

## 1. Chiarimento nomenclatura: “Core” vs `apps/web/core`

| Termine | Significato in prodotto | Dove nel repo |
|--------|-------------------------|---------------|
| **Contesto / hub operativo** | Dati e segnali trasversali che arricchiscono più moduli senza duplicare verità | Aggregazioni in `lib/` (wellness, internal load, athlete memory, dashboard hub), **non** una cartella unica chiamata “intelligence” |
| **`apps/web/core`** | Solo **Shell prodotto**: routing, guard, registry moduli (`module-registry`, `guards`, `generative-modules`) | Non confondere con il “cervello” della piattaforma |

Quando parliamo di **due sistemi intelligenti aperti**, intendiamo il **modello concettuale** sotto — da implementare e documentare sempre **convogliando** in ingest + memoria canonica, mai con store paralleli (`empathy_pro2_no_parallel_lines`).

---

## 2. Due modalità di “intelligenza” (complementari)

### 2.1 Intelligenza trasversale — contesto condiviso (`athlete_id`)

- **Ruolo:** rendere la piattaforma **più ricca** quando arrivano dati (wearable, lab, diario, sedute), **senza** riscrivere numeri canonici dei motori di dominio.
- **Meccanismo:** proiezioni, riassunti, indici di ricchezza contesto, priorità ingest, segnali giorno (sonno, HRV, readiness) che alimentano **più** superfici.
- **Principio:** un solo grafo di verità per atleta; gli arricchimenti sono **letture derivate** + **parametri di fusione** dove già previsto (es. `computeInternalContextRichness01`, policy curve bioenergetiche).

**Esempi di ancoraggio nel codice (non esaustivo):**

| Capacità | File / area tipica | Output verso |
|---------|-------------------|--------------|
| Memoria atleta aggregata | `lib/memory/athlete-memory-resolver.ts` | Moduli che necessitano snapshot profilo/fisiologia |
| Finestra wellness da export | `lib/physiology/wellness-window-summary.ts`, `device_sync_exports` | Calendario physiology, contesto giornata |
| Carico interno + segnali recupero | `lib/internal-load/internal-load-resolver.ts` | Training analytics, dashboard, modulazioni |
| Hub operativo dashboard | `app/api/dashboard/athlete-hub/route.ts`, hook `use-athlete-operational-hub` | Dashboard, card trasversali |
| Contesto condizionante bio | `lib/bioenergetics/build-bioenergetic-conditioning-context.ts` | Bioenergetics day assembler |
| Preferenze fonte dati | `lib/integrations/data-source-preference.ts` | Chi vince tra provider su stesso tipo di segnale |

### 2.2 Intelligenza di dominio — assemblaggio deterministico + interpretazione

- **Ruolo:** **Compute** (motori) + **assemblatori** che producono output strutturato per un modulo (bioenergetica giornata, meal plan, builder sessione).
- **Meccanismo:** input = memoria + contesto hub; output = contratti versionati; AI solo **interpretazione** o etichettatura dove consentito.
- **Esempi:** `assembleBioenergeticDay`, solver nutrizione, `generateBuilderSession` / VIRYA → builder.

---

## 3. Sistemi “aperti”: come si arricchiscono nel tempo

Invariante: **più ingest reale → più segnali disponibili → stessi motori con input più completi** oppure **fusioni con pesi diversi**, non “due twin” o tabelle ombra.

| Fase | Cosa succede |
|------|----------------|
| **Vuoto** | UI e motori usano default / piano / simulazioni operative con disclaimer chiari |
| **Parziale** | Es. solo training pianificato → meal plan risolto; bioenergetica: fusione piano→realtà |
| **Ricco** | Diario, eseguito, CGM/055, panel, export sonno/HRV → priorità `measured`, contesto interno più alto, meno dipendenza da stime pure |

**Anti-pattern (vietato):** nuovo “Core DB” o cache intelligenza separata dalla memoria atleta / tabelle canoniche senza migration.

---

## 4. Mappa dati → hub → consumatori (scheletro estendibile)

Riempire righe man mano che si aggiungono convogli espliciti.

| Segnale | Ingest / tabella | Riassunto / loader | Consumatori principali |
|--------|------------------|--------------------|-------------------------|
| Sonno / HRV / readiness | `device_sync_exports` (+ policy fonte) | `wellness-window-summary`, estrazione in internal load | Dashboard, physiology giorno, (futuro) modulazione bio/stress |
| Training pianificato/eseguito | `planned_workouts`, `executed_workouts` | `queryPlannedExecutedWindow`, analytics | Nutrition, bio timeline, calendario |
| Piano nutrizione giorno | `nutrition_plans` (+ solver da calendario) | `load-nutrition-plan-for-day` | Bioenergetics predittivo |
| Diario | `food_diary_entries` | slice giornata bio | Bioenergetica adattiva, nutrizione |
| Time-series CGM/lattato | `athlete_time_series_samples` | stream + day slice | Bioenergetica (misura vince) |
| Lab | `biomarker_panels` | panel resolver | Health, bio conditioning |

---

## 5. Incrocio adattamento × stress (mini prova tipo 9–15)

**Obiettivo prodotto:** mostrare sullo stesso asse temporale (giorni) **carico / adattamento** (es. TSS, serie internal load) e **supporto autonomico** (sonno, HRV, readiness da export), senza nuovo motore parallelo.

**Approccio suggerito:**

1. **Finestra date** fissa (es. ISO 9–15) per un `athlete_id` noto.
2. **Leggere** `buildWellnessWindowSummary` (o equivalente) + serie training da route analytics / internal load già esistenti.
3. **Derivare** indicatori solo descrittivi (trend, correlazioni deboli) in **Application** o report admin — oppure card dashboard con disclaimer “osservazione, non diagnosi”.
4. **Non** usare LLM per inventare numeri; eventuale AI solo per testo evidenza su dati già tabellari.

**Deliverable minimo accettabile:** una sola API thin o sezione dashboard che unisce due sorgenti già lette altrove (thin = niente seconda query duplicata lungo, riuso loader).

---

## 6. Estensioni documentate (TODO espliciti)

- [ ] **Capitolo singolo** “Stress vs adattamento” in `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md` con link a questo file.
- [ ] **Naming UI** distinto: “Contesto giornata” / “Segnali recupero” vs “Bioenergetica (dominio)”.
- [ ] **Metriche di ricchezza** esposte in audit (solo admin o power user) per allineare roadmap a `computeInternalContextRichness01`-style ovunque serva.
- [ ] **Curriculum coach:** cosa arricchisce prima (diario vs device) per sbloccare moduli.

---

## 7. Riferimenti incrociati

- Piani 4 livelli: `docs/ARCHITECTURE.md`
- Mappa generativa: `docs/EMPATHY_PRO2_GENERATIVE_SYSTEM_ARCHITECTURE.md`
- Rete dati + AI: `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md`
- Memoria: `docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md`
- Regola no linee parallele: `.cursor/rules/empathy_pro2_no_parallel_lines.mdc`

---

*Documento vivo: aggiornare quando si aggiunge un convoglio hub→dominio o una nuova superficie “contesto condiviso”. Versione 0.1.*
