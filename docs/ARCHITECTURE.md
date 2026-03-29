# EMPATHY Pro 2.0 — Architettura operativa

**Charter:** `docs/PRODUCT_VISION.md` · **Invarianti:** `CONSTITUTION.md` · **Scheletro repo:** `docs/TECHNICAL_BLUEPRINT.md` · **Sicurezza integrazioni:** `docs/ARCHITECTURE_SAFETY_AND_RISKS.md` · **Deploy:** `docs/PLATFORM_AND_DEPLOY.md`

## Piani (layer)

1. **Ingest** — adapter device, laboratorio, BIA; **LogMeal** (foto pasto → reality nutrizionale); eventi normalizzati / envelope di qualità.
2. **Compute** — motori versionati (fisiologia, bioenergetica); proiezione **digital twin**.
3. **Interpretation** — knowledge (corpus, meccanismi, binding), research trace, faccette deterministiche; AI solo interpretazione/orchestrazione.
4. **Application** — `apps/web` (e future API thin): moduli prodotto, auth, ruoli atleta/coach, Stripe; **Spline** per presentazione 3D esercizi (layer UI, non sorgente dati).

Flusso logico: ingest → compute → twin; ingest e twin alimentano knowledge; twin + knowledge → UI/API.

## Monorepo

- **`packages/contracts`** — tipi e contratti condivisi (portare da V1 in modo incrementale).
- **`packages/domain-*`** — logica di dominio e motori; non dipendono da React.
- **`packages/integrations-*`** — Stripe, Supabase, **LogMeal**, **Spline** (mapping + tipi; viewer spesso in `apps/web`).
- **`apps/web`** — Next.js: wiring, UI, route handler sottili.

## Regole di confine

- Un solo generatore canonico di **singola sessione** (builder); calendario operativo; niente motori paralleli per la stessa responsabilità.
- `Reality > Plan`, `Physiology > UI`, **carico interno > esterno**.
- Modifiche coach su dati atleta: permessi espliciti, audit (vedi `docs/COMMERCIAL_AND_ROLES.md`).

---

*Documento vivo: aggiornare quando cambiano piani dati o cutover da V1.*
