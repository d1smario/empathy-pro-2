# Empathy Pro 2.0

Greenfield repository per la prossima generazione della piattaforma **EMPATHY**: performance, adattamento metabolico, dati interni + evidenza scientifica, non solo metriche esterne.

## Documenti guida (leggere in ordine)

| File | Contenuto |
|------|------------|
| [`docs/PRODUCT_VISION.md`](docs/PRODUCT_VISION.md) | **Charter prodotto** — domini scientifici, differenziazione, fasi, multi-disciplina |
| [`docs/COMMERCIAL_AND_ROLES.md`](docs/COMMERCIAL_AND_ROLES.md) | Stripe, atleta/coach, SKU biomeccanica/aerodinamica, bioimpedenza |
| [`CONSTITUTION.md`](CONSTITUTION.md) | Invarianti tecnici + principi non negoziabili |
| [`docs/TECHNICAL_BLUEPRINT.md`](docs/TECHNICAL_BLUEPRINT.md) | Scheletro repo, layer, assorbimento da V1 |
| [`docs/DESIGN_SYSTEM_AND_FIGMA.md`](docs/DESIGN_SYSTEM_AND_FIGMA.md) | **Grafica / Figma (canonico 2.0)** — token, UI grade A, viewport 3D |
| [`docs/PLATFORM_AND_DEPLOY.md`](docs/PLATFORM_AND_DEPLOY.md) | Cursor, GitHub, **Supabase**, **Vercel**, dove mettere segreti LogMeal/Spline |
| [`docs/ARCHITECTURE_SAFETY_AND_RISKS.md`](docs/ARCHITECTURE_SAFETY_AND_RISKS.md) | Coerenza generazione, rischi crash, mitigazioni |
| [`docs/INTEGRATIONS_LOGMEAL.md`](docs/INTEGRATIONS_LOGMEAL.md) | Diario alimentare AI (**solo 2.0**) |
| [`docs/INTEGRATIONS_SPLINE.md`](docs/INTEGRATIONS_SPLINE.md) | Esercizi e asset **3D** (stile MyFit Coach) |
| [`docs/v2/SKELETON_CHECKLIST.md`](docs/v2/SKELETON_CHECKLIST.md) | Checklist primo codice |

## Prerequisiti monorepo

- **npm 7+** (protocollo `workspace:*` nei package interni). Con npm 6: aggiornare npm (`npm install -g npm@10`) oppure usare Node 20 con npm incluso recente.

## Rapporto con Empathy V1

Il codice operativo attuale resta in **`nextjs-empathy-pro`** (repo sorella). Questo repo nasce per progettazione e, in seguito, implementazione pulita; la migrazione è documentata in `docs/MIGRATION_FROM_V1.md`.

## GitHub

Repository remoto: [https://github.com/d1smario/empathy-pro-2](https://github.com/d1smario/empathy-pro-2).
