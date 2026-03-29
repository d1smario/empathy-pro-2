# Design system, Figma e UI grade A — **solo Empathy Pro 2.0**

**Grafica e Figma sono canoniche in questo repository** (`empathy-pro-2`), non in Empathy V1. V1 resta operativa con il suo UI attuale fino a eventuale cutover.

## Ruolo di Figma (non è un “plugin Vercel”)

- **Team e account Figma**: inviti designer/sviluppatore al **file master** 2.0; commenti, Dev Mode, handoff.
- **Token**: variabili Figma → export **in build** (JSON/CSS/theme). **Nessuna** chiamata API Figma dall’app in produzione.
- **Allineamento Spline**: i frame definiscono **dimensioni e margini** del viewport 3D esercizi (`docs/INTEGRATIONS_SPLINE.md`).

## Obiettivo visivo

- Interfaccia **forte e riconoscibile** (presenza visiva, contrasto, gerarchia), **WCAG 2.2 AA**, densità adattiva (analisi vs diario), distinzione coach/atleta nello stesso sistema.

## Pipeline in `apps/web`

- Foglio token generato (es. `styles/tokens.css`) — da non editare a mano salvo eccezioni documentate.
- Componenti usano **solo token** (`var(--color-…)`).
- Script `npm run tokens:sync` quando il flusso Figma → repo è definito.

## Deploy

- I **token compilati** vanno in **Git** e in **build Vercel**; Figma resta la sorgente di design, non un servizio deployato.

Vedi anche `docs/PLATFORM_AND_DEPLOY.md` e `docs/ARCHITECTURE_SAFETY_AND_RISKS.md`.
