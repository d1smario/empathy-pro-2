# Cursor — riallineamento profondo (**Empathy Pro 2.0 cursor**)

**Uso:** in chat, scrivi **`RIALLINEAMENTO EMPATHY PRO 2.0 cursor`** e incolla l’intero blocco sotto quando la sessione è degenerata (tunneling SQL, repo sbagliato, UI Pro 2 editata nel clone errato, dimenticanza generativa).  
**Oppure:** seconda User rule opzionale, oppure memo esterno (vedi `docs/CURSOR_REALIGN_HOWTO.md`).

---

```
RIALLINEAMENTO EMPATHY PRO 2.0 cursor — PROFONDO (obbligatorio prima di continuare)

1) Repo e documenti (skim o rilettura nel clone corretto)

   A) Empathy Pro 2.0 cursor — clone **empathy-pro-2-cursor** (UI principale Pro 2, apps/web):
   - CONSTITUTION.md (root)
   - docs/ARCHITECTURE.md
   - docs/PLATFORM_STRUCTURE_SUMMARY.md
   - docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md
   - docs/PRO2_UI_PAGE_CANON.md
   - docs/DESIGN_SYSTEM_AND_FIGMA.md
   - docs/LOCAL_DEV_WITH_V1.md (se tocchi entrambi i repo)
   - docs/PRODUCT_VISION.md (se tema prodotto / GTM)
   - docs/CURSOR_REALIGN_DAILY.md + docs/CURSOR_REALIGN_HOWTO.md
   - docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md (rete deterministica vs interpretation/AI, file che dialogano, gap matematici)
   - .cursor/rules del clone (generative, architettura, Pro 2, ecc.)

   B) V1 — **nextjs-empathy-pro** (solo se il task è esplicitamente su V1 o shared backend):
   - SYSTEM_CONTEXT.md, ARCHITECTURE_RULES.md
   - docs/EMPATHY_PRO_2_BLUEPRINT.md
   - .cursor/rules empathy_* equivalenti

   Non proseguire finché non hai aperto almeno un file nella **root giusta** per il task (in multi-root: verifica sidebar / path completo).

2) Bussola generativa (non negoziabile)
   - Quattro piani: Ingest → Compute (motori + digital twin) → Interpretation (knowledge, research trace; AI = interpretazione, orchestrazione, evidenza strutturata) → Application (UI, moduli, Stripe, presentazione Spline).
   - Due reti logiche: (A) dati e generazione deterministica (solver, meal composer, canonical food, twin/physiology in ingresso); (B) interpretation + AI sopra (pathway, multiscala bottleneck, PubMed) — vedi **docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md**. La B legge la A; non riscrive numeri canonici di pasto/sessione.
   - AI: incrocio multi-disciplinare e memoria strutturata; NON è il generatore canonico di sessione / piano / twin math; motori deterministici e builder per numeri e struttura generata.
   - Un solo builder equivalente per singola sessione; calendario operativo; niente secondo motore sessione parallelo.
   - Reality > Plan, Physiology > UI, carico interno > esterno.
   - Una linea di verità per athlete_id; vietato generare da stato solo React/UI senza memoria canonica.

3) Anti-tunneling
   - Nessun lavoro su SQL/migration/route/componente “sordo” rispetto a: ordine migration, FK/real DB, grep usage nel codice, allineamento Pro 2 ↔ V1 se stesso Supabase.
   - Dopo questa ricognizione, esegui il task restando dentro questi vincoli.

4) Bussola visiva (Pro 2.0 cursor)
   - Shell prodotto Pro 2: `Pro2ModulePageShell`, sezioni `Pro2SectionCard`, token in `apps/web/styles/tokens.css` / `apps/web/app/globals.css` — come da PRO2_UI_PAGE_CANON.md e DESIGN_SYSTEM_AND_FIGMA.md nel clone **empathy-pro-2-cursor**.
   - V1 (nextjs-empathy-pro) può avere ancora shell legacy: non “portare indietro” il canone Pro 2 salvo task esplicito; di default implementare Pro 2 nel clone giusto.
   - Generativo (illustrazioni esercizio, diagrammi): docs/EMPATHY_GENERATIVE_VISUAL_SYSTEM.md + `empathy-visual-dna.ts` sul repo che li contiene; non duplicare regole ad hoc nei componenti.
```
