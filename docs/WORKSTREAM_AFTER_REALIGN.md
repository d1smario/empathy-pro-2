# Linea di lavoro post-riallineamento — Empathy Pro 2 (`empathy-pro-2-cursor`)

**Stato allineamento (sessione):** letti `docs/AGENT_STATIC_CONTEXT_PRO2.md`, `docs/CURSOR_REALIGN_DAILY.md`, `docs/CURSOR_REALIGN_HOWTO.md`, skim `docs/CURSOR_REALIGN_DEEP.md`. Gate **`npm run verify`** dalla root del monorepo: **OK** (typecheck workspace + lint + build `apps/web`).

**Bussola:** solo questo clone per UI/API Pro 2; V1 = repo separato. Generativo = motore deterministico + interpretazione; niente secondo builder; calendario = hub persistenza.

---

## Ordine consigliato (un punto per volta)

### P0 — Deploy / ambiente (se il problema è “Vercel fermo”)

- Dashboard Vercel progetto collegato a [empathy-pro-2](https://github.com/d1smario/empathy-pro-2): **Production branch = `master`**, nuovi commit visibili come deploy (anche falliti).
- Impostazioni monorepo: `docs/PLATFORM_AND_DEPLOY.md` — Root **`apps/web`**, install/build da root (`cd ../.. && npm install` / `build` come in `apps/web/vercel.json`).
- **Nessun codice** finché non è chiaro se è solo integrazione Git.

### P1 — Stabilità sessione e atleta (dopo env)

- Seguire **sezione B** di `docs/PRO2_SMOKE_CHECKLIST.md`: login `/access`, sessione, atleta attivo senza loop.
- Se fallisce: tracciare solo auth/middleware/ensure-profile (non mescolare fix UI generative nello stesso intervento).

### P2 — Training: lettura hub e VIRYA/calendario

- **C1–C3** smoke checklist (dashboard hub, memoria, profilo/fisiologia).
- **D1–D4**: `planned-window`, builder generate, insert planned, virya-context.
- Già affrontati in codice recente: sostituzione VIRYA su `POST /api/training/planned` (ILIKE + date range), archetipi aerobici Virya — **verificare in UI** con piano rigenerato e checkbox sostituzione.

### P3 — Nutrizione (meal plan + fueling)

- **E1–E2** smoke: `intelligent-meal-plan` deterministico, diary se in uso.
- Già in codice: gate generazione finché USDA per i 5 slot non è caricato; messaggi errore senza riferimento fuorviante a OpenAI.
- **Prossimo punto utile:** segnalazione concreta (schermata / valori attesi vs ottenuti) su meal plan o fueling → un solo asse per PR (non mescolare con P2).

### P4 — Documentazione minore (bassa priorità)

- In `docs/CURSOR_REALIGN_DAILY.md` il bullet nutrizione cita ancora “V1” per `/api/nutrition/intelligent-meal-plan`; su Pro 2 l’endpoint è lo stesso **pattern** ma il file vive in **questo** repo — allineare testo quando si tocca di nuovo quel doc (evita confusione multi-root).

### P5 — Interpretazione / knowledge (dopo stabilità core)

- Sezione **F** smoke: multiscala, PubMed — solo dopo che P1–P3 non hanno regressioni aperte.

---

## Come usare questo file in chat

Scrivi ad esempio: *“Punto **P2** dalla WORKSTREAM_AFTER_REALIGN”* così il lavoro resta sequenziale e tracciabile.
