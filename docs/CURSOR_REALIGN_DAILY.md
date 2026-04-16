# Cursor — riallineamento quotidiano (EMPATHY Pro)

**Uso:** in chat scrivi **`RIALLINEAMENTO EMPATHY PRO`** o **`RIALLINEAMENTO EMPATHY PRO 2`** e incolla il blocco sotto (inizio giornata o task piccolo). Fatti fissi (URL GitHub, Vercel, localhost): `docs/AGENT_STATIC_CONTEXT_PRO2.md`.  
**Oppure:** incolla il blocco in **Cursor → Settings → Rules → User rules** (vale su tutti i workspace; meccanica in `docs/CURSOR_REALIGN_HOWTO.md`).

---

```
RIALLINEAMENTO EMPATHY PRO — check rapido prima di lavorare:

- Workspace / root giusta?
  - V1 operativa / blueprint: **nextjs-empathy-pro**.
  - UI Pro 2.0 (Figma, Pro2ModulePageShell, `apps/web`): monorepo **empathy-pro-2-cursor** — non la sottocartella `nextjs-empathy-pro/empathy-pro-2-cursor` (solo frammenti, non avviabile). Non mescolare i due alberi salvo porting esplicito.
  - Multi-root: verifica su quale root stai editando (path completo / @ file nella cartella corretta).

- Builder ↔ calendario (non confondere i ruoli)
  - **Builder** = unico generatore canonico della **singola sessione** (struttura + numeri da motori/twin); vedi `ARCHITECTURE_RULES.md` § 6.1 (repo V1).
  - **Calendario** = **hub operativo**: pianifica, memorizza, distribuisce sessioni pianificate/eseguite; **non** è la fonte biologica e **non** sostituisce il builder come motore di generazione — vedi § 6.1.1.
  - **Allineamento** = le righe pianificate devono **portare** il contratto builder dove possibile: tag `BUILDER_SESSION_JSON::` nelle note; l’API arricchisce (`builderSession`, `canonicalPlannedWorkout`). V1: `GET /api/training/calendar`; Pro 2: `planned-window` + stesso tag nelle note. Estrazione V1: `lib/training/builder/session-contract.ts`. Se manca il marker, spesso è **debito legacy / percorso parallelo** — **oppure** righe inserite da **SQL demo** (`supabase/DEMO_*.sql`, `PASTE_DEMO_*`, `[DEMO_*]`, `mario-rova-demo`…): volutamente **senza** JSON builder per analisi/smoke; non sono Virya/builder e non dimostrano architettura rotta.

- Generativo: 4 piani Ingest → Compute (motori + twin) → Interpretation (knowledge / trace; AI = interpretazione, evidenza strutturata, orchestrazione) → Application. AI non sostituisce motori né inventa numeri canonici; **un solo builder** per materiale sessione; niente secondo motore sessione parallelo. Reality > Plan, Physiology > UI, carico interno > esterno.

- Nutrizione piano pasti (`/api/nutrition/intelligent-meal-plan` su V1): solo motore deterministico; nessun LLM come generatore del piano (allineato al generative core).

- Rete dati deterministico vs interpretation/AI (Pro 2): clone **empathy-pro-2-cursor** → `docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md`.

- Schema / SQL / API: niente fix isolato senza migration + uso nel codice + impatto V1/Pro 2 se stesso Supabase.

- UI Pro 2.0: canone **`empathy-pro-2-cursor`** `docs/PRO2_UI_PAGE_CANON.md`. Su V1 non assumere che il canone Pro 2 sia già applicato salvo porting esplicito.

- V1 calendario training: `GET /api/training/calendar`; per ridurre latenza su cambio mese usare `includeAthleteContext=0` dove il client lo supporta (es. `TrainingCalendarPageView`). Dettaglio carico: `docs/EMPATHY_STRUCTURE_LOAD_NUTRITION_BRIEF.md`.

- Grafica Pro 2: token e shell → `docs/DESIGN_SYSTEM_AND_FIGMA.md` + `apps/web/app/globals.css` sul clone Pro 2; generativo illustrazioni → `docs/EMPATHY_GENERATIVE_VISUAL_SYSTEM.md` dove presente.
```
