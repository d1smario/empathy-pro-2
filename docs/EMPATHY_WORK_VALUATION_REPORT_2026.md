# Report valorizzazione lavoro — Empathy (Pro 2.0 + eredità V1)

**Data report:** 3 giugno 2026  
**Repository:** empathy-pro-2-cursor / empathy-pro-2  
**Produzione:** https://empathy-pro-2-web.vercel.app/

---

## Premessa metodologica

Nel repository **non esiste un timesheet** (Toggl, Jira, fogli ore). Le cifre di questo documento sono **stime strutturate** per attribuire valore al lavoro svolto, incrociando dati oggettivi da git, inventario codice e documentazione interna. Non costituiscono contabilità certificata.

---

## 1. Cosa misuriamo

Empathy oggi è una **piattaforma multilayer** (ingest → motori → twin → interpretazione → applicazione) con:

- moduli prodotto ufficiali (training, nutrition, physiology, health, bioenergetics, biomechanics, aerodynamics, longevity, coach/admin);
- **motori numerici proprietari** versionati in `packages/domain-*`;
- **integrazioni device** multi-vendor (Garmin, WHOOP, Wahoo, Strava, Polar, Suunto, Karoo);
- pipeline **AI solo interpretativa** (non sostitutiva dei motori);
- schema DB Supabase con RLS e memoria atleta canonica (`athlete_id`);
- documentazione architetturale estesa e regole operative (`.cursor/rules`).

---

## 2. Dati oggettivi dal repository Pro 2

| Indicatore | Valore |
|------------|--------|
| Periodo git tracciabile | 29 mar 2026 → 3 giu 2026 (~66 giorni) |
| Commit totali | 479 (475 autore d1smario) |
| Intensità mensile | mar 4 · apr 129 · mag 326 · giu 20 |
| Righe TypeScript/TSX | ~175.800 (escl. node_modules, .next) |
| Route API (route.ts) | 183 |
| Migration SQL | 74 file · ~12.000 righe SQL |
| Package dominio | 15 (contracts, domain-*, integrations-*) |
| File test automatici | ~150 |
| Documenti markdown | ~82 |
| Moduli UI shell | 29 pagine prodotto (+ access, admin, staging) |
| Deploy produzione | Vercel empathy-pro-2-web |

**Clone V1 locale** (nextjs-empathy-pro): storia git incompleta nel workspace (60 commit da fine apr, ~69k righe TS) — non rappresenta l'intero investimento V1, ma conferma assorbimento/porting verso Pro 2.

---

## 3. Perimetro funzionale consegnato (stato attuale)

Stato sintetico da `docs/ATHLETE_GREENFIELD_AND_SYSTEM_STATUS_REPORT.md` (maggio 2026):

| Area | Consegna | Note |
|------|----------|------|
| Architettura / costituzione | Alta | CONSTITUTION, blueprint, 4 piani generativi, L1–L10 |
| Auth + contesto atleta/coach | Parziale | Policy stabile; edge case possibili |
| Training · Builder | Parziale | Pipeline canonica Pro 2, BUILDER_SESSION_JSON |
| Training · VIRYA / calendario | Parziale | Orchestrazione verso builder |
| Motori carico (CTL/ATL, load v2) | Ok | domain-training, test golden |
| Bioenergetics / curve giorno | Parziale | Simulatori v1, fusion curve |
| Nutrition · meal plan / fueling | Parziale | Solver deterministico; dipende da calendario |
| Health · lab / staging | Parziale | Upload → biomarker → staging → normalize |
| Physiology / twin | Parziale | Coupling training spesso vuoto senza eseguiti |
| Biomechanics / Aerodynamics | Parziale | CV adapter, staging, scoring |
| Longevity / EPI / Coin | Parziale | Motore deterministico + check-in |
| Integrazioni Garmin | Parziale–Ok | OAuth, push, pull, wellness |
| Altri device | Parziale | WHOOP, Wahoo, Strava, Polar, Suunto, Karoo |
| Knowledge / PubMed / multiscala | Parziale | Registry + trace |
| Billing / Stripe / coach grants | Parziale | Application layer presente |
| UI Pro 2 (canone generativo) | Parziale | Shell, palette, GenerativeModuleSurface |

