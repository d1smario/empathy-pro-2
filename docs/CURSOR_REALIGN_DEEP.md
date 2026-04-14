# Cursor — riallineamento profondo (EMPATHY Pro)

**Uso:** in chat scrivi **`RIALLINEAMENTO EMPATHY PRO`** e incolla l’intero blocco sotto quando la sessione è fuori rotta (tunneling SQL, repo sbagliato, confusione builder/calendario, UI Pro 2 nel clone errato).  
**Oppure:** seconda User rule opzionale, oppure memo esterno (vedi `docs/CURSOR_REALIGN_HOWTO.md`).

---

```
RIALLINEAMENTO EMPATHY PRO — PROFONDO (obbligatorio prima di continuare)

1) Repo e documenti (skim o rilettura nella root corretta)

   A) Empathy Pro 2.0 — clone **empathy-pro-2-cursor** (UI principale Pro 2, apps/web):
   - CONSTITUTION.md (root del clone)
   - docs/ARCHITECTURE.md
   - docs/PLATFORM_STRUCTURE_SUMMARY.md
   - docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md
   - docs/PRO2_UI_PAGE_CANON.md
   - docs/DESIGN_SYSTEM_AND_FIGMA.md
   - docs/LOCAL_DEV_WITH_V1.md (se tocchi entrambi i repo)
   - docs/PRODUCT_VISION.md (se tema prodotto / GTM)
   - docs/CURSOR_REALIGN_DAILY.md + docs/CURSOR_REALIGN_HOWTO.md
   - docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md (rete deterministica vs AI)
   - .cursor/rules del clone

   B) V1 — **nextjs-empathy-pro** (task su V1, API condivise, o stesso Supabase):
   - SYSTEM_CONTEXT.md, ARCHITECTURE_RULES.md (in particolare § 6.1 e § 6.1.1: builder vs calendario)
   - docs/EMPATHY_PRO_2_BLUEPRINT.md
   - .cursor/rules empathy_*
   - Per il filo training: `lib/training/builder/session-contract.ts`, `app/api/training/calendar/route.ts`

   Non proseguire finché non hai aperto almeno un file nella **root giusta** per il task (multi-root: verifica sidebar / path completo).

2) Bussola generativa (non negoziabile)

   - Quattro piani: Ingest → Compute (motori + digital twin) → Interpretation (knowledge, research trace; AI = interpretazione, orchestrazione, evidenza strutturata) → Application (UI, moduli, integrazioni).
   - Due reti: (A) pipeline deterministica (solver, builder, contratti canonici); (B) interpretation + AI sopra — dettaglio in **empathy-pro-2-cursor/docs/EMPATHY_PRO2_DATA_AND_GENERATION_NETWORK.md**. La B legge la A, non riscrive numeri canonici pasto/sessione.
   - **Builder** = generatore canonico della **unità sessione**; **Virya** = struttura di piano che chiede materializzazione sessione al builder (nessuna logica sessione parallela).
   - **Calendario** = persistenza e distribuzione operativa (pianificato/eseguito); allineato al builder quando ogni sessione rilevante **serializza** il contratto (`BUILDER_SESSION_JSON::` nelle note o equivalente concordato) così dashboard, nutrition module, calendar UI leggono la stessa verità strutturata. Assenza del contratto = gap da colmare (migrazione dati, salvataggi, import), non invito a far “generare” il calendario al posto del builder.
   - AI: memoria strutturata e incrocio disciplinare; NON generatore canonico di sessione / piano pasti / twin math.
   - Reality > Plan, Physiology > UI, carico interno > esterno.
   - Una linea di verità per athlete_id; vietato generare da stato solo React/UI senza memoria/contratto canonico dove il sistema li prevede.

3) Anti-tunneling

   - Nessun lavoro su SQL/migration/route/componente “sordo” rispetto a: ordine migration, FK/real DB, grep usage nel codice, allineamento Pro 2 ↔ V1 se stesso Supabase.
   - Dopo questa ricognizione, esegui il task restando dentro questi vincoli.

4) Bussola visiva (Pro 2)

   - Shell prodotto Pro 2: `Pro2ModulePageShell`, `Pro2SectionCard`, token in `apps/web/styles/tokens.css` / `apps/web/app/globals.css` — come da PRO2_UI_PAGE_CANON.md e DESIGN_SYSTEM_AND_FIGMA.md nel clone **empathy-pro-2-cursor**.
   - V1 può avere shell legacy: non portare indietro il canone Pro 2 salvo task esplicito; di default implementare Pro 2 nel clone giusto.
   - Generativo (illustrazioni, diagrammi): docs/EMPATHY_GENERATIVE_VISUAL_SYSTEM.md + `empathy-visual-dna.ts` sul repo che li contiene.
```
