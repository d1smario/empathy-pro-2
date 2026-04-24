# Supabase — Empathy Pro 2.0 (solo questo monorepo)

## Un solo progetto Supabase per deploy ufficiale

Per **produzione** (es. app su Vercel `empathy-pro-2-web`): **tutte** le stringhe (`NEXT_PUBLIC_SUPABASE_URL`, anon key, `SUPABASE_SERVICE_ROLE_KEY`) e **tutte** le query nel SQL Editor devono riferirsi allo **stesso** progetto cloud. Controlla l’host con `GET /api/health` (`supabaseHost`) e confrontalo con Dashboard → Settings → API.  
Se in passato esisteva un **secondo** progetto (legacy / V1), non mischiare: migration e `PASTE_*.sql` vanno eseguiti solo sul progetto che l’app usa davvero.

Le migration Pro 2 stanno **solo** in **`empathy-pro-2-cursor/supabase/migrations/`**.  
**Empathy V1** è un altro repository (`nextjs-empathy-pro`): non incrociare path o import tra i due progetti.

## File in questo repo

| File | Contenuto |
|------|-----------|
| `000_pro2_orgs.sql` | Tabella `orgs` + seed UUID default |
| `002_coach_athletes_org_multitenant.sql` | `coach_athletes.org_id` + nuova PK |
| `003_coach_invitations.sql` | Tabella `coach_invitations` |

Ordine consigliato su DB **già popolato da V1**: prima le migration V1 dal **checkout V1** (almeno `001` + `004`), poi **in ordine** `000` → `002` → `003` da **questa** cartella.

Su DB nuovo: applicare prima lo schema canonico atleta dal repo V1, poi la catena qui sopra.

## Variabili (apps/web)

- `EMPATHY_COACH_ATHLETES_ORG_ID` / `NEXT_PUBLIC_EMPATHY_COACH_ATHLETES_ORG_ID` — opzionali se usi lo seed in `000` (vedi `apps/web/lib/coach-org-id.ts`).
- `SUPABASE_SERVICE_ROLE_KEY` — inviti (`/api/coach/invites`, `/api/invites/accept`).

## Stesso progetto Supabase di V1

È supportato in demo: due **codebase** distinti, un solo progetto cloud. Le migration vanno applicate per blocchi coerenti (V1 da repo V1, Pro 2 da repo Pro 2), senza copiare cartelle tra repo.