**Interpretazione:** valore = piattaforma greenfield avanzata con nucleo architetturale forte e moduli in fase operativa parziale — tipico di prodotto deep-tech sport/metabolic con ~2–3 mesi di repo Pro 2 ad alta velocità (sviluppo assistito + porting V1).

---

## 4. Metodologia di stima ore

Tre metodi incrociati:

1. **Bottom-up per area** — ore tipiche industria per deliverable simili (health/sport SaaS, motori custom, integrazioni OAuth).
2. **Commit × ore/commit** — 479 commit × 1,5–3 h → 720–1.440 h solo fase git Pro 2 (sottostima design pre-repo e ricerca).
3. **LOC × produttività** — 175k LOC ÷ 40–80 LOC/h nette → 2.200–4.400 h equivalenti scrittura.

La stima consolidata usa il bottom-up, calibrato su git e maturità operativa.

---

## 5. Stima ore per categoria

### A. Progettazione, product e architettura

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| Visione prodotto (PRODUCT_VISION, charter) | 40 | 80 | 120 |
| Costituzione, invarianti generativi, gate | 60 | 120 | 200 |
| Blueprint tecnico, mappe multilayer, roadmap | 80 | 160 | 280 |
| UI canon Pro 2, design system, Figma | 40 | 100 | 180 |
| Ruoli coach/atleta, commercial, billing | 30 | 60 | 100 |
| **Subtotale A** | **250** | **520** | **880** |

### B. Ricerca scientifica e modellazione concettuale

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| Letteratura carico/adattamento (load v2) | 60 | 120 | 220 |
| Bioenergetics / CGM / BIA / endocrino | 80 | 180 | 350 |
| Nutrizione metabolica, pathway, L1–L10 | 50 | 110 | 200 |
| Health / biomarkers / causal graph | 40 | 90 | 160 |
| Multiscala biologico / knowledge ontology | 40 | 80 | 150 |
| **Subtotale B** | **270** | **580** | **1.080** |

### C. Matematica e motori deterministici

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| Training: EWMA, impulso, load metrics v2 | 80 | 160 | 280 |
| Physiology: energia meccanica, metriche disciplina | 40 | 90 | 160 |
| Bioenergetics: simulator, curve fusion, CGM | 120 | 260 | 450 |
| Twin + adaptation score + memoria | 80 | 170 | 300 |
| Nutrition solver (macro, diet, race-day) | 100 | 200 | 350 |
| EPI / longevity / human efficiency | 40 | 90 | 160 |
| Biomechanics + aerodynamics | 60 | 130 | 240 |
| Test golden / regression (~150 file) | 80 | 180 | 320 |
| **Subtotale C** | **600** | **1.280** | **2.260** |

### D. Backend e dati

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| Contratti Zod/API (packages/contracts) | 80 | 150 | 250 |
| Schema Supabase + 74 migration + RLS | 120 | 240 | 400 |
| 183 route API | 350 | 650 | 1.100 |
| Pipeline ingest reality | 150 | 300 | 500 |
| Athlete memory, coach, grants, billing | 80 | 160 | 280 |
| Script operativi / diagnostica | 40 | 80 | 140 |
| **Subtotale D** | **820** | **1.580** | **2.670** |

### E. Frontend e UX

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| Shell Pro 2, navigation, auth, active athlete | 100 | 200 | 350 |
| Training: Builder, Calendar, Session, VIRYA | 200 | 420 | 700 |
| Nutrition: module, meal plan, fueling, diary | 120 | 260 | 450 |
| Physiology, Bioenergetics, Health UI | 100 | 220 | 380 |
| Biomechanics / Aerodynamics capture | 80 | 170 | 300 |
| Dashboard, Profile, Longevity, Admin | 80 | 180 | 320 |
| Generative surfaces + error boundary | 60 | 120 | 200 |
| **Subtotale E** | **740** | **1.570** | **2.700** |

### F. Integrazioni esterne

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| Garmin (OAuth, push, pull, wellness, FIT) | 120 | 280 | 480 |
| WHOOP, Wahoo, Strava | 80 | 180 | 320 |
| Polar, Suunto, Karoo | 60 | 120 | 220 |
| Stripe, LogMeal, Spline | 40 | 90 | 160 |
| Knowledge APIs (PubMed, UniProt, …) | 50 | 110 | 200 |
| **Subtotale F** | **350** | **780** | **1.380** |

