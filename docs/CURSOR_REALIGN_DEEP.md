# Cursor — riallineamento profondo (bussola persa)

**Uso:** incolla l’intero blocco citato sotto in **chat** quando la sessione è degenerata (tunneling su SQL, repo sbagliato, dimenticanza generativa).  
**Oppure:** tienilo come **seconda rule** in User rules, o in un memo esterno da incollare solo quando serve.

---

```
EMPATHY — RIALLINEAMENTO PROFONDO (obbligatorio prima di continuare)

1) Repo e documenti (rileggi o skim mirato nel clone corretto)
   Pro 2 (empathy-pro-2-cursor) — preferito quando lavori qui:
   - CONSTITUTION.md
   - docs/ARCHITECTURE.md
   - docs/PLATFORM_STRUCTURE_SUMMARY.md
   - docs/ATHLETE_MEMORY_AND_COACH_SCOPE.md
   - docs/PRO2_UI_PAGE_CANON.md
   - docs/PRODUCT_VISION.md (se il tema è prodotto/go-to-market)
   - .cursor/rules: empathy_generative_core, empathy_architecture_gate, empathy_athlete_memory, empathy_pro2_north_star, empathy_schema_whole_picture (se presenti)
   V1 (nextjs-empathy-pro) — applica solo se il task è esplicitamente su V1:
   - SYSTEM_CONTEXT.md, ARCHITECTURE_RULES.md, docs/EMPATHY_PRO_2_BLUEPRINT.md
   - .cursor/rules empathy_* equivalenti

2) Bussola generativa (non negoziabile)
   - Quattro piani: Ingest → Compute (motori + digital twin) → Interpretation (knowledge, research trace; AI = interpretazione, orchestrazione, fatti strutturati / evidenza) → Application (UI, moduli, Stripe, presentazione Spline).
   - AI: incrocio multi-disciplinare e memoria strutturata che amplifica le basi valutative; NON è il generatore canonico di sessione/piano/twin math; i motori deterministici e il builder owns i numeri e la struttura generata.
   - Un solo builder equivalente per singola sessione; calendario operativo; niente secondo motore sessione parallelo.
   - Reality > Plan, Physiology > UI, carico interno > esterno.
   - Una linea di verità per athlete_id; vietato generare da stato solo React/UI senza memoria canonica.

3) Anti-tunneling
   - Nessun lavoro su SQL/migration/route/componente “sordo” rispetto a: ordine migration, FK/real DB, grep usage nel codice, allineamento Pro 2 ↔ V1 se stesso Supabase.
   - Dopo questa ricognizione, esegui il task restando dentro questi vincoli.
```
