# P0 — Checklist deploy Vercel (Empathy Pro 2)

**Obiettivo:** ogni `git push` su **`master`** di [github.com/d1smario/empathy-pro-2](https://github.com/d1smario/empathy-pro-2) produce un deploy su **Production** (o almeno un deployment visibile, anche fallito da correggere).

**Production URL attesa:** [https://empathy-pro-2-web.vercel.app/](https://empathy-pro-2-web.vercel.app/) (nome progetto tipico `empathy-pro-2-web` — verifica il nome nella sidebar Vercel).

---

## 1) Progetto giusto e Git

1. Vercel → **Settings → Git**
   - **Repository:** `d1smario/empathy-pro-2` (non un fork vecchio / non un altro repo).
   - **Production Branch:** **`master`** (se è `main` o altro, i push su `master` non deployano).
2. **Settings → Git → Deploy Hooks** (opzionale): se il repo non riceve webhook, prova **Disconnect** e **Connect** di nuovo il repository (rigenera permessi GitHub App).

---

## 2) Monorepo (root + comandi)

1. **Settings → General → Root Directory** = **`apps/web`**
2. Non sovrascrivere in UI comandi **in conflitto** con il repo: in `apps/web/vercel.json` sono definiti:
   - **Install:** `cd ../.. && npm ci`
   - **Build:** `cd ../.. && npm run build`  
   Se in dashboard hai ancora `npm install` o path sbagliati, allinea a questi (stesso risultato di `npm run verify` in locale dalla root clone).

---

## 3) Runtime Node

- **Settings → General → Node.js Version:** **20.x** (coerente con `engines` nel `package.json` root).

---

## 4) Variabili d’ambiente (Production + Preview)

Minimo per app non rotta a runtime (adatta ai tuoi segreti reali):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo server; mai nel client)

Altre chiavi (Stripe, LogMeal, …) solo se le route che le usano sono in scope — vedi `apps/web/.env.example`.

---

## 5) Deploy non partono ancora

1. **Deployments:** dopo un push, compare una **nuova** riga?  
   - **No** → problema Git / branch / disconnessione (torna a §1).  
   - **Sì, rossa** → apri il log: spesso `npm ci` fallisce per `package-lock.json` non committato o lock fuori sync; in locale dalla root: `npm ci` deve passare.
2. **Ignored Build Step** (Settings → Git): se c’è uno script che esce `0` = skip build, i push non producono nulla di nuovo. Per test: disattivalo o correggilo.
3. **Redeploy:** dalla scheda dell’ultimo deploy andato bene → **⋯ → Redeploy** (usa commit attuale dopo pull).

---

## 6) GitHub Actions (stesso comando di Vercel su Linux)

Dopo il push su `master`, in **GitHub → tab Actions** deve comparire il workflow **CI** (file `.github/workflows/ci.yml`): esegue `npm ci` + `npm run verify` su **ubuntu-latest** (Node 20).

- **Verde** su `master` ma Vercel rosso → controlla solo dashboard Vercel (root, comandi, env), non il lockfile.
- **Rosso** su Actions → apri il log: stesso errore che vedresti su Vercel con `npm ci` / build; correggi in repo prima di inseguire Vercel.

**Locale Windows / OneDrive:** `npm ci` può fallire con `EPERM` su file `.node` in uso; non è il gate di produzione. Gate = **Actions** + **Vercel Linux**.

## 7) Verifica rapida post-fix (Vercel)

- Deploy **Production** con commit hash uguale all’ultimo su GitHub `master`.
- Apri [https://empathy-pro-2-web.vercel.app/api/health](https://empathy-pro-2-web.vercel.app/api/health) — risposta JSON con stato ok (se l’endpoint esiste nel progetto).

---

## Riferimenti in repo

- Contesto statico URL: `docs/AGENT_STATIC_CONTEXT_PRO2.md`
- Panoramica piattaforma: `docs/PLATFORM_AND_DEPLOY.md`
- Linea di lavoro complessiva: `docs/WORKSTREAM_AFTER_REALIGN.md`
