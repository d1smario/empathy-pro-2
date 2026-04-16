# Piattaforma: Cursor, cartella locale, GitHub, Supabase, Vercel e “collegamento” Figma / Spline / LogMeal

## Cosa significa “collegare” (chiaro)

| Strumento | Ruolo | Dove vive tecnicamente | Cosa NON è |
|-----------|--------|-------------------------|------------|
| **Figma** | Design system, token, layout (incluso spazio viewport 3D) | Workflow **team** + export **build-time** (token → CSS). File/link nel team design. | **Non** si collega a Vercel/Supabase come integrazione runtime. Nessuna API Figma in produzione. |
| **Spline** | Autore delle **scene 3D** | Account Spline per pubblicare scene; in app spesso **URL pubblici** o embed (`NEXT_PUBLIC_*` se necessario). | Il viewer gira nell’app; Vercel ospita solo il frontend che **carica** la scena. |
| **LogMeal** | API **server-side** diario alimentare | **Segreto** solo su server: variabili in **Vercel** (o CI) tipo `LOGMEAL_API_KEY`, mai esposte al browser. | Nessun “account LogMeal dentro Supabase”; eventualmente solo log/metadata pasti **nel DB** dopo chiamata API. |

## Cursor + cartella in Documenti

- **Sono la stessa cosa**: apri in Cursor la cartella del repo clonato (es. `...\Documenti\EMPATHY\empathy-pro-2`).
- **PowerShell** usa gli stessi path per `git`, `npm`, `gh`.

## GitHub

- Repository: [github.com/d1smario/empathy-pro-2](https://github.com/d1smario/empathy-pro-2) (o fork/org futura).
- **Branch** principale (`master` o `main`): protezione opzionale, PR review per `apps/web` e `packages/*`.
- **Segreti GitHub Actions** (se CI): stesse chiavi che userai su Vercel per build preview (Supabase, LogMeal solo se un job chiama l’API).

## Supabase

- **Consigliato per 2.0 greenfield**: **nuovo progetto Supabase** dedicato, così schema e RLS non interferiscono con V1 fino al cutover.
- **Alternativa**: stesso progetto V1 con **schema dedicato** `empathy_v2` — più rischio di accoppiamento; solo se gestito con disciplina.
- Variabili tipiche in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo server).

## Vercel

- **URL production attuale (progetto collegato al repo):** [https://empathy-pro-2-web.vercel.app/](https://empathy-pro-2-web.vercel.app/) — se i deploy non si aggiornano dopo `git push` su `master`, controlla in dashboard: repo corretto, **Production Branch = `master`**, log ultimo deploy (build fallito vs webhook assente). Dettaglio “fatti statici” anche in `docs/AGENT_STATIC_CONTEXT_PRO2.md`.

1. **New Project** → import del repo (es. `empathy-pro-2-cursor` / `empathy-pro-2`).
2. **Monorepo (consigliato):** **Root Directory** = **`apps/web`**. Il file `apps/web/vercel.json` imposta già:
   - **Install Command**: `cd ../.. && npm ci` (come in repo; install pulita in CI)
   - **Build Command**: `cd ../.. && npm run build`  
   Così si installano tutti i workspace (`packages/*`) e si esegue `next build ./apps/web` dalla root del clone. In dashboard, se compaiono comandi duplicati, lascia prevalere `vercel.json` o allinea manualmente a questi valori.
3. **Node.js** 20.x (allineato a `engines` nel `package.json` root).
4. Aggiungere **Environment Variables** (Production + Preview):
   - Supabase (come sopra)
   - `LOGMEAL_API_KEY`, eventuale `LOGMEAL_API_BASE_URL`
   - Eventuali `NEXT_PUBLIC_*` per Spline solo se la runtime lo richiede
5. **Figma**: non è una variabile Vercel; il team invita designer/dev al file Figma e automatizza **export token** in repo (script locale/CI).

## Ordine operativo consigliato (primo deploy)

1. Repo GitHub aggiornato e build locale dalla root: `npm run build` OK (stesso comando di Vercel).  
2. Progetto Supabase creato + migrazioni (quando esistono).  
3. Progetto Vercel collegato + env compilate.  
4. Figma: file master + convenzione token.  
5. Spline: prime scene di prova + mapping in catalogo esercizi.  
6. LogMeal: chiave API solo dopo accordi privacy; route API che in caso di errore **non** bloccano l’app.

Dettaglio sicurezza e fallimenti: `docs/ARCHITECTURE_SAFETY_AND_RISKS.md`.