### G. AI e interpretazione

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| Health document pipeline | 60 | 130 | 240 |
| Playbook, interrogation map | 50 | 110 | 200 |
| Research traces, multiscala | 40 | 90 | 160 |
| Guardrail generativi, policy Cursor | 40 | 80 | 140 |
| **Subtotale G** | **190** | **410** | **740** |

### H. Qualità, deploy, operatività

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| CI/verify, build, Vercel | 50 | 100 | 180 |
| Smoke, perf, debugging produzione | 60 | 140 | 260 |
| Documentazione + regole agent | 80 | 180 | 320 |
| Sessioni Cursor / agent (stima) | 100 | 250 | 500 |
| **Subtotale H** | **290** | **670** | **1.260** |

### I. Eredità V1 e porting

| Voce | Basse | Medie | Alte |
|------|-------|-------|------|
| Analisi V1, parity, absorption | 150 | 350 | 650 |
| Shared DB / migration intent | 40 | 90 | 160 |
| **Subtotale I** | **190** | **440** | **810** |

---

## 6. Totali ore

| Scenario | Ore totali | Profilo |
|----------|------------|---------|
| Conservativo | ~3.710 h | Solo deliverable hard, minimo ricerca/porting |
| Realistico (medio) | ~7.830 h | Scope repo + doc + motori + integrazioni |
| Alto (completo) | ~13.780 h | Ricerca approfondita, hardening, edge case, V1 non in git |

**Equivalente FTE (1 FTE ≈ 1.600 h/anno):**

| Scenario | FTE·anno |
|----------|----------|
| Conservativo | ~2,3 anni (1 persona) |
| Realistico | ~4,9 anni |
| Alto | ~8,6 anni |

In 66 giorni di repo Pro 2 il ritmo implica parallelismo intenso: sviluppatore + Cursor/agent + riuso V1 + lavoro concettuale pre-marzo 2026.

---

## 7. Valorizzazione economica (EUR)

Tariffe di riferimento (Italia/EU, product + health-tech + full-stack senior):

| Profilo | €/h | Conservativo | Realistico | Alto |
|---------|-----|--------------|------------|------|
| Freelance senior | 65 | €241.000 | €509.000 | €896.000 |
| Studio / product engineer | 85 | €315.000 | €666.000 | €1.171.000 |
| Consulenza specializzata | 110 | €408.000 | €861.000 | €1.516.000 |

**Valore stato operativo oggi** (sconto maturità ~30% sul realistico a €85/h): **~€350.000 – €580.000**.

Per cap table / investitori: separare IP motori da integrazioni commerciali; escludere o scontare moduli ancora parziali (20–40%); aggiungere costi diretti (Supabase, Vercel, API vendor, LLM, legal Stripe).

---

## 8. Distribuzione percentuale del valore (scenario realistico)

| Macro-area | % ore (medio) |
|------------|---------------|
| Costruzione informatica (backend + frontend) | ~40% |
| Motori + matematica + test | ~16% |
| Integrazioni | ~10% |
| Ricerca + progettazione | ~14% |
| AI interpretazione | ~5% |
| QA, deploy, documentazione, agent | ~9% |
| Porting V1 | ~6% |

---

## 9. Sintesi esecutiva

| Domanda | Risposta |
|---------|----------|
| Quanto lavoro c'è dentro Empathy oggi? | ~4.000–8.000 ore-equivalenti multidisciplinari, in repo Pro 2 di 66 giorni e 479 commit. |
| Valore attribuibile (solo lavoro)? | ~€350k – €860k (65–110 €/h), con sconto se si valuta solo ciò operativo in produzione. |
| Cosa pesa di più? | Backend/API + UI moduli + motori deterministici; differenziazione in motori, ricerca e architettura generativa. |
| Cosa manca per audit certificato? | Timesheet, git V1 completo, criterio sconto maturità concordato. |

---

*Documento generato da analisi repository empathy-pro-2-cursor — giugno 2026.*
