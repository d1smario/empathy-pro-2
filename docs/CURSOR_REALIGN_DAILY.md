# Cursor — riallineamento quotidiano (**Empathy Pro 2.0 cursor**)

**Uso:** in chat, scrivi **`RIALLINEAMENTO EMPATHY PRO 2.0 cursor`** e incolla il blocco sotto (inizio giornata o task piccolo).  
**Oppure:** incolla il blocco in **Cursor → Settings → Rules → User rules** (resta attivo su tutti i workspace; vedi `docs/CURSOR_REALIGN_HOWTO.md`).

---

```
RIALLINEAMENTO EMPATHY PRO 2.0 cursor — check rapido prima di lavorare:

- Workspace / root giusta?
  - UI e canone Pro 2.0 (Figma, Pro2ModulePageShell, apps/web Next): clone **empathy-pro-2-cursor** (es. …\EMPATHY\empathy-pro-2-cursor). Non confondere con la sola V1.
  - V1 operativa / blueprint condiviso: **nextjs-empathy-pro**.
  - Se il workspace è multi-root: controlla quale cartella contiene il file che stai modificando (@ file nella root corretta).
- Generativo: 4 piani Ingest → Compute (motori + twin) → Interpretation (knowledge / research trace; AI = interpretazione, evidenza strutturata, orchestrazione) → Application. AI non sostituisce motori né inventa numeri canonici; un solo builder per singola sessione. Reality > Plan, Physiology > UI, carico interno > esterno.
- Rete dati (deterministico) vs rete interpretation/AI: due strati — prima pipeline numerica/struttura (solver, composer, canonical, twin); sopra pathway, multiscala, knowledge. Mappa file e gap: **docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md**. Nutrition meal plan Pro 2 = deterministico; routine `week_plan` e incrocio orario pasto ↔ fine allenamento = ancora da cablare con regole pure (non LLM).
- Schema / SQL / API: niente fix isolato senza migration + uso nel codice + impatto V1/Pro 2 se stesso Supabase.
- UI Pro 2.0: canone pagina in **empathy-pro-2-cursor** `docs/PRO2_UI_PAGE_CANON.md` (riferimento Builder rich / shell condivisa). Su V1, non assumere che le modifiche Pro 2 siano già lì salvo porting esplicito.
- Calendario / giornata Pro 2: stessa API `planned-window`; contratto builder in notes (`BUILDER_SESSION_JSON::`); viste calendar/session nel repo che stai editando — nessun data path parallelo.
- Grafica: token e shell → `docs/DESIGN_SYSTEM_AND_FIGMA.md` + `apps/web/app/globals.css` sul clone Pro 2; generativo illustrazioni → `docs/EMPATHY_GENERATIVE_VISUAL_SYSTEM.md` dove presente. Non spillare token “nutrition expo” sulla shell generica.
```
