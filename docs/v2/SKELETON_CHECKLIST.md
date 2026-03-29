# Checklist scheletro — primo giorno codice Empathy Pro 2.0

**Riferimento tecnico:** `docs/TECHNICAL_BLUEPRINT.md`  
**Charter prodotto:** `docs/PRODUCT_VISION.md`, `CONSTITUTION.md`

## Constitution & docs

- [x] `CONSTITUTION.md` con invarianti tecnici + principi prodotto
- [x] `docs/ARCHITECTURE.md` operativo (ingest / compute / interpret / app) — aggiornato con LogMeal + Spline
- [x] `docs/MIGRATION_FROM_V1.md` stub

## Monorepo / package

- [ ] Package `contracts` pubblica tipi/schema usati da motori e API
- [ ] Regola ESLint o boundary: `apps/web` non importa logica motore senza package domain
- [ ] Motori in package dedicato con test runner in CI

## Commerciale

- [ ] Integrazione Stripe (atleta + eventuale Connect coach)
- [ ] Modello permessi coach / atleta / audit modifiche coach
- [ ] Feature flag SKU biomeccanica / aerodinamica

## Data plane

- [ ] Modello eventi normalizzati (o documento snapshot-only)
- [ ] Adapter unici per device, lab, BIA
- [ ] **LogMeal**: route server + mapping → `contracts` / `domain-nutrition` (`docs/INTEGRATIONS_LOGMEAL.md`, `packages/integrations-logmeal`)

## Presentazione 3D (training)

- [ ] **Spline**: catalogo `exerciseKey` → scena, lazy load, fallback 2D (`docs/INTEGRATIONS_SPLINE.md`, `packages/integrations-spline`)

## Application plane

- [ ] Risoluzione contesto atleta **e** coach (ruoli)
- [ ] Builder contract condiviso da `contracts`
- [ ] Metriche **multi-disciplina** (run, nuoto, sci) oltre potenza — vedi `PRODUCT_VISION.md` §9

## Knowledge & research

- [ ] Corpus globale vs binding atleta vs trace audit
- [ ] Policy: trace non sostituisce twin

## Sicurezza

- [ ] `.env.example`; `.env.local` gitignored; CI no-secrets

## Cutover

- [ ] Piano migratorio dati approvato
- [ ] Dominio pilota opzionale

---

*Aggiornare quando il blueprint o il charter cambiano.*
