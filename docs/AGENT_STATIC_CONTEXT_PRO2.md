# Contesto statico Empathy Pro 2.0 (per agent e umani)

Questo file **non** sostituisce architettura o constitution: serve perché **la chat non ha memoria tra sessioni**. URL, branch e deploy “ufficiali” del clone Pro 2 restano qui.

## Repo e branch

- **GitHub (canonico):** [https://github.com/d1smario/empathy-pro-2/](https://github.com/d1smario/empathy-pro-2/)
- **Branch di lavoro / production Git:** `master` (push da questo clone → `origin/master`)

## Ambienti

| Ambiente | URL / comando |
|----------|-----------------|
| **Dev locale** | [http://localhost:3020/](http://localhost:3020/) — porta predefinita Pro 2 (`EMPATHY_PRO2_DEV_PORT`, default `3020`). Vedi anche `docs/LOCAL_DEV_WITH_V1.md`. |
| **Production (Vercel)** | [https://empathy-pro-2-web.vercel.app/](https://empathy-pro-2-web.vercel.app/) — **solo** questo progetto Empathy Pro 2; non usare altri progetti Vercel o “estensioni” come destinazione deploy per questo repo. |
| **Monorepo Next** | App in `apps/web`; build dalla root: `npm run verify` / `npm run build`. Deploy Vercel: vedi `docs/PLATFORM_AND_DEPLOY.md` (Root Directory `apps/web`, install/build da root). |

## Riallineamento Cursor (bussola)

- **Come usare i testi:** `docs/CURSOR_REALIGN_HOWTO.md`
- **Blocco quotidiano (corto):** `docs/CURSOR_REALIGN_DAILY.md`
- **Riallineamento profondo:** `docs/CURSOR_REALIGN_DEEP.md`

**Frase in chat (trigger riallineamento):** incolla il blocco da `CURSOR_REALIGN_DAILY.md` oppure scrivi ad esempio **`RIALLINEAMENTO EMPATHY PRO`** o **`RIALLINEAMENTO EMPATHY PRO 2`** e chiedi di rileggere questo file + i tre doc sopra.

## Mirror su V1

Gli stessi `CURSOR_REALIGN_*` possono esistere anche in `nextjs-empathy-pro/docs/` (workspace V1): non duplicare logica Pro 2 lì; per **fatti deploy Pro 2** la fonte è **questo repo** (`empathy-pro-2-cursor`).

## Regola Cursor nel repo

La rule `.cursor/rules/empathy_pro2_agent_static_context.mdc` punta a questo documento così ogni sessione agent sul clone ha i riferimenti senza dipendere dalla memoria della chat. In aggiunta, **`.cursor/rules/empathy_pro2_integrated_agent_execution.mdc`** (`alwaysApply`) vincola ogni patch al generativo e allo schema condiviso; è richiamata anche da `.cursor/rules/empathy_generative_core.mdc`.
