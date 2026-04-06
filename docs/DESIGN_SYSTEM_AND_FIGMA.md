# Design system, Figma e UI grade A — **solo Empathy Pro 2.0**

**Grafica e Figma sono canoniche in questo repository** (`empathy-pro-2`), non in Empathy V1. V1 resta operativa con il suo UI attuale fino a eventuale cutover.

## Ruolo di Figma (non è un “plugin Vercel”)

- **Team e account Figma**: inviti designer/sviluppatore al **file master** 2.0; commenti, Dev Mode, handoff.
- **Token**: variabili Figma → export **in build** (JSON/CSS/theme). **Nessuna** chiamata API Figma dall’app in produzione.
- **Allineamento Spline**: i frame definiscono **dimensioni e margini** del viewport 3D esercizi (`docs/INTEGRATIONS_SPLINE.md`).

## Obiettivo visivo

- Interfaccia **forte e riconoscibile** (presenza visiva, contrasto, gerarchia), **WCAG 2.2 AA**, densità adattiva (analisi vs diario), distinzione coach/atleta nello stesso sistema.

## Matrice visiva di riferimento (Figma)

- Si **mantiene** come riferimento canonico 2.0 la **matrice di frame** definita in Figma (es. file **Generate Analysis** / dashboard “multiverso”: hero EMPATHY PRO, KPI, Performance Metrics, Performance Profile, Lactate, varianti stile, stato sistema).
- Le **immagini still / palestra** (es. thruster, leg press, back squat con overlay muscolare) sono il target per **Spline** o export da Figma; restano **layer di presentazione**, non sorgente dati fisiologici (`docs/INTEGRATIONS_SPLINE.md`).
- Il file master Figma resta la **sorgente**; screenshot o export in chat sono solo handoff temporaneo finché i frame non sono versionati nel team.

## Loghi e palette brand (viola · rosa · arancio)

- **Forma del logo** (icona + wordmark “empathy”) resta quella approvata; applicazioni su cappello, dischi, banner nelle scene sono **varianti di contesto**.
- I **file logo** definitivi con palette **viola / rosa / arancio** (SVG/PNG, varianti on-dark / on-gradient) si **inseriranno in seguito** sotto `apps/web/public` (o path concordato) e verranno mappati a **token** (`Brand/Logo/…`) al momento del sync Figma → repo.
- Fino a quel momento, l’implementazione UI usa **token placeholder** o asset provvisori allineati alla matrice Figma, senza cambiare architettura ingest/compute.

## Pipeline in `apps/web`

- Foglio token generato (es. `styles/tokens.css`) — da non editare a mano salvo eccezioni documentate.
- Componenti usano **solo token** (`var(--color-…)`).
- Script `npm run tokens:sync` quando il flusso Figma → repo è definito.

## Deploy

- I **token compilati** vanno in **Git** e in **build Vercel**; Figma resta la sorgente di design, non un servizio deployato.

Vedi anche `docs/PLATFORM_AND_DEPLOY.md`, `docs/ARCHITECTURE_SAFETY_AND_RISKS.md` e **`docs/PRO2_UI_PAGE_CANON.md`** (implementazione pagina-modello Pro 2: layout, palette sezioni, geometrie icone disciplina).
